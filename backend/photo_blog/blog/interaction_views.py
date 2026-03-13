from datetime import timedelta

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Comment, Photo, Reaction
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
