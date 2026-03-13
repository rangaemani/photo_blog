from django import forms
from django.contrib import admin, messages

from .models import Category, Photo, Reaction, Comment
from .pipeline import PipelineError, process_upload


class PhotoUploadForm(forms.ModelForm):
    file = forms.ImageField(
        help_text="Upload the original photo. Thumbnail, EXIF data, and blurhash are generated automatically."
    )

    class Meta:
        model = Photo
        fields = ['title', 'slug', 'category', 'description', 'file']


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'taken_at', 'created_at', 'is_trashed')
    list_filter = ('category', 'is_trashed')
    search_fields = ('title', 'slug')
    prepopulated_fields = {'slug': ('title',)}

    def get_form(self, request, obj=None, **kwargs): # pyright: ignore[reportIncompatibleMethodOverride]
        if obj is None:
            kwargs['form'] = PhotoUploadForm
        return super().get_form(request, obj, **kwargs)

    def get_readonly_fields(self, request, obj=None):
        base = ('id', 'created_at', 'updated_at')
        if obj is not None:
            # On the change view, pipeline-populated fields are read-only.
            # There's no legitimate reason to manually edit R2 keys or EXIF.
            return base + (
                'original_key', 'thumbnail_key', 'file_size', 'width', 'height', 'blurhash',
                'taken_at', 'camera_make', 'camera_model', 'lens', 'focal_length',
                'aperture', 'shutter_speed', 'iso',
            )
        return base

    def get_fieldsets(self, request, obj=None): # pyright: ignore[reportIncompatibleMethodOverride]
        if obj is None:
            return [
                (None, {'fields': ['title', 'slug', 'category', 'description', 'file']}),
            ]
        return [
            (None, {'fields': ['id', 'title', 'slug', 'category', 'description']}),
            ('File', {'fields': ['original_key', 'thumbnail_key', 'file_size', 'width', 'height', 'blurhash']}),
            ('EXIF', {
                'fields': ['taken_at', 'camera_make', 'camera_model', 'lens', 'focal_length', 'aperture', 'shutter_speed', 'iso'],
                'classes': ['collapse'],
            }),
            ('Timestamps', {'fields': ['created_at', 'updated_at'], 'classes': ['collapse']}),
        ]

    def save_model(self, request, obj, form, change):
        if not change:
            file = form.cleaned_data['file']
            try:
                pipeline_data = process_upload(file, photo_id=obj.id)
            except PipelineError as e:
                raise forms.ValidationError(str(e)) from e                                
            for field, value in pipeline_data.items():
                setattr(obj, field, value)
        obj.save()


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'sort_order')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('id',)


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ('emoji', 'user', 'photo', 'created_at')
    list_filter = ('emoji',)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('user', 'photo', 'text', 'created_at')
    search_fields = ('text',)
