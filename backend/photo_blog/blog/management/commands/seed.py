import uuid
from django.core.management.base import BaseCommand
from blog.models import Category, Photo


class Command(BaseCommand):
    help = 'Seed the database with test data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=15,
            help='Number of photos to create per category',
        )

    def handle(self, *args, **options):
        count = options['count']

        categories_data = [
            ('street', 'Street', 1),
            ('landscape', 'Landscape', 2),
            ('portrait', 'Portrait', 3),
        ]

        for slug, name, order in categories_data:
            Category.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'sort_order': order}
            )

        categories = list(Category.objects.all())
        created = 0

        for i in range(count * len(categories)):
            uid = uuid.uuid4()
            _, was_created = Photo.objects.get_or_create(
                slug=f'test-photo-{i}',
                defaults={
                    'title': f'Test Photo {i}',
                    'category': categories[i % len(categories)],
                    'width': 4000,
                    'height': 3000,
                    'file_size': 8_000_000,
                    'blurhash': 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
                    'original_key': f'photos/originals/{uid}.jpg',
                    'thumbnail_key': f'photos/thumbnails/{uid}.webp',
                }
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created} photos'))
