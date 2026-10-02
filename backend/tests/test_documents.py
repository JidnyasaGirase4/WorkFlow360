import itertools
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import Ctx
from app.core.enums import DocumentCategory, DocumentVisibility, RoleName
from app.models import ActivityLog, Document, Employee, Project, ProjectMember
from app.services.documents import can_access_document, document_visibility_filter
from app.database.connection import engine
from tests.conftest import auth

BASE = "/api/v1/documents"
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@pytest.fixture
def db():
    """Own session at READ COMMITTED so rows written by API requests are visible without manual refreshes."""
    with Session(engine.execution_options(isolation_level="READ COMMITTED")) as session:
        yield session


def upload(client, headers, *, content=PDF, filename="contract.pdf", mime="application/pdf", **form):
    return client.post(f"{BASE}/upload", headers=headers, files={"file": (filename, content, mime)}, data=form)


def stored_file(doc_json: dict, db) -> Path:
    doc = db.get(Document, doc_json["id"])
    return get_settings().upload_path / doc.file_path


def make_doc(db, tenant, *, uploader=None, real_file=False, **kw) -> Document:
    """Insert a document row directly (optionally with a real file behind it)."""
    rel = f"{tenant.company.id}/documents/{uuid.uuid4().hex}.pdf"
    if real_file:
        path = get_settings().upload_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(PDF)
    values = dict(
        company_id=tenant.company.id, name="Doc", file_name="doc.pdf", file_path=rel, file_type="application/pdf",
        file_size=len(PDF), category=DocumentCategory.OTHER, visibility=DocumentVisibility.PRIVATE,
        uploaded_by=(uploader or tenant.admin).id,
    )
    doc = Document(**{**values, **kw})
    db.add(doc)
    db.commit()
    return doc


def make_project(db, tenant, *, client=None, manager_emp=None, members=(), code="P-1") -> Project:
    project = Project(company_id=tenant.company.id, client_id=(client or tenant.client_record).id, name=f"Project {code}", project_code=code, manager_id=manager_emp.id if manager_emp else None)
    db.add(project)
    db.flush()
    for emp in members:
        db.add(ProjectMember(project_id=project.id, employee_id=emp.id))
    db.commit()
    return project


def make_ctx(db, user) -> Ctx:
    employee_id = db.scalar(select(Employee.id).where(Employee.user_id == user.id))
    role = user.role.name
    return Ctx(
        db=db, user=user, role=role, permissions=frozenset(), company_id=user.company_id,
        employee_id=employee_id, client_id=user.client_id if role == RoleName.CLIENT.value else None,
    )


# ---- upload ------------------------------------------------------------------

def test_upload_happy_path_and_audit(client, world, db):
    res = upload(client, auth(world.a.admin), name="Master Agreement", category="contract", visibility="client", client_id=world.a.client_record.id)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["name"] == "Master Agreement" and data["file_name"] == "contract.pdf" and data["file_type"] == "application/pdf"
    assert data["file_size"] == len(PDF) and data["file_size_display"]
    assert data["client_name"] == world.a.client_record.company_name and data["uploaded_by_name"] == world.a.admin.name
    assert data["visibility"] == "client" and data["company_id"] == world.a.company.id
    assert "file_path" not in data
    assert stored_file(data, db).read_bytes() == PDF
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "uploaded", ActivityLog.entity_type == "document", ActivityLog.entity_id == data["id"]))


def test_default_visibility_private_and_default_name(client, world):
    data = upload(client, auth(world.a.employee)).json()["data"]
    assert data["visibility"] == "private" and data["name"] == "contract.pdf" and data["category"] == "other"


def test_upload_rejects_bad_extension_mime_magic_and_empty(client, world):
    h = auth(world.a.admin)
    assert upload(client, h, content=b"MZ....", filename="run.exe", mime="application/octet-stream").status_code == 422
    assert upload(client, h, filename="a.pdf", mime="image/png").status_code == 422  # MIME does not match the extension
    assert upload(client, h, content=b"<html>not a pdf</html>").status_code == 422  # magic bytes mismatch
    assert upload(client, h, content=b"").status_code == 422
    assert upload(client, h, content=b"x", filename="noext", mime="application/pdf").status_code == 422


