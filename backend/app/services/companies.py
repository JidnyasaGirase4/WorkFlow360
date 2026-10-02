"""Company (tenant) management for the super admin, plus the company-settings screen for a company admin."""
from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import CompanyStatus, RoleName
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError, UnprocessableError
from app.core.security import hash_password
from app.database.base import utcnow
from app.models.company import Company
from app.models.role import Role
from app.models.user import RefreshToken, User
from app.schemas.company_admin import CompanyCreate, CompanyListItem, CompanyOut, CompanyUpdate
from app.services.activity import log_activity
from app.services.auth import _slugify, _unique_slug, find_user_by_email
from app.utils.pagination import PageParams, like_any, paginate


def _audit(db: Session, ctx: Ctx, action: str, company: Company, description: str) -> None:
    # Always filed under the affected company, even when a super admin acts without ?company_id=.
    log_activity(db, None, action, "company", company.id, description, user_id=ctx.user.id, company_id=company.id, ip=ctx.ip)


def list_query(*, search: str | None, status: CompanyStatus | None) -> Select:
    stmt = select(Company)
    if search:
        stmt = stmt.where(like_any(search, Company.name, Company.slug, Company.email))
    if status:
        stmt = stmt.where(Company.status == status)
    return stmt


def list_companies(db: Session, stmt: Select, pagination: PageParams) -> dict:
    """Paginated list with a per-company `user_count`, counted in one grouped query for the page."""
    page = paginate(db, stmt, pagination, lambda company: company)
    ids = [c.id for c in page["data"]]
    counts = dict(db.execute(select(User.company_id, func.count()).where(User.company_id.in_(ids)).group_by(User.company_id)).all()) if ids else {}
    page["data"] = [CompanyListItem.model_validate({**CompanyOut.model_validate(c).model_dump(), "user_count": counts.get(c.id, 0)}) for c in page["data"]]
    return page


def get_company(db: Session, company_id: int) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise NotFoundError("Company not found")
    return company


def current_company(db: Session, ctx: Ctx) -> Company:
    if ctx.company_id is None:
        raise BadRequestError("Super admins must pass ?company_id= to work with a company's settings")
    return get_company(db, ctx.company_id)


def create_company(db: Session, ctx: Ctx, data: CompanyCreate) -> tuple[Company, User]:
    """Creates the company and its first company_admin in one transaction."""
    admin = data.admin
    if find_user_by_email(db, admin.email):
        raise ConflictError("A user with this email already exists", {"admin.email": "Already exists"})
    slug = _slugify(data.slug) if data.slug else _unique_slug(db, data.name)
    if db.scalar(select(Company.id).where(Company.slug == slug)):
        raise ConflictError("A company with this slug already exists", {"slug": "Already exists"})
    role = db.scalar(select(Role).where(Role.name == RoleName.COMPANY_ADMIN.value))
    if role is None:
        raise UnprocessableError("The company_admin role is not seeded")
    company = Company(slug=slug, **data.model_dump(exclude={"admin", "slug"}))
    db.add(company)
    db.flush()
    user = User(
        company_id=company.id, name=admin.name, email=admin.email.lower(), phone=admin.phone,
        password_hash=hash_password(admin.password), role_id=role.id,
    )
    db.add(user)
    db.flush()
    _audit(db, ctx, "created", company, f"Created company {company.name} with admin {user.email}")
    db.commit()
    return company, user


def update_company(db: Session, ctx: Ctx, company: Company, data: CompanyUpdate) -> Company:
    changes = data.model_dump(exclude_unset=True)
    changed = [field for field, value in changes.items() if getattr(company, field) != value]
    for field in changed:
        setattr(company, field, changes[field])
    if changed:
        _audit(db, ctx, "updated", company, f"Updated company {company.name} ({', '.join(changed)})")
    db.commit()
    return company


def set_status(db: Session, ctx: Ctx, company: Company, status: CompanyStatus) -> Company:
    old = company.status
    company.status = status
    if status != CompanyStatus.ACTIVE:
        # get_ctx already blocks every request of a suspended company; also kill refresh tokens so sessions cannot be renewed
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id.in_(select(User.id).where(User.company_id == company.id)), RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
    _audit(db, ctx, "status_changed", company, f"Changed status of company {company.name} from {old.value} to {status.value}")
    db.commit()
    return company
