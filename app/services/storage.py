import io
import logging
import uuid
from pathlib import Path
from typing import Optional, Tuple
from app.config import settings

log = logging.getLogger(__name__)

# Ensure local fallback directory exists
settings.uploads_dir.mkdir(parents=True, exist_ok=True)


def get_s3_client():
    """Create boto3 S3 client targeted at DigitalOcean Spaces."""
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        region_name=settings.do_spaces_region,
        endpoint_url=settings.do_spaces_endpoint,
        aws_access_key_id=settings.do_spaces_key,
        aws_secret_access_key=settings.do_spaces_secret,
        config=Config(signature_version="s3v4"),
    )


def save_upload(
    file_bytes: bytes,
    original_filename: str,
    folder: str = "general",
    content_type: str = "image/jpeg",
) -> Tuple[str, Path]:
    """Save an uploaded file to DigitalOcean Spaces (or local fallback).

    Returns:
        Tuple[str, Path]: (public_url_or_relative_path, local_cached_path)
    """
    ext = Path(original_filename).suffix or ".jpg"
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    subfolder = folder.strip("/\\")
    
    # Always keep a local copy for Gemma multimodal processing
    local_target_dir = settings.uploads_dir / subfolder
    local_target_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_target_dir / unique_name
    local_path.write_bytes(file_bytes)

    if settings.has_do_spaces:
        object_key = f"{subfolder}/{unique_name}"
        try:
            s3 = get_s3_client()
            s3.put_object(
                Bucket=settings.do_spaces_bucket,
                Key=object_key,
                Body=file_bytes,
                ACL="public-read",
                ContentType=content_type,
            )
            # DigitalOcean Spaces standard URL format
            endpoint = settings.do_spaces_endpoint.rstrip("/")
            public_url = f"{endpoint}/{settings.do_spaces_bucket}/{object_key}"
            log.info("Uploaded to DigitalOcean Spaces: %s", public_url)
            return public_url, local_path
        except Exception as exc:
            log.error("Failed uploading to DigitalOcean Spaces, falling back to local: %s", exc)

    # Local fallback URL
    local_url = f"/uploads/{subfolder}/{unique_name}"
    return local_url, local_path
