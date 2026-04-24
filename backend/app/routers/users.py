from typing import Any, List
from uuid import UUID

from beanie.exceptions import RevisionIdWasChanged
from beanie.operators import In
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic.networks import EmailStr
from pymongo import errors

from .. import models, schemas
from ..auth.auth import (
    get_current_active_superuser,
    get_current_active_user,
    get_hashed_password,
)

router = APIRouter()


@router.post("", response_model=schemas.User)
async def register_user(
    password: str = Body(...),
    email: EmailStr = Body(...),
    first_name: str = Body(None),
    last_name: str = Body(None),
):
    """
    Register a new user.
    """
    hashed_password = get_hashed_password(password)
    user = models.User(
        email=email,
        hashed_password=hashed_password,
        first_name=first_name,
        last_name=last_name,
    )
    try:
        await user.create()
        return user
    except errors.DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with that email already exists.",
        )


@router.get("", response_model=list[schemas.User])
async def get_users(
    limit: int | None = 10,
    offset: int | None = 0,
    tag_ids: List[UUID] | None = Query(None),
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Get users, optionally filtered by tags (AND logic).
    """
    query = models.User.find()
    
    if tag_ids and len(tag_ids) > 0:
        for tag_id in tag_ids:
            query = query.find({"tag_ids": tag_id})
    
    users = await query.skip(offset).limit(limit).to_list()
    return users


@router.post("/{userid}/tags", response_model=schemas.User)
async def add_tags_to_user(
    userid: UUID,
    tag_uuids: List[UUID] = Body(...),
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Add one or more tags to a user.
    """
    user = await models.User.find_one({"uuid": userid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    for tag_uuid in tag_uuids:
        tag = await models.Tag.find_one({"uuid": tag_uuid})
        if tag is None:
            raise HTTPException(status_code=404, detail=f"Tag with UUID {tag_uuid} not found")
        if tag_uuid not in user.tag_ids:
            user.tag_ids.append(tag_uuid)
    
    await user.save()
    return user


@router.delete("/{userid}/tags/{tag_uuid}", response_model=schemas.User)
async def remove_tag_from_user(
    userid: UUID,
    tag_uuid: UUID,
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Remove a tag from a user.
    """
    user = await models.User.find_one({"uuid": userid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if tag_uuid in user.tag_ids:
        user.tag_ids.remove(tag_uuid)
        await user.save()
    
    return user


@router.get("/me", response_model=schemas.User)
async def get_profile(
    current_user: models.User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.patch("/me", response_model=schemas.User)
async def update_profile(
    update: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_active_user),
) -> Any:
    """
    Update current user.
    """
    update_data = update.model_dump(
        exclude={"is_active", "is_superuser"}, exclude_unset=True
    )
    try:
        if update_data["password"]:
            update_data["hashed_password"] = get_hashed_password(update_data["password"])
            del update_data["password"]
    except KeyError:
        pass
    current_user = current_user.model_copy(update=update_data)
    try:
        await current_user.save()
        return current_user
    except (errors.DuplicateKeyError, RevisionIdWasChanged):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with that email already exists.",
        )


@router.delete("/me", response_model=schemas.User)
async def delete_me(user: models.User = Depends(get_current_active_user)):
    await user.delete()
    return user


@router.patch("/{userid}", response_model=schemas.User)
async def update_user(
    userid: UUID,
    update: schemas.UserUpdate,
    admin_user: models.User = Depends(get_current_active_superuser),
) -> Any:
    """
    Update a user.

    ** Restricted to superuser **

    Parameters
    ----------
    userid : UUID
        the user's UUID
    update : schemas.UserUpdate
        the update data
    current_user : models.User, optional
        the current superuser, by default Depends(get_current_active_superuser)
    """
    user = await models.User.find_one({"uuid": userid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = update.model_dump(exclude_unset=True)
    try:
        if update_data["password"]:
            update_data["hashed_password"] = get_hashed_password(update_data["password"])
            del update_data["password"]
    except KeyError:
        pass
    updated_user = user.model_copy(update=update_data)
    try:
        await updated_user.save()
        return updated_user
    except (errors.DuplicateKeyError, RevisionIdWasChanged):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with that email already exists.",
        )


@router.get("/{userid}", response_model=schemas.User)
async def get_user(
    userid: UUID, admin_user: models.User = Depends(get_current_active_superuser)
):
    """
    Get User Info

    ** Restricted to superuser **

    Parameters
    ----------
    userid : UUID
        the user's UUID

    Returns
    -------
    schemas.User
        User info
    """
    user = await models.User.find_one({"uuid": userid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{userid}", response_model=schemas.User)
async def delete_user(
    userid: UUID, admin_user: models.User = Depends(get_current_active_superuser)
):
    user = await models.User.find_one({"uuid": userid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    await user.delete()
    return user


@router.post("/batch-delete", response_model=List[schemas.User])
async def batch_delete_users(
    user_ids: List[UUID] = Body(...),
    admin_user: models.User = Depends(get_current_active_superuser),
):
    """
    Batch delete multiple users.

    ** Restricted to superuser **

    Parameters
    ----------
    user_ids : List[UUID]
        List of user UUIDs to delete
    """
    deleted_users: List[models.User] = []
    for user_id in user_ids:
        user = await models.User.find_one({"uuid": user_id})
        if user is not None:
            await user.delete()
            deleted_users.append(user)
    return deleted_users
