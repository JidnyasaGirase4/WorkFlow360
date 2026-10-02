from app.core.enums import UserStatus
from app.core.security import create_access_token
from tests.conftest import PASSWORD, auth

BASE = "/api/v1/auth"
NEW = {"name": "Rahul Sharma", "email": "rahul@acme.test", "company_name": "Acme Ltd", "password": "Strong123", "confirm_password": "Strong123"}


def register(client, **over):
    return client.post(f"{BASE}/register", json={**NEW, **over})


def test_register_creates_company_admin_and_signs_in(client):
    res = register(client)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["success"] is True
    assert body["data"]["user"]["role"] == "company_admin"
    assert body["data"]["access_token"] and body["data"]["refresh_token"]
    assert "password" not in str(body).lower().replace("confirm_password", "")


def test_register_rejects_duplicate_email(client):
    register(client)
    res = register(client)
    assert res.status_code == 409 and res.json()["success"] is False


def test_register_validates_password(client):
    assert register(client, password="weak", confirm_password="weak").status_code == 422
    assert register(client, confirm_password="Different123").status_code == 422


def test_password_is_hashed_in_db(client, db):
    from app.models import User

    register(client)
    user = db.query(User).filter_by(email="rahul@acme.test").one()
    assert user.password_hash != "Strong123" and user.password_hash.startswith("$2")


def test_login_ok_and_invalid_password(client):
    register(client)
    ok = client.post(f"{BASE}/login", json={"email": "rahul@acme.test", "password": "Strong123"})
    assert ok.status_code == 200 and ok.json()["data"]["expires_in"] > 0
    bad = client.post(f"{BASE}/login", json={"email": "rahul@acme.test", "password": "Wrong123"})
    assert bad.status_code == 401
    unknown = client.post(f"{BASE}/login", json={"email": "nobody@acme.test", "password": "Wrong123"})
    assert unknown.status_code == 401 and unknown.json()["message"] == bad.json()["message"]


def test_suspended_user_cannot_login(client, world, db):
    world.a.employee.status = UserStatus.SUSPENDED
    db.add(world.a.employee)
    db.commit()
    res = client.post(f"{BASE}/login", json={"email": world.a.employee.email, "password": PASSWORD})
    assert res.status_code == 403


def test_me_requires_valid_token(client, world):
    assert client.get(f"{BASE}/me").status_code == 401
    assert client.get(f"{BASE}/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    res = client.get(f"{BASE}/me", headers=auth(world.a.admin))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["user"]["email"] == world.a.admin.email
    assert "view_clients" in data["permissions"]


def test_refresh_token_type_and_rotation(client):
    tokens = register(client).json()["data"]
    # an access token cannot be used as a refresh token
    assert client.post(f"{BASE}/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401
    ok = client.post(f"{BASE}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert ok.status_code == 200
    # the old refresh token is revoked after rotation
    assert client.post(f"{BASE}/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    # a refresh token cannot authenticate API calls
    assert client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}).status_code == 401


def test_logout_revokes_refresh_token(client):
    tokens = register(client).json()["data"]
    assert client.post(f"{BASE}/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 200
    assert client.post(f"{BASE}/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.post(f"{BASE}/logout", json={}).status_code == 200  # idempotent


def test_expired_token_is_rejected(client, world, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "jwt_access_token_expire_minutes", -1)
    token = create_access_token(world.a.admin.id, "company_admin", world.a.company.id)
    res = client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401 and "expired" in res.json()["message"].lower()


def test_change_password(client, world):
    headers = auth(world.a.employee)
    body = {"current_password": PASSWORD, "new_password": "Newpass123", "confirm_password": "Newpass123"}
    assert client.post(f"{BASE}/change-password", json={**body, "current_password": "Wrong123"}, headers=headers).status_code == 422
    assert client.post(f"{BASE}/change-password", json=body, headers=headers).status_code == 200
    assert client.post(f"{BASE}/login", json={"email": world.a.employee.email, "password": PASSWORD}).status_code == 401
    assert client.post(f"{BASE}/login", json={"email": world.a.employee.email, "password": "Newpass123"}).status_code == 200


def test_forgot_and_reset_password(client, world):
    res = client.post(f"{BASE}/forgot-password", json={"email": world.a.employee.email})
    token = res.json()["data"]["dev_token"]
    unknown = client.post(f"{BASE}/forgot-password", json={"email": "nobody@x.test"})
    assert unknown.status_code == 200 and unknown.json()["message"] == res.json()["message"].replace(world.a.employee.email, "nobody@x.test")

    body = {"token": token, "new_password": "Resetpass123", "confirm_password": "Resetpass123"}
    assert client.post(f"{BASE}/reset-password", json=body).status_code == 200
    assert client.post(f"{BASE}/reset-password", json=body).status_code == 422  # single use
    assert client.post(f"{BASE}/login", json={"email": world.a.employee.email, "password": "Resetpass123"}).status_code == 200


def test_verify_email(client, db):
    from app.models import User

    res = register(client)
    assert res.status_code == 201
    token = client.post(f"{BASE}/resend-verification", headers={"Authorization": f"Bearer {res.json()['data']['access_token']}"}).json()["data"]["dev_token"]
    assert client.post(f"{BASE}/verify-email", json={"token": token}).status_code == 200
    assert db.query(User).filter_by(email="rahul@acme.test").one().email_verified is True


def test_validation_error_shape(client):
    res = client.post(f"{BASE}/login", json={"email": "not-an-email"})
    body = res.json()
    assert res.status_code == 422 and body["success"] is False and "errors" in body
