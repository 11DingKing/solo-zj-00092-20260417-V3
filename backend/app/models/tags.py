from typing import Annotated
from uuid import UUID, uuid4
from datetime import datetime

from beanie import Document, Indexed
from pydantic import Field


class Tag(Document):
    uuid: Annotated[UUID, Field(default_factory=uuid4), Indexed(unique=True)]
    name: Annotated[str, Indexed(unique=True)]
    color: str = "#1976d2"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tags"
