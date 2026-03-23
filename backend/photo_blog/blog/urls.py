from django.urls import path
from rest_framework.routers import DefaultRouter
from .auth_views import LoginView, LogoutView, UserView
from .layout_views import LayoutCreateView, LayoutRetrieveView
from .interaction_views import ToggleReactionView, CommentListCreateView, CommentDeleteView, TagAddView, TagRemoveView, PopTagAddView, PopTagRemoveView
from .otp_views import OTPRequestView, OTPVerifyView, OTPSetNameView
from .views import (
    CategoryCreateView,
    CategoryDeleteView,
    CategoryviewSet,
    PhotoListView,
    PhotoPatchView,
    PhotoUploadView,
    TrashEmptyView,
    TrashPurgeView,
    TrashRestoreView,
    TrashView,
    TrashedPhotoListView,
)

router = DefaultRouter()
router.register(r'photos', PhotoListView, basename='photo')
router.register(r'categories', CategoryviewSet, basename='category')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/user/', UserView.as_view(), name='auth-user'),
    path('auth/otp/request/', OTPRequestView.as_view(), name='otp-request'),
    path('auth/otp/verify/', OTPVerifyView.as_view(), name='otp-verify'),
    path('auth/otp/set-name/', OTPSetNameView.as_view(), name='otp-set-name'),
    path('categories/create/', CategoryCreateView.as_view(), name='category-create'),
    path('categories/<slug:slug>/delete/', CategoryDeleteView.as_view(), name='category-delete'),
    path('photos/<slug:slug>/react/', ToggleReactionView.as_view(), name='photo-react'),
    path('photos/<slug:slug>/comments/', CommentListCreateView.as_view(), name='photo-comments'),
    path('photos/<slug:slug>/comments/<uuid:pk>/', CommentDeleteView.as_view(), name='photo-comment-delete'),
    path('photos/<slug:slug>/tags/', TagAddView.as_view(), name='photo-tag-add'),
    path('photos/<slug:slug>/tags/<uuid:pk>/', TagRemoveView.as_view(), name='photo-tag-remove'),
    path('photos/<slug:slug>/pop-tags/', PopTagAddView.as_view(), name='photo-pop-tag-add'),
    path('photos/<slug:slug>/pop-tags/<uuid:pk>/', PopTagRemoveView.as_view(), name='photo-pop-tag-remove'),
    path('photos/<slug:slug>/patch/', PhotoPatchView.as_view(), name='photo-patch'),
    path('photos/upload/', PhotoUploadView.as_view(), name='photo-upload'),
    path('photos/trash/', TrashView.as_view(), name='photo-trash'),
    path('photos/trash/list/', TrashedPhotoListView.as_view(), name='photo-trash-list'),
    path('photos/trash/restore/', TrashRestoreView.as_view(), name='photo-trash-restore'),
    path('photos/trash/purge/', TrashPurgeView.as_view(), name='photo-trash-purge'),
    path('photos/trash/empty/', TrashEmptyView.as_view(), name='photo-trash-empty'),
    path('layouts/', LayoutCreateView.as_view(), name='layout-create'),
    path('layouts/<slug:slug>/', LayoutRetrieveView.as_view(), name='layout-retrieve'),
] + router.urls