def test_upload_rejects_oversize(client, world, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_mb", 0)
    res = upload(client, auth(world.a.admin))
    assert res.status_code == 422 and "limit" in res.json()["message"]


def test_path_traversal_filename_gets_safe_stored_name(client, world, db):
    for filename in ("../../evil.pdf", "..\\..\\evil.pdf", "/etc/passwd.pdf"):
        res = upload(client, auth(world.a.admin), filename=filename)
        assert res.status_code == 201, res.text
        data = res.json()["data"]
        assert "/" not in data["file_name"] and "\\" not in data["file_name"] and ".." not in data["file_name"]
        row = db.get(Document, data["id"])
        assert row.file_path.startswith(f"{world.a.company.id}/documents/") and ".." not in row.file_path
        assert "evil" not in row.file_path and "passwd" not in row.file_path  # stored name is random
        root = get_settings().upload_path.resolve()
        assert root in stored_file(data, db).resolve().parents


def test_upload_validates_references(client, world, db):
    h = auth(world.a.admin)
    assert upload(client, h, client_id=world.b.client_record.id).status_code == 404  # other company's client
    assert upload(client, h, employee_id=world.b.employee_emp.id, category="employee").status_code == 404
    other_client = world.a.client_record
    project_b = make_project(db, world.b)
    assert upload(client, h, project_id=project_b.id).status_code == 404
    from tests.conftest import Factory
    second_client = Factory(db).make_client(world.a.company, "Second client")
    project = make_project(db, world.a, client=other_client)
    assert upload(client, h, project_id=project.id, client_id=second_client.id).status_code == 422  # project belongs to another client
    ok = upload(client, h, project_id=project.id)  # client is derived from the project
    assert ok.status_code == 201 and ok.json()["data"]["client_id"] == other_client.id and ok.json()["data"]["project_name"] == project.name
    assert upload(client, h, visibility="client").status_code == 422  # client visibility needs a client


def test_employee_category_upload_rules(client, world):
    assert upload(client, auth(world.a.admin), category="employee").status_code == 422  # needs employee_id
    assert upload(client, auth(world.a.manager), category="employee", employee_id=world.a.employee_emp.id).status_code == 403
    assert upload(client, auth(world.a.admin), category="employee", employee_id=world.a.employee_emp.id).status_code == 201
    assert upload(client, auth(world.a.employee), category="employee", employee_id=world.a.employee_emp.id).status_code == 201  # about themselves
    assert upload(client, auth(world.a.employee), category="employee", employee_id=world.a.manager_emp.id).status_code == 403


def test_upload_permissions(client, world):
    assert upload(client, auth(world.a.client_user)).status_code == 403
    assert client.post(f"{BASE}/upload", files={"file": ("a.pdf", PDF, "application/pdf")}).status_code == 401
    assert client.get(BASE).status_code == 401
    assert client.post(f"{BASE}/upload", headers=auth(world.a.admin)).status_code == 422  # no file
    assert upload(client, auth(world.super_admin)).status_code == 400  # super admin must pick a company


# ---- download & visibility matrix ---------------------------------------------

@pytest.fixture
def people(world, factory):
    other_client = factory.make_client(world.a.company, "Other client")
    return {
        "admin": world.a.admin,
        "manager": world.a.manager,
        "employee": world.a.employee,
        "client_of_doc": world.a.client_user,
        "other_client": factory.make_user(world.a.company, RoleName.CLIENT, "other.client@test.local", client=other_client),
        "admin_b": world.b.admin,
    }


MATRIX = {
    "private": {"admin": 200, "manager": 404, "employee": 404, "client_of_doc": 404, "other_client": 404, "admin_b": 404},
    "company": {"admin": 200, "manager": 200, "employee": 200, "client_of_doc": 404, "other_client": 404, "admin_b": 404},
    "client": {"admin": 200, "manager": 200, "employee": 200, "client_of_doc": 200, "other_client": 404, "admin_b": 404},
}


@pytest.mark.parametrize("visibility", ["private", "company", "client"])
def test_download_and_detail_visibility_matrix(client, world, db, people, visibility):
    doc = make_doc(db, world.a, real_file=True, visibility=visibility, client_id=world.a.client_record.id)
    for who, expected in MATRIX[visibility].items():
        h = auth(people[who])
        dl = client.get(f"{BASE}/{doc.id}/download", headers=h)
        assert dl.status_code == expected, (visibility, who, dl.status_code)
        assert client.get(f"{BASE}/{doc.id}", headers=h).status_code == expected, (visibility, who)
        listed = [d["id"] for d in client.get(BASE, headers=h).json()["data"]]
        assert (doc.id in listed) == (expected == 200), (visibility, who)
        if expected == 200:
            assert dl.content == PDF and dl.headers["content-disposition"].startswith("attachment")
            assert dl.headers["x-content-type-options"] == "nosniff"


def test_download_inline_and_audit(client, world, db):
    doc = make_doc(db, world.a, real_file=True, visibility=DocumentVisibility.COMPANY)
    res = client.get(f"{BASE}/{doc.id}/download", params={"inline": "true"}, headers=auth(world.a.employee))
    assert res.status_code == 200 and res.headers["content-disposition"].startswith("inline")
    entry = db.scalar(select(ActivityLog).where(ActivityLog.action == "downloaded", ActivityLog.entity_id == doc.id))
    assert entry is not None and entry.user_id == world.a.employee.id


def test_missing_file_on_disk_is_404_without_audit(client, world, db):
    doc = make_doc(db, world.a, real_file=False, visibility=DocumentVisibility.COMPANY)
    assert client.get(f"{BASE}/{doc.id}/download", headers=auth(world.a.admin)).status_code == 404
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "downloaded")) is None


