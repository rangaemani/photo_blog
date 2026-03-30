import io
import logging
import zipfile

from django.conf import settings
from django.db import IntegrityError, models
from django.db.models import Count
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)
from .models import Photo, Category, Report
from .pipeline import PipelineError, _get_r2_client, delete_from_r2, process_upload
from .serializers import (
    AdminReportSerializer,
    CategoryCreateSerializer,
    CategorySerializer,
    PhotoDetailSerializer,
    PhotoDownloadSerializer,
    PhotoGeotagPatchSerializer,
    PhotoListSerializer,
    PhotoCategoryPatchSerializer,
    PhotoUploadSerializer,
    ReportCreateSerializer,
    TrashActionSerializer,
    TrashedPhotoSerializer,
)

class PhotoListView(viewsets.ReadOnlyModelViewSet[Photo]):
    """Read-only photo listing and detail.

    ``list`` → paginated ``PhotoListSerializer``.
    ``retrieve`` → full ``PhotoDetailSerializer`` (reactions, comments, tags, etc.).

    Staff see reported photos; guests do not. Sort order is controlled by
    the ``order`` query param (``asc``/``desc``, default ``desc``).
    """
    lookup_field = 'slug'

    def get_queryset(self):
        if self.request.user.is_staff: # pyright: ignore[reportAttributeAccessIssue]
            qs = Photo.objects.select_related('category').filter(is_trashed=False)
        else:
            qs = Photo.objects.select_related('category').filter(is_trashed=False, is_reported=False)
        category_slug = self.request.query_params.get('category')
        if category_slug:
            qs = qs.filter(category__slug=category_slug)
        order = self.request.query_params.get('order', 'desc')
        if order == 'asc':
            qs = qs.order_by(models.F('taken_at').asc(nulls_last=True), 'id')
        else:
            qs = qs.order_by(models.F('taken_at').desc(nulls_last=True), '-id')
        return qs

    def get_serializer_class(self): # pyright: ignore[reportIncompatibleMethodOverride]
        if self.action == 'retrieve':
            return PhotoDetailSerializer
        return PhotoListSerializer


class CategoryviewSet(viewsets.ReadOnlyModelViewSet[Category]):
    """Read-only category list with live photo counts.

    ``photo_count`` is annotated - excludes trashed photos.
    Pagination is disabled; the full list is returned in one response.
    """
    pagination_class = None

    def get_queryset(self):
        return Category.objects.annotate(
            photo_count=Count('photos', filter=models.Q(photos__is_trashed=False))
        )
    serializer_class = CategorySerializer
    lookup_field = 'slug'


# === Admin-only management views ===


class PhotoUploadView(APIView):
    """Upload a new photo (admin only).

    Runs the full pipeline: image decode → R2 original upload → thumbnail
    generation → R2 thumbnail upload → EXIF extraction → blurhash.
    Slug is derived from the title and deduplicated if necessary.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = PhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']
        title = serializer.validated_data['title']
        description = serializer.validated_data.get('description', '')
        category = serializer.validated_data['category']

        photo = Photo(title=title, description=description or None, category=category)
        photo.slug = slugify(title)

        # Ensure unique slug
        base_slug = photo.slug
        counter = 1
        while Photo.objects.filter(slug=photo.slug).exists():
            photo.slug = f'{base_slug}-{counter}'
            counter += 1

        try:
            pipeline_data = process_upload(file, photo_id=photo.id)
        except PipelineError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        for field, value in pipeline_data.items():
            setattr(photo, field, value)

        try:
            photo.save()
        except IntegrityError:
            # Slug race condition - append short uuid suffix and retry
            photo.slug = f'{base_slug}-{photo.id.hex[:6]}'
            photo.save()

        return Response(
            PhotoDetailSerializer(photo).data,
            status=status.HTTP_201_CREATED,
        )


class TrashedPhotoListView(generics.ListAPIView):
    """Paginated list of soft-deleted photos (admin only)."""
    permission_classes = [IsAdminUser]
    serializer_class = TrashedPhotoSerializer

    def get_queryset(self):
        return Photo.objects.select_related('category').filter(is_trashed=True)


class TrashView(APIView):
    """Move photos to trash."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = TrashActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['ids']

        count = Photo.objects.filter(id__in=ids, is_trashed=False).update(
            is_trashed=True, trashed_at=timezone.now(),
        )
        return Response({'trashed': count})


