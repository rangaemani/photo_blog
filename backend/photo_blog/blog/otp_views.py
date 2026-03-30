"""OTP-based passwordless authentication views."""

import json
import logging
import hmac
import secrets
from datetime import timedelta

import resend
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

from .models import OTPRequest, UserProfile

logger = logging.getLogger(__name__)


def _detect_identifier_type(identifier: str) -> str:
    """Detect whether an identifier is an email or phone number."""
    if '@' in identifier:
        return 'email'
    # Assume phone if starts with + or is all digits
    cleaned = identifier.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
    if cleaned.startswith('+') or cleaned.isdigit():
        return 'phone'
    return 'email'  # default fallback


def _generate_code() -> str:
    """Generate a random 6-digit numeric OTP code."""
    return ''.join(secrets.choice('0123456789') for _ in range(settings.OTP_LENGTH))


def _send_otp(identifier: str, identifier_type: str, code: str) -> bool:
    """Send OTP via email (or phone in the future). Returns True on success."""
    if identifier_type == 'email':
        try:
            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                'from': settings.DEFAULT_FROM_EMAIL,
                'to': [identifier],
                'subject': 'Your login code',
                'text': f'Your verification code is: {code}\n\nThis code expires in 5 minutes.',
            })
            logger.info('[OTP] Sent code to %s via email', identifier)
            return True
        except Exception as e:
            logger.error('[OTP] Failed to send email to %s: %s', identifier, e)
            return False
    elif identifier_type == 'phone':
        # TODO: Implement SMS sending
        logger.warning('[OTP] SMS not implemented. Code for %s: %s', identifier, code)
        return True
    return False


@method_decorator(csrf_exempt, name='dispatch')
class OTPRequestView(View):
    """Request a new OTP code.

    POST /api/v1/auth/otp/request/
    Body: { "identifier": "user@example.com" }
    """

    def post(self, request):
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        identifier = body.get('identifier', '').strip().lower()
        if not identifier:
            return JsonResponse({'error': 'Identifier required'}, status=400)

        identifier_type = _detect_identifier_type(identifier)

        # Rate limit: max active (unexpired, unused) OTPs per identifier
        now = timezone.now()
        active_count = OTPRequest.objects.filter(
            identifier=identifier,
            is_used=False,
            expires_at__gt=now,
        ).count()

        if active_count >= settings.OTP_MAX_ACTIVE:
            return JsonResponse(
                {'error': 'Too many active codes. Please wait before requesting another.'},
                status=429,
            )

        code = _generate_code()
        expires_at = now + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)

        OTPRequest.objects.create(
            identifier=identifier,
            identifier_type=identifier_type,
            code=code,
            expires_at=expires_at,
        )

        logger.info('[OTP] Created code for %s (type=%s)', identifier, identifier_type)

        sent = _send_otp(identifier, identifier_type, code)
        if not sent:
            return JsonResponse({'error': 'Failed to send verification code'}, status=500)

        return JsonResponse({
            'ok': True,
            'identifier_type': identifier_type,
            'expires_in': settings.OTP_EXPIRY_SECONDS,
        })


@method_decorator(csrf_exempt, name='dispatch')
class OTPVerifyView(View):
    """Verify an OTP code and log in.

    POST /api/v1/auth/otp/verify/
    Body: { "identifier": "user@example.com", "code": "123456" }
    """

    def post(self, request):
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        identifier = body.get('identifier', '').strip().lower()
        code = body.get('code', '').strip()

        if not identifier or not code:
            return JsonResponse({'error': 'Identifier and code required'}, status=400)

        now = timezone.now()

        # Find the most recent matching OTP
        otp = (
            OTPRequest.objects
            .filter(identifier=identifier, is_used=False, expires_at__gt=now)
            .order_by('-created_at')
            .first()
        )

        if not otp:
            return JsonResponse({'ok': False, 'error': 'expired'}, status=400)

        if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            return JsonResponse({'ok': False, 'error': 'too_many_attempts'}, status=400)

        if not hmac.compare_digest(otp.code, code):
            otp.attempts += 1
            otp.save(update_fields=['attempts'])
            remaining = settings.OTP_MAX_ATTEMPTS - otp.attempts
            logger.warning('[OTP] Invalid code for %s, %d attempts remaining', identifier, remaining)
            return JsonResponse({'ok': False, 'error': 'invalid_code', 'attempts_remaining': remaining}, status=400)

        # Code is valid - mark as used and create/find user atomically
        with transaction.atomic():
            otp.is_used = True
            otp.save(update_fields=['is_used'])
            logger.info('[OTP] Code verified for %s', identifier)

            # Find or create user
            identifier_type = otp.identifier_type
            is_admin = identifier in (settings.ADMIN_IDENTIFIERS or [])

            if identifier_type == 'email':
                try:
                    user = User.objects.get(email=identifier)
                    created = False
                except User.DoesNotExist:
                    # Generate a unique username from the email prefix
                    base_username = identifier.split('@')[0]
                    username = base_username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        username = f'{base_username}_{counter}'
                        counter += 1
                    user = User.objects.create(username=username, email=identifier)
                    created = True
            else:
                # Phone-based: look up by profile
                profile = UserProfile.objects.filter(phone=identifier).select_related('user').first()
                if profile:
                    user = profile.user
                    created = False
                else:
                    # Create user with phone-derived username
                    base_username = f'user_{identifier[-4:]}'
                    username = base_username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        username = f'{base_username}_{counter}'
                        counter += 1
                    user = User.objects.create(username=username)
                    UserProfile.objects.create(user=user, phone=identifier)
                    created = True

            # Ensure profile exists for email users too
            profile, _ = UserProfile.objects.get_or_create(user=user)

            if is_admin:
                user.is_staff = True
                user.save(update_fields=['is_staff'])

        login(request, user)
        get_token(request)  # ensure CSRF cookie

        is_new = created or not profile.display_name
        logger.info('[OTP] Logged in %s (user=%s, is_new=%s, is_staff=%s)', identifier, user.username, is_new, user.is_staff)

        return JsonResponse({
            'ok': True,
            'is_new': is_new,
            'user': {
                'username': user.username,
                'is_staff': user.is_staff,
                'display_name': profile.display_name,
            },
        })


@method_decorator(csrf_exempt, name='dispatch')
class OTPSetNameView(View):
    """Set the display name for a newly created user.

    POST /api/v1/auth/otp/set-name/
    Body: { "display_name": "Alice" }
    """

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Not authenticated'}, status=401)

        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        display_name = body.get('display_name', '').strip()
        if not display_name:
            return JsonResponse({'error': 'Display name required'}, status=400)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.display_name = display_name
        profile.save(update_fields=['display_name'])

        logger.info('[OTP] Set display name for %s: %s', request.user.username, display_name)

        return JsonResponse({
            'ok': True,
            'user': {
                'username': request.user.username,
                'is_staff': request.user.is_staff,
                'display_name': display_name,
            },
        })
