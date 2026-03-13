from django.conf import settings
from django.db import IntegrityError, models
from django.db.models import Count
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import generics, status, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Photo, Category
from .pipeline import PipelineError, delete_from_r2, process_upload
from .serializers import (
    CategoryCreateSerializer,
    CategorySerializer,
    PhotoDetailSerializer,
    PhotoListSerializer,
    PhotoPatchSerializer,
    PhotoUploadSerializer,
    TrashActionSerializer,
    TrashedPhotoSerializer,
)

# Create your views here.
class PhotoListView(viewsets.ReadOnlyModelViewSet[Photo]):
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Photo.objects.select_related('category').filter(is_trashed=False)
        category_slug = self.request.query_params.get('category')
        if category_slug:
            qs = qs.filter(category__slug=category_slug)
        return qs
    
    def get_serializer_class(self): # pyright: ignore[reportIncompatibleMethodOverride]
        if self.action == 'retrieve':
            return PhotoDetailSerializer
        return PhotoListSerializer    
    
class CategoryviewSet(viewsets.ReadOnlyModelViewSet[Category]):
    pagination_class = None
    def get_queryset(self):
        return Category.objects.annotate(
            photo_count=Count('photos', filter=models.Q(photos__is_trashed=False))
        )
    serializer_class = CategorySerializer
    lookup_field = 'slug'


# === Admin-only management views ===


class PhotoUploadView(APIView):
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
            # Slug race condition — append short uuid suffix and retry
            photo.slug = f'{base_slug}-{photo.id.hex[:6]}'
            photo.save()

        return Response(
            PhotoDetailSerializer(photo).data,
            status=status.HTTP_201_CREATED,
        )


class TrashedPhotoListView(generics.ListAPIView):
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


class PhotoPatchView(generics.UpdateAPIView):
    """Partial update a photo (e.g. change category via drag-drop)."""
    queryset = Photo.objects.all()
    serializer_class = PhotoPatchSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'slug'
    http_method_names = ['patch']


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
        print(f'[CategoryDelete] Deleting "{category.name}" (slug={slug}), reassigning {len(reassigned)} photos')

        # Reassign ALL photos (including trashed) so the FK constraint is satisfied
        Photo.objects.filter(category=category).update(category=uncategorized)

        category.delete()

        return Response({
            'ok': True,
            'reassigned_photos': reassigned,
        })