"""Authentication business logic: registration, login, token rotation, password flows."""
import logging
import re
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import AuthTokenPurpose, RoleName, UserStatus
from app.core.exceptions import ConflictError, UnauthorizedError, UnprocessableError, ForbiddenError
from app.core.security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    new_opaque_token,
    sha256,
    verify_password,
)
from app.database.base import utcnow
from app.models.company import Company
from app.models.role import Role
from app.models.user import AuthToken, RefreshToken, User
from app.services.activity import log_activity

logger = logging.getLogger("workflow360.auth")

# Compared against when the e-mail is unknown so login time does not reveal which e-mails exist.
_DUMMY_HASH = hash_password("Dummy-Password-1")


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "company"


def _unique_slug(db: Session, name: str) -> str:
    base, slug, n = _slugify(name), _slugify(name), 1
    while db.scalar(select(Company.id).where(Company.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    return slug


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def issue_tokens(db: Session, user: User, ip: str | None = None, user_agent: str | None = None) -> dict:
    """Creates an access/refresh pair and records the refresh token (hashed jti) so it can be revoked."""
    settings = get_settings()
    refresh, jti, expires = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=sha256(jti), expires_at=expires, ip_address=ip, user_agent=(user_agent or "")[:255] or None))
    return {
        "access_token": create_access_token(user.id, user.role.name, user.company_id),
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.jwt_access_token_expire_minutes * 60,
    }


def _create_auth_token(db: Session, user: User, purpose: AuthTokenPurpose, ttl: timedelta) -> str:
    raw = new_opaque_token()
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=sha256(raw), expires_at=utcnow() + ttl))
    return raw


def _consume_auth_token(db: Session, raw: str, purpose: AuthTokenPurpose) -> User:
    record = db.scalar(select(AuthToken).where(AuthToken.token_hash == sha256(raw), AuthToken.purpose == purpose))
    if record is None or record.used_at is not None or record.expires_at < utcnow():
        raise UnprocessableError("This link is invalid or has expired")
    record.used_at = utcnow()
    user = db.get(User, record.user_id)
    if user is None:
        raise UnprocessableError("This link is invalid or has expired")
    return user


def register(db: Session, *, name: str, email: str, phone: str | None, company_name: str, password: str, ip: str | None) -> tuple[User, str]:
    if find_user_by_email(db, email):
        raise ConflictError("An account with this email already exists", {"email": "Already registered"})
    role = db.scalar(select(Role).where(Role.name == RoleName.COMPANY_ADMIN.value))
    company = Company(name=company_name, slug=_unique_slug(db, company_name), email=email.lower())
    db.add(company)
    db.flush()
    user = User(company_id=company.id, name=name, email=email.lower(), phone=phone, password_hash=hash_password(password), role_id=role.id)
    db.add(user)
    db.flush()
    verify_token = _create_auth_token(db, user, AuthTokenPurpose.EMAIL_VERIFY, timedelta(hours=get_settings().email_verify_expire_hours))
    log_activity(db, None, "created", "company", company.id, f"Registered company {company.name}", user_id=user.id, company_id=company.id, ip=ip)
    return user, verify_token


def login(db: Session, *, email: str, password: str, ip: str | None, user_agent: str | None) -> tuple[User, dict]:
    user = find_user_by_email(db, email)
    valid = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if not user or not valid:
        raise UnauthorizedError("Invalid email or password")
    if user.status != UserStatus.ACTIVE:
        raise ForbiddenError(f"Your account is {user.status.value}. Contact your administrator.")
    user.last_login = utcnow()
    tokens = issue_tokens(db, user, ip, user_agent)
    log_activity(db, None, "login", "user", user.id, f"{user.name} signed in", user_id=user.id, company_id=user.company_id, ip=ip)
    return user, tokens


def refresh(db: Session, *, refresh_token: str, ip: str | None, user_agent: str | None) -> tuple[User, dict]:
    """Rotation: the presented refresh token is revoked and a new pair issued. Replaying an old one fails."""
    payload = decode_token(refresh_token, REFRESH)
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256(payload["jti"])))
    if record is None or record.revoked_at is not None or record.expires_at < utcnow():
        raise UnauthorizedError("Refresh token is no longer valid")
    user = db.get(User, record.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise UnauthorizedError("Account is not active")
    record.revoked_at = utcnow()
    return user, issue_tokens(db, user, ip, user_agent)


def logout(db: Session, *, refresh_token: str | None, ip: str | None) -> None:
    """Idempotent: an unknown/expired token is simply ignored."""
    if not refresh_token:
        return
    try:
        payload = decode_token(refresh_token, REFRESH)
    except UnauthorizedError:
        return
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256(payload["jti"])))
    if record and record.revoked_at is None:
        record.revoked_at = utcnow()
        user = db.get(User, record.user_id)
        if user:
            log_activity(db, None, "logout", "user", user.id, f"{user.name} signed out", user_id=user.id, company_id=user.company_id, ip=ip)


def revoke_all_sessions(db: Session, user_id: int) -> None:
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)).values(revoked_at=utcnow()))


def request_password_reset(db: Session, email: str) -> str | None:
    """Returns the raw token (for dev logging / tests) or None if no such account. Callers must not reveal which."""
    user = find_user_by_email(db, email)
    if not user or user.status != UserStatus.ACTIVE:
        return None
    return _create_auth_token(db, user, AuthTokenPurpose.PASSWORD_RESET, timedelta(minutes=get_settings().password_reset_expire_minutes))


def reset_password(db: Session, *, token: str, new_password: str, ip: str | None) -> None:
    user = _consume_auth_token(db, token, AuthTokenPurpose.PASSWORD_RESET)
    user.password_hash = hash_password(new_password)
    revoke_all_sessions(db, user.id)
    log_activity(db, None, "password_reset", "user", user.id, f"{user.name} reset their password", user_id=user.id, company_id=user.company_id, ip=ip)


def change_password(db: Session, user: User, *, current_password: str, new_password: str, ip: str | None) -> None:
    if not verify_password(current_password, user.password_hash):
        raise UnprocessableError("Current password is incorrect", {"current_password": "Incorrect"})
    user.password_hash = hash_password(new_password)
    revoke_all_sessions(db, user.id)
    log_activity(db, None, "password_change", "user", user.id, f"{user.name} changed their password", user_id=user.id, company_id=user.company_id, ip=ip)


def verify_email(db: Session, token: str) -> None:
    user = _consume_auth_token(db, token, AuthTokenPurpose.EMAIL_VERIFY)
    user.email_verified = True


def send_verification(db: Session, user: User) -> str:
    return _create_auth_token(db, user, AuthTokenPurpose.EMAIL_VERIFY, timedelta(hours=get_settings().email_verify_expire_hours))


def deliver_token(kind: str, email: str, token: str) -> None:
    """No SMTP in v1: the link is written to the server log. Replace with a mailer later."""
    logger.info("[dev mail] %s token for %s: %s", kind, email, token)
