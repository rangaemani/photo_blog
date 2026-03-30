import json
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SharedLayout

MAX_BLOB_SIZE = 50 * 1024  # 50 KB
RATE_LIMIT_WINDOW = timedelta(hours=1)
RATE_LIMIT_MAX = 5


def get_client_ip(request) -> str:
    """Get client IP. Only trusts REMOTE_ADDR to prevent header spoofing.
    If deployed behind a reverse proxy, configure NUM_PROXIES and use
    X-Forwarded-For's rightmost untrusted entry instead."""
    return request.META.get('REMOTE_ADDR', '')


class LayoutCreateView(APIView):
    """POST /api/v1/layouts/: store a desktop layout blob and return a short slug."""
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        if not isinstance(data, dict) or 'icons' not in data:
            return Response({'error': 'Invalid layout blob'}, status=status.HTTP_400_BAD_REQUEST)

        raw = json.dumps(data, sort_keys=True)
        if len(raw.encode('utf-8')) > MAX_BLOB_SIZE:
            return Response({'error': 'Layout too large (max 50KB)'}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        # Deterministic slug: same content = same URL (deduplicates)
        slug = SharedLayout.slug_from_data(data)

        # If this exact layout already exists, just return it
        existing = SharedLayout.objects.filter(slug=slug).first()
        if existing:
            return Response({'slug': existing.slug})

        # Rate limit by IP
        ip = get_client_ip(request)
        cutoff = timezone.now() - RATE_LIMIT_WINDOW
        recent_count = SharedLayout.objects.filter(ip_address=ip, created_at__gte=cutoff).count()
        if recent_count >= RATE_LIMIT_MAX:
            return Response(
                {'error': 'Rate limit exceeded. Try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        SharedLayout.objects.create(slug=slug, data=data, ip_address=ip)
        return Response({'slug': slug}, status=status.HTTP_201_CREATED)


class LayoutRetrieveView(APIView):
    """GET /api/v1/layouts/<slug>/: retrieve a shared layout blob."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            layout = SharedLayout.objects.get(slug=slug)
        except SharedLayout.DoesNotExist:
            return Response({'error': 'Layout not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response(layout.data)
