from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserLogin, UserCreate, UserResponse, Token,
    ChangePasswordRequest, ResetPasswordRequest,
)
from app.auth import hash_password, verify_password, create_access_token, get_current_user, get_admin_user

router = APIRouter()


@router.post("/register", response_model=Token)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    user = User(
        username=data.username,
        display_name=data.display_name or data.username,
        hashed_password=hash_password(data.password),
        is_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == data.username, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="原密码错误")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少6位")
    current_user.hashed_password = hash_password(data.new_password)
    db.add(current_user)
    await db.commit()
    return {"message": "密码修改成功"}


# ── Admin: user management ──────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    user = User(
        username=data.username,
        display_name=data.display_name or data.username,
        hashed_password=hash_password(data.password),
        is_admin=data.is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: ResetPasswordRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.hashed_password = hash_password(data.new_password)
    db.add(user)
    await db.commit()
    return {"message": "密码已重置"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己的账户")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.delete(user)
    await db.commit()
    return {"message": "用户已删除"}
