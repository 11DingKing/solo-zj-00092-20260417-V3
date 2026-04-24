from uuid import UUID
from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, Field


class TagBase(BaseModel):
    name: str
    color: str = "#1976d2"


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class Tag(TagBase):
    id: PydanticObjectId = Field()
    uuid: UUID
    created_at: datetime

    class Config:
        from_attributes = True
