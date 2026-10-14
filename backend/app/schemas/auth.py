from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username for login")
    password: str = Field(..., min_length=1, description="Password for login")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str
    username: str
    role: str
    exp: Optional[int] = None
