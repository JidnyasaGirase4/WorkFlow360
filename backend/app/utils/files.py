"""Upload validation and safe local storage. Swap `save_upload` for cloud storage later."""
import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.core.exceptions import BadRequestError, NotFoundError, UnprocessableError

# extension -> MIME types we accept for it. The extension AND the declared MIME must both match.
ALLOWED_TYPES: dict[str, set[str]] = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".gif": {"image/gif"},
    ".webp": {"image/webp"},
    ".txt": {"text/plain"},
    ".csv": {"text/csv", "application/vnd.ms-excel", "text/plain"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".ppt": {"application/vnd.ms-powerpoint"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".fig": {"application/octet-stream"},
}

# Leading bytes that identify formats we can cheaply verify (extension spoofing check).
_MAGIC: dict[str, bytes] = {
    ".pdf": b"%PDF",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
    ".gif": b"GIF8",
    ".zip": b"PK\x03\x04",
    ".docx": b"PK\x03\x04",
    ".xlsx": b"PK\x03\x04",
    ".pptx": b"PK\x03\x04",
}


@dataclass
class StoredFile:
    original_name: str
    relative_path: str  # relative to UPLOAD_DIR, stored in MySQL
    content_type: str
    size: int


def _display_name(filename: str | None) -> str:
    name = Path((filename or "").replace("\\", "/")).name.strip()
    if not name or name in {".", ".."}:
        raise UnprocessableError("Uploaded file has no valid name")
    return name[:255]


async def save_upload(file: UploadFile, folder: str, *, allowed_extensions: set[str] | None = None) -> StoredFile:
    """Validate (extension, MIME, magic bytes, size) and store under UPLOAD_DIR/<folder>/<uuid><ext>.

    `folder` is built by the caller from trusted values only (e.g. f"{company_id}/documents").
    The client-supplied filename is kept for display; the stored name is random.
    """
    settings = get_settings()
    original = _display_name(file.filename)
    ext = Path(original).suffix.lower()
    allowed = ALLOWED_TYPES if allowed_extensions is None else {e: ALLOWED_TYPES[e] for e in allowed_extensions}
    if ext not in allowed:
        raise UnprocessableError(f"File type '{ext or 'unknown'}' is not allowed", {"file": f"Allowed: {', '.join(sorted(allowed))}"})
    declared = (file.content_type or "").split(";")[0].strip().lower()
    if declared not in allowed[ext]:
        raise UnprocessableError(f"MIME type '{declared}' does not match a {ext} file")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    dest_dir = settings.upload_path / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / stored_name

    size = 0
    magic = _MAGIC.get(ext)
    try:
        with dest.open("wb") as out:
            first = True
            while chunk := await file.read(1024 * 256):
                if first and magic and not chunk.startswith(magic):
                    raise UnprocessableError(f"File content does not look like a valid {ext} file")
                first = False
                size += len(chunk)
                if size > max_bytes:
                    raise UnprocessableError(f"File exceeds the {settings.max_upload_mb} MB limit")
                out.write(chunk)
        if size == 0:
            raise UnprocessableError("Uploaded file is empty")
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    return StoredFile(original, f"{folder}/{stored_name}", declared or mimetypes.guess_type(original)[0] or "application/octet-stream", size)


def resolve_stored_path(relative_path: str) -> Path:
    """Map a DB-stored relative path to a file, refusing anything outside UPLOAD_DIR."""
    root = get_settings().upload_path.resolve()
    path = (root / relative_path).resolve()
    if root not in path.parents or not path.is_file():
        raise NotFoundError("File not found")
    return path


def file_response(relative_path: str, download_name: str, content_type: str, *, inline: bool = False) -> FileResponse:
    """Stream a stored file. Call ONLY after the caller's access check has passed."""
    return FileResponse(
        resolve_stored_path(relative_path),
        media_type=content_type,
        filename=download_name,
        content_disposition_type="inline" if inline else "attachment",
        headers={"X-Content-Type-Options": "nosniff"},
    )


def delete_stored_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    try:
        resolve_stored_path(relative_path).unlink(missing_ok=True)
    except (NotFoundError, BadRequestError):
        pass
