import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import blurhash
import boto3
import exifread
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from PIL import Image

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    pass


def _get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name='auto',
    )


def process_upload(file_obj: UploadedFile, photo_id: uuid.UUID):
    """
    Run the full upload pipeline for a photo.

    Accepts a Django uploaded file object and the pre-generated photo UUID.
    Returns a dict of fields ready to be set on the Photo instance.
    Raises PipelineError on any failure, attempting R2 cleanup where possible.
    """
    file_bytes = file_obj.read()
    file_size = len(file_bytes)

    # Force full image decode immediately — catches corrupt files before
    # we spend time uploading them to R2.
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.load()
    except Exception as e:
        raise PipelineError(f"Could not open image: {e}") from e

    width, height = image.size
    name = file_obj.name or ''
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else 'jpg'

    original_key = f"photos/originals/{photo_id}.{ext}"
    thumbnail_key = f"photos/thumbnails/{photo_id}.webp"

    client = _get_r2_client()

    # --- R2: upload original ---
    try:
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=original_key,
            Body=file_bytes,
            ContentType=file_obj.content_type or 'application/octet-stream',
        )
    except (BotoCoreError, ClientError) as e:
        raise PipelineError(f"R2 upload failed for original: {e}") from e

    # --- R2: upload thumbnail ---
    thumbnail_bytes = _generate_thumbnail(image)
    try:
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=thumbnail_key,
            Body=thumbnail_bytes,
            ContentType='image/webp',
        )
    except (BotoCoreError, ClientError) as e:
        _try_delete(client, original_key)
        raise PipelineError(f"R2 upload failed for thumbnail: {e}") from e

    # Both R2 objects are now uploaded. Any failure from here must clean them up.
    try:
        exif_data = _extract_exif(file_bytes)
        bh = _generate_blurhash(image)
    except Exception as e:
        _try_delete(client, original_key)
        _try_delete(client, thumbnail_key)
        raise PipelineError(f"Post-upload processing failed: {e}") from e

    return {
        'original_key': original_key,
        'thumbnail_key': thumbnail_key,
        'file_size': file_size,
        'width': width,
        'height': height,
        'blurhash': bh,
        **exif_data,
    }


def _generate_thumbnail(image: Image.Image) -> bytes:
    # convert('RGB') handles PNGs with alpha channel and other non-RGB modes.
    # Saving as WEBP without the original EXIF strips GPS data from the thumbnail.
    thumb = image.convert('RGB')
    thumb.thumbnail((600, 9999), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    thumb.save(buf, format='WEBP', quality=85)
    return buf.getvalue()


def _generate_blurhash(image: Image.Image) -> str:
    # Blurhash only needs a rough color sample — 64px is more than sufficient
    # and keeps encoding fast.
    small = image.convert('RGB')
    small.thumbnail((64, 64), Image.Resampling.LANCZOS)
    w, h = small.size
    # blurhash expects pixels[y][x] = (r, g, b) — a 2D list of rows
    pixels = [[small.getpixel((x, y)) for x in range(w)] for y in range(h)]
    return blurhash.encode(pixels, components_x=4, components_y=3)


def _extract_exif(file_bytes: bytes) -> dict[str, Any]:
    tags = exifread.process_file(io.BytesIO(file_bytes), details=False)
    result = {}

    if 'EXIF DateTimeOriginal' in tags:
        dt_str = str(tags['EXIF DateTimeOriginal'])
        try:
            # EXIF timestamps have no timezone — treat as UTC.
            result['taken_at'] = datetime.strptime(dt_str, '%Y:%m:%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except ValueError:
            logger.warning("Could not parse DateTimeOriginal: %s", dt_str)

    str_fields = {
        'Image Make':        'camera_make',
        'Image Model':       'camera_model',
        'EXIF LensModel':    'lens',
        'EXIF FocalLength':  'focal_length',
        'EXIF FNumber':      'aperture',
        'EXIF ExposureTime': 'shutter_speed',
    }
    for tag, field in str_fields.items():
        if tag in tags:
            result[field] = str(tags[tag]).strip()

    if 'EXIF ISOSpeedRatings' in tags:
        try:
            result['iso'] = int(str(tags['EXIF ISOSpeedRatings']))
        except ValueError:
            pass

    return result


def delete_from_r2(original_key: str, thumbnail_key: str) -> None:
    """Delete both R2 objects for a photo. Logs failures but does not raise."""
    client = _get_r2_client()
    _try_delete(client, original_key)
    _try_delete(client, thumbnail_key)


def _try_delete(client: Any, key: str) -> None:
    """Best-effort R2 cleanup. Logs but does not raise."""
    try:
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
    except Exception:
        logger.exception("Failed to clean up R2 object %s after pipeline error", key)