def test_uploader_always_sees_own_private_upload(client, world, db):
    doc = make_doc(db, world.a, uploader=world.a.employee, real_file=True, visibility=DocumentVisibility.PRIVATE)
    assert client.get(f"{BASE}/{doc.id}/download", headers=auth(world.a.employee)).status_code == 200
    assert client.get(f"{BASE}/{doc.id}", headers=auth(world.a.manager)).status_code == 404


def test_employee_category_documents_locked_down(client, world, db, factory, people):
    doc = make_doc(db, world.a, real_file=True, category=DocumentCategory.EMPLOYEE, employee_id=world.a.employee_emp.id, visibility=DocumentVisibility.CLIENT, client_id=world.a.client_record.id)
    colleague = factory.make_user(world.a.company, RoleName.EMPLOYEE, "colleague@test.local")
    factory.make_employee(colleague, "a-E2")
    expected = {"admin": 200, "employee": 200, "manager": 404, "client_of_doc": 404, "other_client": 404, "admin_b": 404}
    for who, code in expected.items():
        assert client.get(f"{BASE}/{doc.id}/download", headers=auth(people[who])).status_code == code, who
    assert client.get(f"{BASE}/{doc.id}", headers=auth(colleague)).status_code == 404
    # even the uploader loses access when they are neither admin nor the subject
    manager_upload = make_doc(db, world.a, uploader=world.a.manager, category=DocumentCategory.EMPLOYEE, employee_id=world.a.employee_emp.id)
    assert client.get(f"{BASE}/{manager_upload.id}", headers=auth(world.a.manager)).status_code == 404
    assert client.get(BASE, params={"category": "employee"}, headers=auth(world.a.manager)).json()["total"] == 0
    assert client.get(BASE, params={"category": "employee"}, headers=auth(world.a.employee)).json()["total"] == 2


def test_project_linked_documents_need_project_access(client, world, db, factory):
    project = make_project(db, world.a, manager_emp=world.a.manager_emp, members=[world.a.employee_emp])
    outsider = factory.make_user(world.a.company, RoleName.EMPLOYEE, "outsider@test.local")
    factory.make_employee(outsider, "a-E3")
    other_manager = factory.make_user(world.a.company, RoleName.MANAGER, "mgr2@test.local")
    factory.make_employee(other_manager, "a-M2")
    doc = make_doc(db, world.a, real_file=True, visibility=DocumentVisibility.COMPANY, project_id=project.id, client_id=world.a.client_record.id)
    for user, code in ((world.a.admin, 200), (world.a.manager, 200), (world.a.employee, 200), (outsider, 404), (other_manager, 404)):
        assert client.get(f"{BASE}/{doc.id}", headers=auth(user)).status_code == code, user.email
    # the uploader keeps access even without project access
    own = make_doc(db, world.a, uploader=outsider, visibility=DocumentVisibility.PRIVATE, project_id=project.id)
    assert client.get(f"{BASE}/{own.id}", headers=auth(outsider)).status_code == 200


