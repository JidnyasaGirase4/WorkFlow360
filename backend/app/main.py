import importlib
import logging
import pkgutil

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import routers as routers_package
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.middleware.security_headers import SecurityHeadersMiddleware

API_PREFIX = "/api/v1"

DESCRIPTION = """
REST API for **WorkFlow360** — CRM, projects, tasks, HR, billing, documents, support and reporting
for multi-company teams.

### Authentication
1. `POST /api/v1/auth/login` returns an `access_token` (short lived) and a `refresh_token`.
2. Click **Authorize** above and paste the access token, or send `Authorization: Bearer <token>`.
3. When the access token expires (HTTP 401 "Token has expired"), call `POST /api/v1/auth/refresh`.

### Conventions
* Success: `{"success": true, "message": "...", "data": ...}`
* Lists add `page`, `limit`, `total`, `total_pages`. Use `?page=1&limit=20`, `?sort_by=&sort_order=` and `?search=`.
* Errors: `{"success": false, "message": "...", "errors": {...}}` with 400/401/403/404/409/422/500.
* Data is isolated per company; a record from another company is reported as 404.
"""


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)

    app = FastAPI(
        title=f"{settings.app_name} API",
        version="1.0.0",
        description=DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )
    register_exception_handlers(app)

    # Every module in app/routers is mounted under /api/v1 automatically. A module exposes its main
    # `router` and may add `extra_routers` (e.g. billing adds GET /clients/{id}/invoices).
    api = APIRouter(prefix=API_PREFIX)
    for module_info in sorted(pkgutil.iter_modules(routers_package.__path__), key=lambda m: m.name):
        module = importlib.import_module(f"{routers_package.__name__}.{module_info.name}")
        if hasattr(module, "router"):
            api.include_router(module.router)
        for extra in getattr(module, "extra_routers", []):
            api.include_router(extra)
    app.include_router(api)

    @app.get("/health", tags=["System"], summary="Liveness probe")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
