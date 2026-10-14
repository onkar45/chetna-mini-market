import os
import uuid
import logging
from typing import Dict, Tuple
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed MIME types and corresponding file extensions
ALLOWED_IMAGE_TYPES: Dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# 15 MB maximum file upload size (comfortably supports full camera captures)
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

# Directory for local static file storage fallback
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary environment credentials are fully provided."""
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def configure_cloudinary():
    """Lazy initialize Cloudinary SDK configuration."""
    if is_cloudinary_configured():
        import cloudinary
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )


async def validate_image_file(file: UploadFile) -> Tuple[bytes, str]:
    """Validate image MIME type and file size with magic byte and extension fallback.
    
    Returns:
        Tuple of (file_bytes, extension)
    """
    raw_content_type = (file.content_type or "").split(";")[0].strip().lower()

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
        )

    # Detect MIME type from header or magic bytes / filename
    detected_type = None
    if raw_content_type in ALLOWED_IMAGE_TYPES:
        detected_type = raw_content_type
    elif file_bytes.startswith(b"\xff\xd8\xff"):
        detected_type = "image/jpeg"
    elif file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_type = "image/png"
    elif len(file_bytes) > 12 and file_bytes[8:12] == b"WEBP":
        detected_type = "image/webp"
    elif file.filename:
        fn = file.filename.lower()
        if fn.endswith((".jpg", ".jpeg")):
            detected_type = "image/jpeg"
        elif fn.endswith(".png"):
            detected_type = "image/png"
        elif fn.endswith(".webp"):
            detected_type = "image/webp"

    if not detected_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type '{raw_content_type}'. Allowed types: JPEG, PNG, WEBP.",
        )

    extension = ALLOWED_IMAGE_TYPES[detected_type]
    return file_bytes, extension


async def upload_product_image(file: UploadFile) -> Dict[str, str]:
    """Upload product image to Cloudinary (if configured) or local static storage (fallback).
    
    Returns:
        Dict with "image_url" and "image_public_id"
    """
    file_bytes, extension = await validate_image_file(file)

    if is_cloudinary_configured():
        try:
            import cloudinary.uploader
            configure_cloudinary()
            
            result = cloudinary.uploader.upload(
                file_bytes,
                folder=settings.CLOUDINARY_FOLDER,
                resource_type="image",
                transformation=[
                    {"width": 800, "height": 800, "crop": "limit", "quality": "auto"}
                ],
            )
            return {
                "image_url": result["secure_url"],
                "image_public_id": result["public_id"],
            }
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Cloud image upload failed: {str(e)}",
            )

    # Local storage fallback (for local development or testing without cloud credentials)
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return {
        "image_url": f"/static/uploads/{unique_filename}",
        "image_public_id": f"local_{unique_filename}",
    }


def delete_product_image(public_id: str) -> bool:
    """Delete image from Cloudinary or local storage.
    
    Never raises an exception so calling workflows can complete successfully.
    """
    if not public_id:
        return False

    try:
        if public_id.startswith("local_"):
            filename = public_id.replace("local_", "", 1)
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False

        if is_cloudinary_configured():
            import cloudinary.uploader
            configure_cloudinary()
            res = cloudinary.uploader.destroy(public_id, invalidate=True)
            return res.get("result") == "ok"
    except Exception as e:
        logger.warning(f"Failed to delete product image asset '{public_id}': {e}")
        return False

    return False
