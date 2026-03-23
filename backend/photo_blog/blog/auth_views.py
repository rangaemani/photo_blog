import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    def post(self, request):
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        username = body.get('username', '').strip()
        password = body.get('password', '')
        if not username or not password:
            return JsonResponse({'error': 'Username and password required'}, status=400)

        user = authenticate(request, username=username, password=password)
        if user is None:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)

        login(request, user)
        get_token(request)
        return JsonResponse({
            'ok': True,
            'user': {'username': user.get_username(), 'is_staff': getattr(user, 'is_staff', False)},
        })


@method_decorator(ensure_csrf_cookie, name='dispatch')
class LogoutView(View):
    def post(self, request):
        logout(request)
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class CsrfTokenView(View):
    def get(self, request):
        return JsonResponse({'csrfToken': get_token(request)})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class UserView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Not authenticated'}, status=401)

        display_name = ''
        try:
            display_name = request.user.profile.display_name
        except Exception:
            pass

        return JsonResponse({
            'username': request.user.username,
            'is_staff': request.user.is_staff,
            'display_name': display_name,
        })
