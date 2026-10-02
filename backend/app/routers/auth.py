from fastapi import APIRouter, Request, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.deps import CurrentCtx, DbSession
from app.models.company import Company
from app.schemas.auth import (
    AuthResult,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MeOut,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services import auth as auth_service
from app.utils.responses import ERROR_RESPONSES, Envelope, ok

router = APIRouter(prefix="/auth", tags=["Auth"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _ua(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _dev_token(token: str | None) -> dict:
    """Outside production the token is echoed so the flow is testable without an SMTP server."""
    return {"dev_token": token} if token and not get_settings().is_production else {}


@router.post(
    "/register",
    response_model=Envelope[AuthResult],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new company workspace",
    description="Creates a company and its first `company_admin` user, and signs them in. "
    "Employees and clients are added afterwards by the admin. A verification token is generated (and logged in development).",
    responses={409: ERROR_RESPONSES[422] | {"description": "Email already registered"}, 422: ERROR_RESPONSES[422]},
)
def register(body: RegisterRequest, request: Request, db: DbSession):
    user, verify_token = auth_service.register(
        db, name=body.name, email=body.email, phone=body.phone, company_name=body.company_name, password=body.password, ip=_ip(request)
    )
    tokens = auth_service.issue_tokens(db, user, _ip(request), _ua(request))
    db.commit()
    auth_service.deliver_token("verify-email", user.email, verify_token)
    return ok({**tokens, "user": user}, "Account created successfully")


@router.post(
    "/login",
    response_model=Envelope[AuthResult],
    summary="Sign in with email and password",
    description="Returns a short-lived access token and a refresh token. Send the access token as `Authorization: Bearer <token>`.",
    responses={401: ERROR_RESPONSES[401] | {"description": "Invalid email or password"}, 403: ERROR_RESPONSES[403]},
)
def login(body: LoginRequest, request: Request, db: DbSession):
    user, tokens = auth_service.login(db, email=body.email, password=body.password, ip=_ip(request), user_agent=_ua(request))
    db.commit()
    return ok({**tokens, "user": user}, "Login successful")


@router.post(
    "/refresh",
    response_model=Envelope[AuthResult],
    summary="Exchange a refresh token for a new token pair",
    description="The presented refresh token is revoked (rotation). If this fails the frontend should redirect to login.",
    responses={401: ERROR_RESPONSES[401]},
)
def refresh(body: RefreshRequest, request: Request, db: DbSession):
    user, tokens = auth_service.refresh(db, refresh_token=body.refresh_token, ip=_ip(request), user_agent=_ua(request))
    db.commit()
    return ok({**tokens, "user": user}, "Token refreshed")


@router.post(
    "/logout",
    response_model=Envelope[None],
    summary="Sign out (revokes the refresh token)",
    description="Idempotent. Pass the refresh token to revoke it; the short-lived access token simply expires.",
)
def logout(body: LogoutRequest, request: Request, db: DbSession):
    auth_service.logout(db, refresh_token=body.refresh_token, ip=_ip(request))
    db.commit()
    return ok(None, "Logged out")


@router.get(
    "/me",
    response_model=Envelope[MeOut],
    summary="Current user, company and permissions",
    description="The frontend uses `permissions` to show/hide UI. Requires a valid access token.",
    responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]},
)
def me(ctx: CurrentCtx):
    company = ctx.db.scalar(select(Company).where(Company.id == ctx.user.company_id)) if ctx.user.company_id else None
    return ok({"user": ctx.user, "company": company, "employee_id": ctx.employee_id, "permissions": sorted(ctx.permissions)})


@router.post(
    "/forgot-password",
    response_model=Envelope[dict],
    summary="Request a password reset link",
    description="Always answers with the same message so it cannot be used to discover which emails are registered. "
    "There is no SMTP server in v1: the token is written to the server log (and echoed as `dev_token` outside production).",
)
def forgot_password(body: ForgotPasswordRequest, db: DbSession):
    token = auth_service.request_password_reset(db, body.email)
    db.commit()
    if token:
        auth_service.deliver_token("password-reset", body.email, token)
    return ok(_dev_token(token), f"If an account exists for {body.email}, a reset link has been sent.")


@router.post(
    "/reset-password",
    response_model=Envelope[None],
    summary="Set a new password using a reset token",
    responses={422: ERROR_RESPONSES[422] | {"description": "Invalid/expired token or weak password"}},
)
def reset_password(body: ResetPasswordRequest, request: Request, db: DbSession):
    auth_service.reset_password(db, token=body.token, new_password=body.new_password, ip=_ip(request))
    db.commit()
    return ok(None, "Password has been reset successfully")


@router.post(
    "/change-password",
    response_model=Envelope[None],
    summary="Change the signed-in user's password",
    description="Requires the current password. All refresh tokens are revoked, so other devices must sign in again.",
    responses={401: ERROR_RESPONSES[401], 422: ERROR_RESPONSES[422]},
)
def change_password(body: ChangePasswordRequest, ctx: CurrentCtx):
    auth_service.change_password(ctx.db, ctx.user, current_password=body.current_password, new_password=body.new_password, ip=ctx.ip)
    ctx.db.commit()
    return ok(None, "Password changed successfully")


@router.post(
    "/verify-email",
    response_model=Envelope[None],
    summary="Confirm an email address with the emailed token",
    responses={422: ERROR_RESPONSES[422]},
)
def verify_email(body: VerifyEmailRequest, db: DbSession):
    auth_service.verify_email(db, body.token)
    db.commit()
    return ok(None, "Email verified")


@router.post(
    "/resend-verification",
    response_model=Envelope[dict],
    summary="Send a new email verification token",
    responses={401: ERROR_RESPONSES[401]},
)
def resend_verification(ctx: CurrentCtx):
    if ctx.user.email_verified:
        return ok({}, "Email is already verified")
    token = auth_service.send_verification(ctx.db, ctx.user)
    ctx.db.commit()
    auth_service.deliver_token("verify-email", ctx.user.email, token)
    return ok(_dev_token(token), "Verification email sent")
