from rest_framework import serializers

from django.conf import settings
from django.db.models import Count
from .models import Category, Photo, Comment, PopTag, Report, Tag, UserProfile

class CategorySerializer(serializers.ModelSerializer):
    photo_count = serializers.IntegerField(read_only=True)

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'photo_count']

class PhotoListSerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()
    category_slug = serializers.SlugRelatedField(source='category', slug_field='slug', read_only=True)

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Photo
        fields = ['id', 'title', 'slug', 'thumbnail_url', 'width', 'height', 'category_slug', 'blurhash', 'taken_at', 'lat', 'lng', 'is_reported']

    def get_thumbnail_url(self, obj: Photo) -> str:
        return f'{settings.R2_BASE_URL}/{obj.thumbnail_key}'

class PhotoDetailSerializer(PhotoListSerializer):
    original_url = serializers.SerializerMethodField()
    reaction_summary = serializers.SerializerMethodField()
    user_reactions = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    pop_tags = serializers.SerializerMethodField()

    class Meta(PhotoListSerializer.Meta):
        fields = PhotoListSerializer.Meta.fields + [
            'original_url', 'description', 'camera_make', 'camera_model',
            'lens', 'focal_length', 'aperture', 'iso', 'shutter_speed', 'file_size',
            'reaction_summary', 'user_reactions', 'comment_count', 'tags', 'pop_tags',
        ]

    def get_original_url(self, obj: Photo) -> str:
        return f'{settings.R2_BASE_URL}/{obj.original_key}'

    def get_reaction_summary(self, obj: Photo) -> dict[str, int]:
        return dict(
            obj.reactions.values_list('emoji')
            .annotate(count=Count('id'))
            .values_list('emoji', 'count')
        )

    def get_user_reactions(self, obj: Photo) -> list[str]:
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return list(obj.reactions.filter(user=request.user).values_list('emoji', flat=True))
        return []

    def get_comment_count(self, obj: Photo) -> int:
        return obj.comments.count()

    def get_tags(self, obj: Photo) -> list[dict]:
        return list(obj.tags.values('id', 'text', 'user__username').order_by('created_at'))

    def get_pop_tags(self, obj: Photo) -> list[dict]:
        return list(obj.pop_tags.values('id', 'label', 'x', 'y', 'user__username').order_by('created_at'))


class TrashedPhotoSerializer(PhotoListSerializer):
    class Meta(PhotoListSerializer.Meta):
        fields = PhotoListSerializer.Meta.fields + ['trashed_at']


class PhotoUploadSerializer(serializers.Serializer):
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

    file = serializers.ImageField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    category = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Category.objects.all(),
    )

    def validate_file(self, value):
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(f'File too large. Maximum size is {self.MAX_FILE_SIZE // (1024 * 1024)} MB.')
        return value


class PhotoCategoryPatchSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Category.objects.all(),
    )

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Photo
        fields = ['category']

class PhotoGeotagPatchSerializer(serializers.ModelSerializer):
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Photo
        fields = ['lat', 'lng']
        extra_kwargs = {'lat': {'required': False, 'allow_null': True}, 'lng': {'required': False, 'allow_null': True}}


class CategoryCreateSerializer(serializers.ModelSerializer):
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Category
        fields = ['name']

    def create(self, validated_data):
        from django.utils.text import slugify
        name = validated_data['name']
        slug = slugify(name)
        base_slug = slug
        counter = 1
        while Category.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1
        return Category.objects.create(name=name, slug=slug)


class TrashActionSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )


class CommentSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Comment
        fields = ['id', 'text', 'display_name', 'created_at']

    def get_display_name(self, obj: Comment) -> str:
        try:
            return obj.user.profile.display_name or obj.user.username
        except UserProfile.DoesNotExist:
            return obj.user.username


class CommentCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500, min_length=1)


class ReportTargetSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=['image', 'tag', 'pop_tag', 'comment'])
    id = serializers.UUIDField(required=False)

    def validate(self, attrs: dict) -> dict:
        if attrs['type'] != 'image' and 'id' not in attrs:
            raise serializers.ValidationError("'id' is required for non-image targets.")
        if attrs['type'] == 'image' and 'id' in attrs:
            raise serializers.ValidationError("'id' must not be provided for image targets.")
        return attrs


class ReportCreateSerializer(serializers.Serializer):
    targets = ReportTargetSerializer(many=True)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')

    def validate_targets(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError("At least one target is required.")
        return value


class AdminReportSerializer(serializers.ModelSerializer):
    photo_title = serializers.CharField(source='photo.title', read_only=True)
    photo_slug = serializers.CharField(source='photo.slug', read_only=True)
    photo_thumbnail_url = serializers.SerializerMethodField()

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Report
        fields = [
            'id', 'photo_title', 'photo_slug', 'photo_thumbnail_url',
            'targets', 'reason', 'reporter_ip', 'status', 'created_at', 'reviewed_at',
        ]

    def get_photo_thumbnail_url(self, obj: Report) -> str:
        from django.conf import settings
        return f'{settings.R2_BASE_URL}/{obj.photo.thumbnail_key}'