class TrashRestoreView(APIView):
    """Restore photos from trash."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = TrashActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['ids']

        count = Photo.objects.filter(id__in=ids, is_trashed=True).update(
            is_trashed=False, trashed_at=None,
        )
        return Response({'restored': count})


class TrashPurgeView(APIView):
    """Permanently delete specific trashed photos + their R2 objects."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = TrashActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['ids']

        photos = Photo.objects.filter(id__in=ids, is_trashed=True)
        r2_keys = [(p.original_key, p.thumbnail_key) for p in photos]
        count = photos.delete()[0]
        for original_key, thumbnail_key in r2_keys:
            delete_from_r2(original_key, thumbnail_key)
        return Response({'purged': count})


class TrashEmptyView(APIView):
    """Permanently delete ALL trashed photos."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        photos = Photo.objects.filter(is_trashed=True)
        r2_keys = [(p.original_key, p.thumbnail_key) for p in photos]
        count = photos.delete()[0]
        for original_key, thumbnail_key in r2_keys:
            delete_from_r2(original_key, thumbnail_key)
        return Response({'purged': count})


class CategoryCreateView(generics.CreateAPIView):
    """Create a new category (admin only)."""
    serializer_class = CategoryCreateSerializer
    permission_classes = [IsAdminUser]


class PhotoCategoryPatchView(generics.UpdateAPIView):
    """Partial update a photo's category via drag-drop"""
    queryset = Photo.objects.all()
    serializer_class = PhotoCategoryPatchSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'slug'
    http_method_names = ['patch']

class PhotoGeotagPatchView(generics.UpdateAPIView):
    """Partial update a photo's geodata"""
    queryset = Photo.objects.all()
    serializer_class = PhotoGeotagPatchSerializer
    lookup_field = 'slug'
    http_method_names = ['patch']
    
    def perform_update(self, serializer):
        # Any authenticated user can set coordinates on an untagged photo,
        # but only staff can overwrite an existing geotag.
        photo: Photo = self.get_object()
        if (photo.lat is not None or photo.lng is not None) and not self.request.user.is_staff:             # pyright: ignore[reportAttributeAccessIssue]
            raise PermissionDenied("Geotag already exists on photo")
        serializer.save()

