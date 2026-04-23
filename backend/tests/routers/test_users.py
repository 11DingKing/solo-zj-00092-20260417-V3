import pytest
from httpx import AsyncClient

from app.config.config import settings
from app.models import User

from ..utils import (
    create_test_user,
    generate_user_auth_headers,
    get_user_auth_headers,
    random_email,
    random_lower_string,
)


@pytest.mark.anyio
async def test_register_new_user(client: AsyncClient) -> None:
    email = random_email()
    password = random_lower_string()
    data = {"email": email, "password": password}
    response = await client.post(
        f"{settings.API_V1_STR}/users",
        json=data,
    )
    assert response.status_code == 200
    created_user = response.json()
    assert created_user["email"] == email
    assert "hashed_password" not in created_user
    assert created_user["is_active"] is True
    assert created_user["is_superuser"] is False

    user = await User.find_one({"email": email})
    assert user
    assert user.email == email


@pytest.mark.anyio
async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    user = await create_test_user()
    data = {"email": user.email, "password": "password"}
    response = await client.post(f"{settings.API_V1_STR}/users", json=data)
    assert response.status_code == 409
    response_data = response.json()
    assert response_data["detail"] == "User with that email already exists."


@pytest.mark.anyio
async def test_login_get_token(client: AsyncClient) -> None:
    from app.auth.auth import get_hashed_password

    password = random_lower_string()
    user = User(
        email=random_email(),
        hashed_password=get_hashed_password(password),
    )
    await user.create()

    response = await client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": password},
    )
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"


@pytest.mark.anyio
async def test_access_me_with_token(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)
    response = await client.get(
        f"{settings.API_V1_STR}/users/me", headers=token_headers
    )
    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == user.email
    assert profile["is_active"] is True
    assert profile["is_superuser"] is False


@pytest.mark.anyio
async def test_update_profile(client: AsyncClient) -> None:
    user = await create_test_user()
    user_hashed_password = user.hashed_password
    token_headers = await generate_user_auth_headers(client, user)

    new_email = random_email()
    new_password = random_lower_string()
    data = {"email": new_email, "password": new_password}
    response = await client.patch(
        f"{settings.API_V1_STR}/users/me", json=data, headers=token_headers
    )
    assert response.status_code == 200

    updated_user = await User.get(user.id)
    assert updated_user is not None
    assert updated_user.email == new_email
    assert updated_user.hashed_password != user_hashed_password


@pytest.mark.anyio
async def test_update_profile_with_first_last_name(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)

    data = {"first_name": "John", "last_name": "Doe"}
    response = await client.patch(
        f"{settings.API_V1_STR}/users/me", json=data, headers=token_headers
    )
    assert response.status_code == 200
    updated_profile = response.json()
    assert updated_profile["first_name"] == "John"
    assert updated_profile["last_name"] == "Doe"


