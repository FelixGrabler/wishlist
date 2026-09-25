"""Normalize uploaded pictures; never crop, upscale, or retain camera metadata."""
from io import BytesIO
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_EDGE = 400
TARGET_BYTES = 30 * 1024
MAX_PIXELS = 40_000_000


def compress_image(raw: bytes) -> bytes:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as source:
                if source.width * source.height > MAX_PIXELS:
                    raise HTTPException(413, "Das Bild hat zu viele Pixel (maximal 40 Megapixel).")
                # Preserve optimized uploads and their color profile without a second
                # lossy encode; EXIF/XMP camera metadata still requires normalization.
                if (source.format == "WEBP" and not getattr(source, "is_animated", False)
                        and max(source.size) <= MAX_EDGE and len(raw) <= TARGET_BYTES
                        and not source.info.get("exif")
                        and not source.info.get("xmp")):
                    source.load()
                    return raw
                image = ImageOps.exif_transpose(source).convert("RGBA")
                image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                while True:
                    for quality in (85, 75, 65, 55, 45, 35):
                        output = BytesIO()
                        image.save(output, format="WEBP", quality=quality, method=6)
                        encoded = output.getvalue()
                        if len(encoded) <= TARGET_BYTES:
                            return encoded
                    image = image.resize((max(1, round(image.width * 0.85)),
                                          max(1, round(image.height * 0.85))), Image.Resampling.LANCZOS)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(413, "Das Bild hat zu viele Pixel.") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(422, "Das Bild konnte nicht gelesen werden.") from exc
