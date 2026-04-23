from typing import AsyncGenerator
from unittest.mock import patch

import pytest
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.auth import get_hashed_password
from app.config.config import settings
from app.main import app
from app.models import User

from .utils import get_user_auth_headers

MONGO_TEST_DB = f"test_{settings.MONGO_DB}"


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def clear_database(server: FastAPI) -> None:
    test_db = server.state.client[MONGO_TEST_DB]
    collections = await test_db.list_collections()
    async for collection in collections:
        await test_db[collection["name"]].delete_many({})


async def create_superuser() -> None:
    user = await User.find_one({"email": settings.FIRST_SUPERUSER})
    if not user:
        user = User(
            email=settings.FIRST_SUPERUSER,
            hashed_password=get_hashed_password(settings.FIRST_SUPERUSER_PASSWORD),
            is_superuser=True,
        )
        await user.create()


@pytest.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async server client that handles lifespan and teardown"""
    with patch("app.config.config.settings.MONGO_DB", MONGO_TEST_DB):
        async with LifespanManager(app):
            await clear_database(app)
            await create_superuser()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                yield client


@pytest.fixture()
async def superuser_token_headers(client: AsyncClient) -> dict[str, str]:
    return await get_user_auth_headers(
        client, settings.FIRST_SUPERUSER, settings.FIRST_SUPERUSER_PASSWORD
    )
