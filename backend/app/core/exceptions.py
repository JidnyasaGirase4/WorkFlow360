"""Domain errors + centralized handlers producing the standard error envelope."""
import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("workflow360")


class AppError(Exception):
    status_code = 400
    default_message = "Bad request"

    def __init__(self, message: str | None = None, errors: dict | None = None):
        self.message = message or self.default_message
        self.errors = errors or {}
        super().__init__(self.message)


class BadRequestError(AppError):
    status_code = 400


class UnauthorizedError(AppError):
    status_code = 401
    default_message = "Authentication required"


class ForbiddenError(AppError):
    status_code = 403
    default_message = "You do not have permission to perform this action"


class NotFoundError(AppError):
    status_code = 404
    default_message = "Resource not found"


class ConflictError(AppError):
    status_code = 409
    default_message = "Resource already exists"


class UnprocessableError(AppError):
    status_code = 422
    default_message = "Validation failed"


def error_response(status_code: int, message: str, errors: dict | list | None = None, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder({"success": False, "message": message, "errors": errors or {}}),
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return error_response(exc.status_code, exc.message, exc.errors, headers)

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException):
        return error_response(exc.status_code, str(exc.detail), headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError):
        errors: dict[str, str] = {}
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
            errors[loc or "request"] = err["msg"]
        return error_response(422, "Validation failed", errors)

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_: Request, exc: IntegrityError):
        logger.warning("Integrity error: %s", exc.orig)
        return error_response(409, "This record conflicts with existing data (duplicate value or it is still referenced by other records)")

    @app.exception_handler(SQLAlchemyError)
    async def db_error_handler(_: Request, exc: SQLAlchemyError):
        logger.exception("Database error")
        return error_response(500, "A database error occurred")

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception):
        logger.exception("Unhandled error")
        return error_response(500, "Internal server error")