@pytest.mark.anyio
async def test_admin_get_users_list(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    await create_test_user()
    await create_test_user()

    response = await client.get(
        f"{settings.API_V1_STR}/users",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    users = response.json()
    assert isinstance(users, list)
    assert len(users) >= 3

    response_with_limit = await client.get(
        f"{settings.API_V1_STR}/users?limit=2",
        headers=superuser_token_headers,
    )
    assert response_with_limit.status_code == 200
    users_limited = response_with_limit.json()
    assert len(users_limited) == 2


@pytest.mark.anyio
async def test_admin_delete_user(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    user = await create_test_user()

    response = await client.delete(
        f"{settings.API_V1_STR}/users/{user.uuid}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    deleted_user = response.json()
    assert deleted_user["email"] == user.email

    user_in_db = await User.find_one({"uuid": user.uuid})
    assert user_in_db is None


@pytest.mark.anyio
async def test_admin_delete_nonexistent_user_returns_404(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    from uuid import uuid4

    nonexistent_uuid = uuid4()
    response = await client.delete(
        f"{settings.API_V1_STR}/users/{nonexistent_uuid}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404


@pytest.mark.anyio
async def test_non_admin_access_users_list_returns_403(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)

    response = await client.get(
        f"{settings.API_V1_STR}/users",
        headers=token_headers,
    )
    assert response.status_code == 403


@pytest.mark.anyio
async def test_non_admin_delete_user_returns_403(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)
    another_user = await create_test_user()

    response = await client.delete(
        f"{settings.API_V1_STR}/users/{another_user.uuid}",
        headers=token_headers,
    )
    assert response.status_code == 403


@pytest.mark.anyio
async def test_non_admin_get_user_by_id_returns_403(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)
    another_user = await create_test_user()

    response = await client.get(
        f"{settings.API_V1_STR}/users/{another_user.uuid}",
        headers=token_headers,
    )
    assert response.status_code == 403


@pytest.mark.anyio
async def test_non_admin_update_user_returns_403(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)
    another_user = await create_test_user()

    response = await client.patch(
        f"{settings.API_V1_STR}/users/{another_user.uuid}",
        json={"email": random_email()},
        headers=token_headers,
    )
    assert response.status_code == 403


@pytest.mark.anyio
async def test_access_me_without_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(f"{settings.API_V1_STR}/users/me")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_login_with_wrong_password_returns_400(client: AsyncClient) -> None:
    user = await create_test_user()
    response = await client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": "wrongpassword"},
    )
    assert response.status_code == 400


@pytest.mark.anyio
async def test_superuser_access_me(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    response = await client.get(
        f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers
    )
    current_user = response.json()
    assert current_user
    assert current_user["is_active"] is True
    assert current_user["is_superuser"]
    assert current_user["email"] == settings.FIRST_SUPERUSER


@pytest.mark.anyio
async def test_normal_user_access_me(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)
    response = await client.get(f"{settings.API_V1_STR}/users/me", headers=token_headers)

    profile = response.json()
    assert profile
    assert profile["is_active"] is True
    assert profile["is_superuser"] is False
    assert profile["email"] == user.email


@pytest.mark.anyio
async def test_admin_get_user_by_id(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    user = await create_test_user()
    response = await client.get(
        f"{settings.API_V1_STR}/users/{user.uuid}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    api_user = response.json()
    assert user.email == api_user["email"]


@pytest.mark.anyio
async def test_admin_update_user(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    user = await create_test_user()
    user_hashed_password = user.hashed_password

    data = {
        "email": random_email(),
        "password": random_lower_string(),
        "is_superuser": True,
        "is_active": False,
    }
    response = await client.patch(
        f"{settings.API_V1_STR}/users/{user.uuid}",
        json=data,
        headers=superuser_token_headers,
    )
    assert response.status_code == 200

    updated_user = await User.get(user.id)
    assert updated_user is not None
    assert updated_user.email == data["email"]
    assert updated_user.hashed_password != user_hashed_password
    assert updated_user.is_superuser is True
    assert updated_user.is_active is False


@pytest.mark.anyio
async def test_update_profile_existing_email_returns_409(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)

    data = {"email": settings.FIRST_SUPERUSER}
    response = await client.patch(
        f"{settings.API_V1_STR}/users/me", json=data, headers=token_headers
    )
    assert response.status_code == 409


@pytest.mark.anyio
async def test_update_profile_cannot_set_superuser(client: AsyncClient) -> None:
    user = await create_test_user()
    token_headers = await generate_user_auth_headers(client, user)

    data = {"is_superuser": True, "is_active": False}
    response = await client.patch(
        f"{settings.API_V1_STR}/users/me", json=data, headers=token_headers
    )
    assert response.status_code == 200

    updated_user = await User.get(user.id)
    assert updated_user is not None
    assert updated_user.is_superuser is False
    assert updated_user.is_active is True


@pytest.mark.anyio
async def test_admin_update_user_existing_email_returns_409(
    client: AsyncClient, superuser_token_headers: dict[str, str]
) -> None:
    user = await create_test_user()

    data = {"email": settings.FIRST_SUPERUSER}
    response = await client.patch(
        f"{settings.API_V1_STR}/users/{user.uuid}",
        json=data,
        headers=superuser_token_headers,
    )
    assert response.status_code == 409