def test_cross_company_is_404_everywhere(client, world, db):
    doc = make_doc(db, world.a, real_file=True, visibility=DocumentVisibility.COMPANY)
    hb = auth(world.b.admin)
    assert client.get(f"{BASE}/{doc.id}", headers=hb).status_code == 404
    assert client.get(f"{BASE}/{doc.id}/download", headers=hb).status_code == 404
    assert client.patch(f"{BASE}/{doc.id}", json={"name": "x"}, headers=hb).status_code == 404
    assert client.delete(f"{BASE}/{doc.id}", headers=hb).status_code == 404
    assert client.get(BASE, headers=hb).json()["total"] == 0
    assert client.get(f"/api/v1/clients/{world.a.client_record.id}/documents", headers=hb).status_code == 404


# ---- access function == SQL filter -------------------------------------------------

def test_access_function_matches_sql_filter(world, db, factory):
    a, b = world.a, world.b
    project = make_project(db, a, manager_emp=a.manager_emp, members=[a.employee_emp], code="P-A")
    foreign_project = make_project(db, b, code="P-B")
    other_client = factory.make_client(a.company, "Other client")
    other_client_user = factory.make_user(a.company, RoleName.CLIENT, "oc@test.local", client=other_client)
    outsider = factory.make_user(a.company, RoleName.EMPLOYEE, "out@test.local")
    factory.make_employee(outsider, "a-E9")
    orphan_employee = factory.make_user(a.company, RoleName.EMPLOYEE, "noemp@test.local")  # user without an employee row

    combos = itertools.product(
        list(DocumentCategory), list(DocumentVisibility),
        [a.client_record.id, other_client.id, None],
        [a.admin.id, a.employee.id, a.manager.id, None],
        [project.id, None],
        [None, a.employee_emp.id, a.manager_emp.id],
    )
    docs = []
    for i, (cat, vis, cid, uploader, pid, eid) in enumerate(combos):
        docs.append(Document(
            company_id=a.company.id, name=f"d{i}", file_name="d.pdf", file_path=f"x/{i}.pdf", file_type="application/pdf", file_size=1,
            category=cat, visibility=vis, client_id=cid, uploaded_by=uploader, project_id=pid, employee_id=eid,
        ))
    docs.append(Document(company_id=b.company.id, name="b", file_name="b.pdf", file_path="x/b.pdf", file_type="application/pdf", file_size=1, project_id=foreign_project.id, visibility=DocumentVisibility.COMPANY))
    db.add_all(docs)
    db.commit()

    users = [a.admin, a.manager, a.employee, a.client_user, other_client_user, outsider, orphan_employee, b.admin, b.employee, b.client_user, world.super_admin]
    for user in users:
        ctx = make_ctx(db, user)
        sql_ids = set(db.scalars(select(Document.id).where(document_visibility_filter(ctx))))
        py_ids = {d.id for d in docs if can_access_document(ctx, d)}
        assert sql_ids == py_ids, f"{user.email}: sql-only={sorted(sql_ids - py_ids)[:5]} py-only={sorted(py_ids - sql_ids)[:5]}"
    # the matrix is not degenerate: different roles see different amounts
    sizes = {u.email: len(set(db.scalars(select(Document.id).where(document_visibility_filter(make_ctx(db, u)))))) for u in users}
    assert sizes[a.admin.email] > sizes[a.manager.email] > 0 and sizes[a.client_user.email] > 0 and sizes[a.employee.email] > 0
    # super admin without ?company_id sees every company
    assert sizes[world.super_admin.email] == len(docs)


# ---- update / delete -----------------------------------------------------------------

