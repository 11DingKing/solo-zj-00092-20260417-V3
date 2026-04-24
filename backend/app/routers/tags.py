from typing import List
from uuid import UUID

from beanie.operators import In, All
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pymongo import errors

from .. import models, schemas
from ..auth.auth import get_current_active_superuser, get_current_active_user

router = APIRouter()


@router.post("", response_model=schemas.Tag)
async def create_tag(
    tag_data: schemas.TagCreate,
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Create a new tag.
    """
    existing_tag = await models.Tag.find_one({"name": tag_data.name})
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag with that name already exists.",
        )
    
    tag = models.Tag(
        name=tag_data.name,
        color=tag_data.color,
    )
    try:
        await tag.create()
        return tag
    except errors.DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag with that name already exists.",
        )


@router.get("", response_model=List[schemas.Tag])
async def get_tags(
    limit: int | None = 100,
    offset: int | None = 0,
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Get all tags.
    """
    tags = await models.Tag.find_all().skip(offset).limit(limit).sort("-created_at").to_list()
    return tags


@router.get("/{tag_uuid}", response_model=schemas.Tag)
async def get_tag(
    tag_uuid: UUID,
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Get a specific tag by UUID.
    """
    tag = await models.Tag.find_one({"uuid": tag_uuid})
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.patch("/{tag_uuid}", response_model=schemas.Tag)
async def update_tag(
    tag_uuid: UUID,
    update: schemas.TagUpdate,
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Update a tag.
    """
    tag = await models.Tag.find_one({"uuid": tag_uuid})
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    update_data = update.model_dump(exclude_unset=True)
    
    if "name" in update_data:
        existing_tag = await models.Tag.find_one({"name": update_data["name"]})
        if existing_tag and str(existing_tag.uuid) != str(tag_uuid):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tag with that name already exists.",
            )
    
    updated_tag = tag.model_copy(update=update_data)
    try:
        await updated_tag.save()
        return updated_tag
    except errors.DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag with that name already exists.",
        )


@router.delete("/{tag_uuid}", response_model=schemas.Tag)
async def delete_tag(
    tag_uuid: UUID,
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Delete a tag and remove it from all users' tag_ids.
    """
    tag = await models.Tag.find_one({"uuid": tag_uuid})
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    await models.User.find({"tag_ids": {"$in": [tag_uuid]}}).update(
        {"$pull": {"tag_ids": tag_uuid}}
    )
    
    await tag.delete()
    return tag


@router.post("/batch-delete", response_model=List[schemas.Tag])
async def batch_delete_tags(
    tag_uuids: List[UUID] = Body(...),
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Batch delete multiple tags and remove them from all users' tag_ids.
    """
    deleted_tags: List[models.Tag] = []
    for tag_uuid in tag_uuids:
        tag = await models.Tag.find_one({"uuid": tag_uuid})
        if tag is not None:
            await models.User.find({"tag_ids": {"$in": [tag_uuid]}}).update(
                {"$pull": {"tag_ids": tag_uuid}}
            )
            await tag.delete()
            deleted_tags.append(tag)
    return deleted_tags
