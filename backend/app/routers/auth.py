from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from app.core.security import verify_password, create_access_token, hash_password
from app.core.permissions import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserResponse, UserCreate

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and return JWT",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "example": "admin"},
                            "password": {"type": "string", "example": "AdminSecurePassword123!"}
                        },
                        "required": ["username", "password"]
                    }
                },
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "example": "admin"},
                            "password": {"type": "string", "example": "AdminSecurePassword123!"}
                        },
                        "required": ["username", "password"]
                    }
                }
            }
        }
    }
)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate Admin or regular User credentials and issue a signed JWT access token.
    
    Supports both JSON body (`{"username": "...", "password": "..."}`) and 
    form-urlencoded data (`username=...&password=...`).
    """
    username = None
    password = None

    content_type = request.headers.get("content-type", "").lower()

    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                username = body.get("username")
                password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )
    else:
        # Support application/x-www-form-urlencoded and multipart/form-data
        try:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request data",
            )

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required",
        )

    user = db.query(User).filter(User.username == str(username).strip()).first()

    if not user or not verify_password(str(password), user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Encode token payload with user ID, role, and username
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
    }
    access_token = create_access_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse, summary="Get current authenticated user profile")
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Return profile details for the currently authenticated user (Admin or User)."""
    return UserResponse.model_validate(current_user)


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account (Admin only)",
)
def create_user(
    user_in: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new user account. Accessible by Administrator only."""
    clean_username = user_in.username.strip()
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty",
        )

    # Check for duplicate username (case-insensitive)
    existing_user = db.query(User).filter(User.username.ilike(clean_username)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{clean_username}' already exists.",
        )

    # Hash the password with bcrypt
    hashed_pwd = hash_password(user_in.password)

    new_user = User(
        username=clean_username,
        hashed_password=hashed_pwd,
        role=user_in.role or "user",
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get(
    "/users",
    response_model=List[UserResponse],
    summary="List user accounts (Admin only)",
)
def list_users(
    skip: int = Query(0, ge=0, description="Items to skip for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Maximum items to return"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all user accounts with pagination. Accessible by Administrator only."""
    users = db.query(User).order_by(User.id.asc()).offset(skip).limit(limit).all()
    return users