def test_update_rename_visibility_category(client, world, db):
    doc = make_doc(db, world.a, uploader=world.a.manager, visibility=DocumentVisibility.COMPANY, client_id=world.a.client_record.id)
    res = client.patch(f"{BASE}/{doc.id}", json={"name": "Renamed.pdf", "visibility": "client", "category": "contract"}, headers=auth(world.a.manager))
    assert res.status_code == 200, res.text
    assert res.json()["data"]["name"] == "Renamed.pdf" and res.json()["data"]["visibility"] == "client"
    # a different internal user who can see it may not edit it; admin may
    assert client.patch(f"{BASE}/{doc.id}", json={"name": "Hack"}, headers=auth(world.a.employee)).status_code == 403
    assert client.patch(f"{BASE}/{doc.id}", json={"name": "By admin"}, headers=auth(world.a.admin)).status_code == 200
    assert client.patch(f"{BASE}/{doc.id}", json={"category": "employee"}, headers=auth(world.a.admin)).status_code == 422  # no employee_id
    assert client.patch(f"{BASE}/{doc.id}", json={"visibility": "nope"}, headers=auth(world.a.admin)).status_code == 422
    assert client.patch(f"{BASE}/{doc.id}", json={"file_path": "../x"}, headers=auth(world.a.admin)).status_code == 422
    assert client.patch(f"{BASE}/{doc.id}", json={"name": "x"}, headers=auth(world.a.client_user)).status_code == 403
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "updated", ActivityLog.entity_id == doc.id))
    no_client = make_doc(db, world.a, uploader=world.a.admin)
    assert client.patch(f"{BASE}/{no_client.id}", json={"visibility": "client"}, headers=auth(world.a.admin)).status_code == 422


def test_delete_removes_row_file_and_audits(client, world, db):
    created = upload(client, auth(world.a.manager), visibility="company").json()["data"]
    path = stored_file(created, db)
    assert path.is_file()
    assert client.delete(f"{BASE}/{created['id']}", headers=auth(world.a.employee)).status_code == 403  # no delete_documents
    assert client.delete(f"{BASE}/{created['id']}", headers=auth(world.a.client_user)).status_code == 403
    assert client.delete(f"{BASE}/{created['id']}", headers=auth(world.a.manager)).status_code == 200
    assert not path.exists()
    db.expire_all()
    assert db.get(Document, created["id"]) is None
    assert client.get(f"{BASE}/{created['id']}", headers=auth(world.a.admin)).status_code == 404
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "deleted", ActivityLog.entity_id == created["id"]))


def test_delete_requires_uploader_or_admin(client, world, db, factory):
    manager2 = factory.make_user(world.a.company, RoleName.MANAGER, "mgr2@test.local")
    factory.make_employee(manager2, "a-M2")
    doc = make_doc(db, world.a, uploader=world.a.manager, real_file=True, visibility=DocumentVisibility.COMPANY)
    assert client.delete(f"{BASE}/{doc.id}", headers=auth(manager2)).status_code == 403  # can see it, did not upload it
    assert client.delete(f"{BASE}/{doc.id}", headers=auth(world.a.admin)).status_code == 200


# ---- list filters / sort ----------------------------------------------------------------

