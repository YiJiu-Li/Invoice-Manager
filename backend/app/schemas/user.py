from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    is_admin: bool = False


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str]
    is_admin: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    new_password: str
