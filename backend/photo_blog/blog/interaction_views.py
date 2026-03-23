from datetime import timedelta

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Comment, Photo, PopTag, Reaction, Tag
from .serializers import CommentCreateSerializer, CommentSerializer


class ToggleReactionView(APIView):
    """Toggle an emoji reaction on a photo. POST with {"emoji": "❤️"}."""
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        photo = get_object_or_404(Photo, slug=slug, is_trashed=False)
        emoji = request.data.get('emoji', '').strip()
        if not emoji or len(emoji) > 10:
            return Response({'error': 'invalid_emoji'}, status=status.HTTP_400_BAD_REQUEST)

        reaction, created = Reaction.objects.get_or_create(
            photo=photo, user=request.user, emoji=emoji,
        )
        if not created:
            reaction.delete()

        summary = dict(
            photo.reactions.values_list('emoji')
            .annotate(count=Count('id'))
            .values_list('emoji', 'count')
        )

        return Response({
            'active': created,
            'reaction_summary': summary,
        })


class CommentListCreateView(APIView):
    """GET: list comments (public). POST: create comment (authenticated, rate-limited)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, slug):
        photo = get_object_or_404(Photo, slug=slug, is_trashed=False)
        comments = photo.comments.select_related('user__profile').all()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(comments, request)
        serializer = CommentSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, slug):
        photo = get_object_or_404(Photo, slug=slug, is_trashed=False)

        # Rate limit: 5 comments per minute per user
        one_minute_ago = timezone.now() - timedelta(minutes=1)
        recent = Comment.objects.filter(user=request.user, created_at__gte=one_minute_ago).count()
        if recent >= 5:
            return Response(
                {'error': 'rate_limited', 'detail': 'Too many comments. Please wait a moment.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = Comment.objects.create(
            photo=photo,
            user=request.user,
            text=serializer.validated_data['text'],
        )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class CommentDeleteView(APIView):
    """Admin-only: delete a comment for moderation."""
    permission_classes = [IsAdminUser]

    def delete(self, request, slug, pk):
        comment = get_object_or_404(Comment, pk=pk, photo__slug=slug)
        comment.delete()
        return Response({'ok': True})


class TagAddView(APIView):
    """Add a tag to a photo. POST with {"text": "sunset"}."""
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        photo = get_object_or_404(Photo, slug=slug, is_trashed=False)
        text = request.data.get('text', '').strip().lower()
        if not text or len(text) > 50:
            return Response({'error': 'invalid_tag'}, status=status.HTTP_400_BAD_REQUEST)

        tag, created = Tag.objects.get_or_create(
            photo=photo, text=text,
            defaults={'user': request.user},
        )
        if not created:
            return Response({'error': 'duplicate'}, status=status.HTTP_409_CONFLICT)

        tags = list(photo.tags.values('id', 'text', 'user__username').order_by('created_at'))
        return Response({'tags': tags}, status=status.HTTP_201_CREATED)


class TagRemoveView(APIView):
    """Remove a tag. Author or admin can remove."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, slug, pk):
        tag = get_object_or_404(Tag, pk=pk, photo__slug=slug)
        if tag.user != request.user and not request.user.is_staff:
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)
        photo = tag.photo
        tag.delete()
        tags = list(photo.tags.values('id', 'text', 'user__username').order_by('created_at'))
        return Response({'tags': tags})


MAX_POP_TAGS_PER_PHOTO = 10


class PopTagAddView(APIView):
    """Place a pop tag on a photo. POST with {"label": "Alice", "x": 0.5, "y": 0.3}."""
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        photo = get_object_or_404(Photo, slug=slug, is_trashed=False)
        label = request.data.get('label', '').strip()
        x = request.data.get('x')
        y = request.data.get('y')

        if not label or len(label) > 50:
            return Response({'error': 'invalid_label'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            x, y = float(x), float(y)
        except (TypeError, ValueError):
            return Response({'error': 'invalid_position'}, status=status.HTTP_400_BAD_REQUEST)
        if not (0 <= x <= 1 and 0 <= y <= 1):
            return Response({'error': 'position_out_of_range'}, status=status.HTTP_400_BAD_REQUEST)

        if photo.pop_tags.count() >= MAX_POP_TAGS_PER_PHOTO:
            return Response({'error': 'max_tags_reached'}, status=status.HTTP_400_BAD_REQUEST)

        PopTag.objects.create(photo=photo, user=request.user, label=label, x=x, y=y)
        pop_tags = list(photo.pop_tags.values('id', 'label', 'x', 'y', 'user__username').order_by('created_at'))
        return Response({'pop_tags': pop_tags}, status=status.HTTP_201_CREATED)


class PopTagRemoveView(APIView):
    """Remove a pop tag. Author or admin can remove."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, slug, pk):
        pop_tag = get_object_or_404(PopTag, pk=pk, photo__slug=slug)
        if pop_tag.user != request.user and not request.user.is_staff:
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)
        photo = pop_tag.photo
        pop_tag.delete()
        pop_tags = list(photo.pop_tags.values('id', 'label', 'x', 'y', 'user__username').order_by('created_at'))
        return Response({'pop_tags': pop_tags})