def test_list_filters_search_sort_pagination(client, world, db):
    h = auth(world.a.admin)
    project = make_project(db, world.a)
    make_doc(db, world.a, name="Alpha contract", file_name="alpha.pdf", category=DocumentCategory.CONTRACT, client_id=world.a.client_record.id, visibility=DocumentVisibility.CLIENT, file_size=10)
    make_doc(db, world.a, name="Beta plan", file_name="beta.pdf", category=DocumentCategory.PROJECT, project_id=project.id, uploader=world.a.manager, visibility=DocumentVisibility.COMPANY, file_size=30)
    make_doc(db, world.a, name="Gamma_notes", file_name="gamma.pdf", category=DocumentCategory.OTHER, employee_id=world.a.employee_emp.id, file_size=20)

    def names(**params):
        return [d["name"] for d in client.get(BASE, params=params, headers=h).json()["data"]]

    assert sorted(names()) == ["Alpha contract", "Beta plan", "Gamma_notes"]
    assert names(category="contract") == ["Alpha contract"]
    assert names(client_id=world.a.client_record.id) == ["Alpha contract"]
    assert names(project_id=project.id) == ["Beta plan"]
    assert names(employee_id=world.a.employee_emp.id) == ["Gamma_notes"]
    assert names(visibility="company") == ["Beta plan"]
    assert names(uploaded_by=world.a.manager.id) == ["Beta plan"]
    assert names(search="alpha") == ["Alpha contract"] and names(search="beta.pdf") == ["Beta plan"]
    assert names(search="%") == [] and names(search="_") == ["Gamma_notes"]  # wildcards are escaped
    assert names(sort_by="file_size", sort_order="asc") == ["Alpha contract", "Gamma_notes", "Beta plan"]
    assert names(date_from="2999-01-01") == [] and len(names(date_from="2000-01-01", date_to="2999-01-01")) == 3
    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "name", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and [d["name"] for d in page["data"]] == ["Gamma_notes"]
    assert client.get(BASE, params={"sort_by": "file_path"}, headers=h).status_code == 422
    assert client.get(BASE, params={"category": "bogus"}, headers=h).status_code == 422
    row = client.get(BASE, params={"category": "project"}, headers=h).json()["data"][0]
    assert row["project_name"] == project.name and row["uploaded_by_name"] == world.a.manager.name and "file_path" not in row


# ---- extra routes -------------------------------------------------------------------

def test_client_documents_route(client, world, db, factory):
    cid = world.a.client_record.id
    make_doc(db, world.a, name="shared", client_id=cid, visibility=DocumentVisibility.CLIENT)
    make_doc(db, world.a, name="internal", client_id=cid, visibility=DocumentVisibility.COMPANY)
    make_doc(db, world.a, name="secret", client_id=cid, visibility=DocumentVisibility.PRIVATE)
    make_doc(db, world.a, name="elsewhere", client_id=factory.make_client(world.a.company, "Zed").id, visibility=DocumentVisibility.CLIENT)
    url = f"/api/v1/clients/{cid}/documents"

    def names(user, path=url):
        res = client.get(path, headers=auth(user))
        assert res.status_code == 200, res.text
        return sorted(d["name"] for d in res.json()["data"])

    assert names(world.a.client_user) == ["shared"]
    assert names(world.a.admin) == ["internal", "secret", "shared"]
    assert names(world.a.employee) == ["internal", "shared"]
    other_id = db.scalar(select(Document.client_id).where(Document.name == "elsewhere"))
    assert client.get(f"/api/v1/clients/{other_id}/documents", headers=auth(world.a.client_user)).status_code == 404
    assert names(world.a.admin, f"/api/v1/clients/{other_id}/documents") == ["elsewhere"]
    assert client.get("/api/v1/clients/999999/documents", headers=auth(world.a.admin)).status_code == 404
    assert client.get(url, headers=auth(world.b.admin)).status_code == 404
    assert client.get(url).status_code == 401


def test_project_documents_route(client, world, db, factory):
    project = make_project(db, world.a, manager_emp=world.a.manager_emp, members=[world.a.employee_emp])
    hidden_project = make_project(db, world.a, code="P-2")
    make_doc(db, world.a, name="on project", project_id=project.id, visibility=DocumentVisibility.CLIENT, client_id=world.a.client_record.id)
    make_doc(db, world.a, name="private on project", project_id=project.id)
    make_doc(db, world.a, name="other project", project_id=hidden_project.id, visibility=DocumentVisibility.COMPANY)
    url = f"/api/v1/projects/{project.id}/documents"
    assert [d["name"] for d in client.get(url, headers=auth(world.a.employee)).json()["data"]] == ["on project"]
    assert [d["name"] for d in client.get(url, headers=auth(world.a.client_user)).json()["data"]] == ["on project"]
    assert client.get(url, headers=auth(world.a.admin)).json()["total"] == 2
    assert client.get(f"/api/v1/projects/{hidden_project.id}/documents", headers=auth(world.a.employee)).status_code == 404  # not a member
    assert client.get(f"/api/v1/projects/{hidden_project.id}/documents", headers=auth(world.a.client_user)).json()["total"] == 0  # visible project, no client-visible docs
    assert client.get(url, headers=auth(world.b.admin)).status_code == 404
