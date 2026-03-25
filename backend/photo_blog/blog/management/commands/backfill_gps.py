"""
Backfill GPS coordinates for photos uploaded before lat/lng fields were added.

Fetches each photo's original from R2, re-parses GPS EXIF tags, and saves
lat/lng if found. Skips photos that already have coordinates.

Usage:
    python manage.py backfill_gps            # dry run — shows what would change
    python manage.py backfill_gps --write    # apply updates
    python manage.py backfill_gps --write --photo <uuid>  # single photo
"""

import io
import logging

import boto3
import exifread
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from blog.models import Photo

logger = logging.getLogger(__name__)


def _parse_gps(file_bytes: bytes) -> tuple[float, float] | None:
    """Return (lat, lng) decimal degrees from raw file bytes, or None if absent/unparseable."""
    tags = exifread.process_file(io.BytesIO(file_bytes), details=False)
    result = {}
    for coord_tag, ref_tag, field in [
        ('GPS GPSLatitude',  'GPS GPSLatitudeRef',  'lat'),
        ('GPS GPSLongitude', 'GPS GPSLongitudeRef', 'lng'),
    ]:
        if coord_tag not in tags:
            return None
        try:
            parts = [float(x.num) / float(x.den) for x in tags[coord_tag].values]
            if len(parts) != 3:
                return None
            dd = parts[0] + parts[1] / 60 + parts[2] / 3600
            ref = str(tags.get(ref_tag, '')).strip().upper()
            if ref in ('S', 'W'):
                dd = -dd
            result[field] = dd
        except (AttributeError, ZeroDivisionError, ValueError) as e:
            logger.warning("GPS parse error on %s: %s", coord_tag, e)
            return None

    if 'lat' in result and 'lng' in result:
        return result['lat'], result['lng']
    return None


class Command(BaseCommand):
    help = 'Backfill lat/lng from EXIF GPS for photos missing coordinates'

    def add_arguments(self, parser):
        parser.add_argument(
            '--write',
            action='store_true',
            help='Persist updates to the database (default is dry-run)',
        )
        parser.add_argument(
            '--photo',
            metavar='UUID',
            help='Process a single photo by ID instead of all',
        )

    def handle(self, *args, **options):
        write = options['write']
        photo_id = options.get('photo')

        if not write:
            self.stdout.write(self.style.WARNING('Dry run — pass --write to apply changes\n'))

        r2 = boto3.client(
            's3',
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name='auto',
        )

        qs = Photo.objects.filter(lat__isnull=True, lng__isnull=True)
        if photo_id:
            qs = qs.filter(pk=photo_id)
            if not qs.exists():
                raise CommandError(f'Photo {photo_id} not found or already has coordinates')

        total = qs.count()
        if total == 0:
            self.stdout.write('No photos missing GPS coordinates.')
            return

        self.stdout.write(f'Processing {total} photo(s)...\n')

        found = skipped = failed = 0

        for photo in qs.iterator():
            try:
                resp = r2.get_object(Bucket=settings.R2_BUCKET_NAME, Key=photo.original_key)
                file_bytes = resp['Body'].read()
            except (BotoCoreError, ClientError) as e:
                self.stderr.write(f'  SKIP  {photo.id} — R2 fetch failed: {e}')
                failed += 1
                continue

            coords = _parse_gps(file_bytes)
            if coords is None:
                self.stdout.write(f'  —     {photo.id} ({photo.title}) — no GPS data')
                skipped += 1
                continue

            lat, lng = coords
            self.stdout.write(f'  FOUND {photo.id} ({photo.title}) → {lat:.5f}, {lng:.5f}')
            found += 1

            if write:
                photo.lat = lat
                photo.lng = lng
                photo.save(update_fields=['lat', 'lng'])

        self.stdout.write('')
        suffix = '' if write else ' (dry run)'
        self.stdout.write(self.style.SUCCESS(
            f'Done{suffix}: {found} updated, {skipped} no GPS, {failed} R2 errors'
        ))
