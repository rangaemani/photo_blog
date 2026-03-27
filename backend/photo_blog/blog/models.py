import hashlib
import uuid

from django.db import models

# Create your models here.
class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    icon = models.CharField(max_length=50, null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    def __str__(self):
        return self.name
    
class Photo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey('Category', on_delete=models.PROTECT, related_name='photos')
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    slug = models.SlugField(max_length=255, unique=True)
    width = models.IntegerField()
    height = models.IntegerField()
    taken_at = models.DateTimeField(null=True, blank=True)
    camera_make = models.CharField(max_length=255, null=True, blank=True)
    camera_model = models.CharField(max_length=255, null=True, blank=True)
    lens = models.CharField(max_length=255, null=True, blank=True)
    focal_length = models.CharField(max_length=50, null=True, blank=True)
    aperture = models.CharField(max_length=20, null=True, blank=True)
    iso = models.IntegerField(null=True, blank=True)
    shutter_speed = models.CharField(max_length=20, null=True, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    blurhash = models.CharField(max_length=64)
    file_size = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # R2 Keys
    original_key = models.CharField(max_length=512, unique=True)
    thumbnail_key = models.CharField(max_length=512, unique=True)

    # Soft delete
    is_trashed = models.BooleanField(default=False, db_index=True)
    trashed_at = models.DateTimeField(null=True, blank=True)

    # Moderation
    is_reported = models.BooleanField(default=False, db_index=True)


    def __str__(self):
        return self.title
    
    class Meta:
        indexes = [models.Index(fields=['-taken_at']), models.Index(fields=['created_at'])]
        ordering = ['-taken_at', '-created_at']



# === OTP Authentication ===

class UserProfile(models.Model):
    """Extended user profile for OTP-based auth."""
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    display_name = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        return f'{self.display_name or self.user.username}'


class OTPRequest(models.Model):
    """Tracks OTP codes sent for passwordless authentication."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    identifier = models.CharField(max_length=255, db_index=True)  # email or phone (E.164)
    identifier_type = models.CharField(max_length=10, choices=[('email', 'Email'), ('phone', 'Phone')])
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=['identifier', '-created_at'])]

    def __str__(self):
        return f'OTP for {self.identifier} ({self.identifier_type})'


# === Tags ===

class Tag(models.Model):
    """A user-contributed tag on a photo. Unique text per photo."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey('Photo', on_delete=models.CASCADE, related_name='tags')
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='tags')
    text = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('photo', 'text')]
        indexes = [models.Index(fields=['photo'])]

    def __str__(self):
        return f'#{self.text} on {self.photo}'


class PopTag(models.Model):
    """A positioned label on a photo (like Instagram's person tags)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey('Photo', on_delete=models.CASCADE, related_name='pop_tags')
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='pop_tags')
    label = models.CharField(max_length=50)
    x = models.FloatField()  # 0-1, percentage from left
    y = models.FloatField()  # 0-1, percentage from top
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['photo'])]

    def __str__(self):
        return f'"{self.label}" at ({self.x:.2f}, {self.y:.2f}) on {self.photo}'


# === Interactions ===

class Reaction(models.Model):
    """An emoji reaction on a photo. One per user per emoji per photo."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey('Photo', on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='reactions')
    emoji = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('photo', 'user', 'emoji')]
        indexes = [models.Index(fields=['photo'])]

    def __str__(self):
        return f'{self.emoji} by {self.user} on {self.photo}'


class Comment(models.Model):
    """A text comment on a photo."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey('Photo', on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='comments')
    text = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['photo', '-created_at'])]

    def __str__(self):
        return f'Comment by {self.user} on {self.photo}'


# === Reports ===

class Report(models.Model):
    """A user-submitted report on a photo and/or its user-generated content."""

    STATUS_PENDING = 'pending'
    STATUS_REVIEWED = 'reviewed'
    STATUS_DISMISSED = 'dismissed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_REVIEWED, 'Reviewed'),
        (STATUS_DISMISSED, 'Dismissed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey('Photo', on_delete=models.CASCADE, related_name='reports')
    # JSON list of {type, id?} — type in [image, tag, pop_tag, comment]
    targets = models.JSONField()
    reason = models.TextField(max_length=500, blank=True, default='')
    reporter_ip = models.GenericIPAddressField(null=True, blank=True)
    reporter_user = models.ForeignKey(
        'auth.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reports',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['photo', 'status'])]

    def __str__(self):
        return f'Report on {self.photo} ({self.status})'


# === Shared Layouts ===

class SharedLayout(models.Model):
    """Stores a guest desktop layout blob for sharing via short URL."""
    slug = models.CharField(max_length=12, unique=True, db_index=True)
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['created_at'])]

    def __str__(self):
        return f'Layout {self.slug}'

    @staticmethod
    def slug_from_data(data: dict) -> str:
        """Deterministic slug from content hash — same layout = same URL."""
        raw = hashlib.sha256(
            # Sort keys for deterministic hashing
            __import__('json').dumps(data, sort_keys=True).encode()
        ).hexdigest()
        return raw[:10]