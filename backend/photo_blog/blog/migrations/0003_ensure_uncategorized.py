"""Ensure a default 'Uncategorized' category exists."""

from django.db import migrations


def create_uncategorized(apps, schema_editor):
    Category = apps.get_model('blog', 'Category')
    Category.objects.get_or_create(
        slug='uncategorized',
        defaults={'name': 'Uncategorized', 'sort_order': 9999},
    )


def remove_uncategorized(apps, schema_editor):
    Category = apps.get_model('blog', 'Category')
    Category.objects.filter(slug='uncategorized').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('blog', '0002_photo_is_trashed_photo_trashed_at'),
    ]

    operations = [
        migrations.RunPython(create_uncategorized, remove_uncategorized),
    ]