class ReportPhotoView(APIView):
    """Submit a report on a photo. No authentication required."""
    permission_classes = []  # AllowAny

    RATE_LIMIT = 5

    def _get_client_ip(self, request) -> str:
        """Return the requester's IP, trusting X-Forwarded-For if present.

        Note: X-Forwarded-For can be spoofed unless your proxy strips it.
        For stricter enforcement, use only REMOTE_ADDR or configure a trusted
        proxy count.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

    def post(self, request, slug):
        try:
            photo = Photo.objects.get(slug=slug, is_trashed=False)
        except Photo.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        ip = self._get_client_ip(request)
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1) # pyright: ignore[reportAttributeAccessIssue]
        recent_count = Report.objects.filter(reporter_ip=ip, created_at__gte=one_hour_ago).count()
        if recent_count >= self.RATE_LIMIT:
            return Response(
                {'error': 'Too many reports. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # UUIDs from validated_data are not JSON-serializable - stringify them
        targets = [
            {k: str(v) if hasattr(v, 'hex') else v for k, v in t.items()}
            for t in serializer.validated_data['targets']
        ]
        report = Report.objects.create(
            photo=photo,
            targets=targets,
            reason=serializer.validated_data['reason'],
            reporter_ip=ip or None,
            reporter_user=request.user if request.user.is_authenticated else None,
        )

        photo.is_reported = True
        photo.save(update_fields=['is_reported'])

        return Response({'id': str(report.id)}, status=status.HTTP_201_CREATED)


class AdminReportListView(generics.ListAPIView):
    """List all pending reports (admin only)."""
    permission_classes = [IsAdminUser]
    serializer_class = AdminReportSerializer
    pagination_class = None

    def get_queryset(self):
        return Report.objects.select_related('photo').filter(
            status=Report.STATUS_PENDING
        ).order_by('-created_at')


class AdminReportActionView(APIView):
    """Dismiss or delete a reported photo (admin only)."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            report = Report.objects.select_related('photo').get(pk=pk)
        except Report.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action not in ('dismiss', 'delete'):
            return Response({'error': "action must be 'dismiss' or 'delete'"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()

        if action == 'dismiss':
            report.status = Report.STATUS_DISMISSED
            report.reviewed_at = now
            report.save(update_fields=['status', 'reviewed_at'])
            report.photo.is_reported = False
            report.photo.save(update_fields=['is_reported'])
        else:  # delete
            report.status = Report.STATUS_REVIEWED
            report.reviewed_at = now
            report.save(update_fields=['status', 'reviewed_at'])
            report.photo.is_trashed = True
            report.photo.trashed_at = now
            report.photo.save(update_fields=['is_trashed', 'trashed_at'])

        return Response({'ok': True})


class DownloadRateThrottle(UserRateThrottle):
    """Rate throttle for photo downloads. Configure rate in settings under ``REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['photo_download']``."""
    scope = 'photo_download'


class PhotoDownloadView(APIView):
    """Download one or more photos as a ZIP (or a single file).

    POST /api/v1/photos/download/
    Body: { "ids": ["<uuid>", ...] }  - max 50 IDs.
    Requires authentication (OTP or admin session).
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [DownloadRateThrottle]

    def post(self, request):
        serializer = PhotoDownloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['ids']

        photos = list(
            Photo.objects.filter(id__in=ids, is_trashed=False)
            .values('id', 'slug', 'original_key')
        )
        if not photos:
            return Response({'error': 'No photos found'}, status=status.HTTP_404_NOT_FOUND)

        client = _get_r2_client()

        if len(photos) == 1:
            photo = photos[0]
            key = photo['original_key']
            ext = key.rsplit('.', 1)[-1] if '.' in key else 'jpg'
            try:
                obj = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
                data = obj['Body'].read()
            except Exception:
                logger.exception('R2 fetch failed for key %s', key)
                return Response({'error': 'Failed to fetch photo from storage'}, status=status.HTTP_502_BAD_GATEWAY)

            response = HttpResponse(data, content_type='application/octet-stream')
            response['Content-Disposition'] = f'attachment; filename="{photo["slug"]}.{ext}"'
            return response

        # Multiple photos - build ZIP, failing hard on any R2 error
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_STORED) as zf:
            for photo in photos:
                key = photo['original_key']
                ext = key.rsplit('.', 1)[-1] if '.' in key else 'jpg'
                filename = f'{photo["slug"]}.{ext}'
                try:
                    obj = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
                    zf.writestr(filename, obj['Body'].read())
                except Exception:
                    logger.exception('R2 fetch failed for key %s', key)
                    return Response(
                        {'error': f'Failed to fetch photo "{photo["slug"]}" from storage'},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )

        buf.seek(0)
        response = HttpResponse(buf.read(), content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="photos.zip"'
        return response


class CategoryDeleteView(APIView):
    """Delete a category and reassign its photos to 'Uncategorized' (admin only).

    Returns the reassigned photos so the frontend can pin them to the desktop.
    """
    permission_classes = [IsAdminUser]

    def delete(self, request, slug):
        if slug == 'uncategorized':
            return Response({'error': 'Cannot delete the Uncategorized category'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            category = Category.objects.get(slug=slug)
        except Category.DoesNotExist:
            return Response({'error': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)

        uncategorized = Category.objects.get(slug='uncategorized')

        # Gather photo info before reassigning (frontend needs this to scatter on desktop)
        photos = Photo.objects.filter(category=category, is_trashed=False)
        reassigned = [
            {
                'id': str(p.id),
                'slug': p.slug,
                'title': p.title,
                'thumbnail_url': f'{settings.R2_BASE_URL}/{p.thumbnail_key}',
            }
            for p in photos
        ]
        logger.info('Deleting category "%s" (slug=%s), reassigning %d photos', category.name, slug, len(reassigned))

        # Reassign ALL photos (including trashed) so the FK constraint is satisfied
        Photo.objects.filter(category=category).update(category=uncategorized)

        category.delete()

        return Response({
            'ok': True,
            'reassigned_photos': reassigned,
        })