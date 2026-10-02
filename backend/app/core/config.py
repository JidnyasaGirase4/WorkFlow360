from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """All configuration comes from environment variables / backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "WorkFlow360"
    app_env: str = "development"  # development | production | test
    debug: bool = False

    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "workflow360_db"
    db_user: str = "root"
    db_password: str = ""

    jwt_secret_key: str = Field(default="", description="Required. Generate with: python -c \"import secrets; print(secrets.token_urlsafe(48))\"")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    bcrypt_rounds: int = 12  # tests lower this for speed
    password_reset_expire_minutes: int = 30
    email_verify_expire_hours: int = 48

    # Comma separated list of allowed browser origins (the React dev server by default).
    frontend_url: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_mb: int = 10

    @property
    def database_url(self) -> URL:
        return URL.create(
            "mysql+pymysql",
            username=self.db_user,
            password=self.db_password or None,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
            query={"charset": "utf8mb4"},
        )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_url.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        return path if path.is_absolute() else BACKEND_DIR / path

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.jwt_secret_key:
        raise RuntimeError("JWT_SECRET_KEY is not set. Copy .env.example to .env and set a long random value.")
    if settings.is_production and settings.debug:
        raise RuntimeError("DEBUG must be false in production.")
    return settings
