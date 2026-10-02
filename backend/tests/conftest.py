"""Test harness: runs against a real MySQL database (`workflow360_test` in XAMPP), never the dev DB.

Fixtures / helpers other test modules can use:
  client            FastAPI TestClient
  db                SQLAlchemy session
  factory           object with make_company / make_user / make_employee / make_client ...
  auth(user)        -> {"Authorization": "Bearer ..."} headers for a user
  world             two companies (A, B), each with admin/manager/employee/client users
"""
import os
import shutil

os.environ["APP_ENV"] = "test"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "workflow360_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256-signing")
os.environ["UPLOAD_DIR"] = os.path.join(os.path.dirname(__file__), "_uploads")

from dataclasses import dataclass  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.enums import RoleName  # noqa: E402
from app.core.permissions import clear_permission_cache  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.connection import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Client, Company, Employee, Role, User  # noqa: E402
from app.services.bootstrap import seed_roles_and_permissions  # noqa: E402

PASSWORD = "Password123"
REFERENCE_TABLES = {"roles", "permissions", "role_permissions"}


@pytest.fixture(scope="session", autouse=True)
def _schema():
    assert "test" in engine.url.database, "Refusing to run tests against a non-test database"
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        Base.metadata.drop_all(conn)
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_roles_and_permissions(session)
    yield
    engine.dispose()
    shutil.rmtree(os.environ["UPLOAD_DIR"], ignore_errors=True)  # files written by upload tests


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for table in Base.metadata.sorted_tables:
            if table.name not in REFERENCE_TABLES:
                conn.execute(text(f"DELETE FROM `{table.name}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    clear_permission_cache()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


class Factory:
    def __init__(self, db):
        self.db = db
        self._n = 0

    def _next(self) -> int:
        self._n += 1
        return self._n

    def make_company(self, name: str | None = None) -> Company:
        n = self._next()
        company = Company(name=name or f"Company {n}", slug=f"company-{n}-{os.urandom(2).hex()}")
        self.db.add(company)
        self.db.commit()
        return company

    def make_user(self, company: Company | None, role: RoleName, email: str | None = None, name: str | None = None, client: Client | None = None, password: str = PASSWORD) -> User:
        n = self._next()
        role_row = self.db.query(Role).filter_by(name=role.value).one()
        user = User(
            company_id=company.id if company else None,
            client_id=client.id if client else None,
            name=name or f"{role.value} {n}",
            email=(email or f"{role.value}{n}@test.local").lower(),
            password_hash=hash_password(password),
            role_id=role_row.id,
            email_verified=True,
        )
        self.db.add(user)
        self.db.commit()
        return user

    def make_employee(self, user: User, code: str | None = None, **kwargs) -> Employee:
        employee = Employee(company_id=user.company_id, user_id=user.id, employee_code=code or f"EMP-{self._next():04d}", **kwargs)
        self.db.add(employee)
        self.db.commit()
        return employee

    def make_client(self, company: Company, name: str | None = None, **kwargs) -> Client:
        n = self._next()
        client = Client(company_id=company.id, company_name=name or f"Client {n}", **kwargs)
        self.db.add(client)
        self.db.commit()
        return client


@pytest.fixture
def factory(db) -> Factory:
    return Factory(db)


def auth(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.role.name, user.company_id)
    return {"Authorization": f"Bearer {token}"}


@dataclass
class Tenant:
    company: Company
    admin: User
    manager: User
    employee: User
    client_record: Client
    client_user: User
    manager_emp: Employee
    employee_emp: Employee


@dataclass
class World:
    a: Tenant
    b: Tenant
    super_admin: User


def _tenant(factory: Factory, label: str) -> Tenant:
    company = factory.make_company(f"Company {label}")
    admin = factory.make_user(company, RoleName.COMPANY_ADMIN, f"admin.{label}@test.local")
    manager = factory.make_user(company, RoleName.MANAGER, f"manager.{label}@test.local")
    employee = factory.make_user(company, RoleName.EMPLOYEE, f"employee.{label}@test.local")
    client_record = factory.make_client(company, f"Client of {label}")
    client_user = factory.make_user(company, RoleName.CLIENT, f"client.{label}@test.local", client=client_record)
    return Tenant(
        company, admin, manager, employee, client_record, client_user,
        factory.make_employee(manager, f"{label}-M1"), factory.make_employee(employee, f"{label}-E1"),
    )


@pytest.fixture
def world(factory) -> World:
    return World(a=_tenant(factory, "a"), b=_tenant(factory, "b"), super_admin=factory.make_user(None, RoleName.SUPER_ADMIN, "root@test.local"))
