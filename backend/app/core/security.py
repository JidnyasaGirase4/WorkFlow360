"""Password hashing, JWT creation/verification and opaque one-time tokens."""
import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

ACCESS = "access"
REFRESH = "refresh"

_PASSWORD_RULES = (
    (r".{8,}", "at least 8 characters"),
    (r"[a-z]", "a lowercase letter"),
    (r"[A-Z]", "an uppercase letter"),
    (r"\d", "a number"),
)


def password_problems(password: str) -> list[str]:
    return [label for pattern, label in _PASSWORD_RULES if not re.search(pattern, password)]


def hash_password(password: str) -> str:
    # bcrypt only reads the first 72 bytes; reject longer input rather than silently truncating.
    raw = password.encode()
    if len(raw) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], password_hash.encode())
    except ValueError:
        return False


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_opaque_token() -> str:
    """URL-safe random token for password reset / email verification links."""
    return secrets.token_urlsafe(32)


def _encode(payload: dict[str, Any], expires: timedelta, token_type: str) -> tuple[str, str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    jti = uuid.uuid4().hex
    exp = now + expires
    token = jwt.encode(
        {**payload, "type": token_type, "jti": jti, "iat": now, "exp": exp},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, jti, exp.replace(tzinfo=None)


def create_access_token(user_id: int, role: str, company_id: int | None) -> str:
    settings = get_settings()
    token, _, _ = _encode(
        {"sub": str(user_id), "role": role, "company_id": company_id},
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
        ACCESS,
    )
    return token


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Returns (jwt, jti, naive-UTC expiry). The jti is what gets stored (hashed) server-side."""
    settings = get_settings()
    return _encode({"sub": str(user_id)}, timedelta(days=settings.jwt_refresh_token_expire_days), REFRESH)


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token has expired") from None
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid token") from None
    if payload.get("type") != expected_type:
        raise UnauthorizedError("Invalid token type")
    return payload
