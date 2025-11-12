from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import uuid4
from app.database import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    new_user = User(
        id=str(uuid4()),
        name=user_data.name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=UserRole.USER,
        total_points=0
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": new_user.id, "role": new_user.role})

    return {
        "token": access_token,
        "userType": new_user.role.value
    }


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login user and return JWT token."""
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.id, "role": user.role})

    return {
        "token": access_token,
        "userType": user.role.value
    }


@router.post("/logout")
async def logout():
    """Logout endpoint (mainly for frontend to clear local storage)."""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=dict)
async def me(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current authenticated user's profile."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value if isinstance(user.role, UserRole) else user.role,
        "total_points": getattr(user, 'total_points', 0),
        "created_at": user.created_at,
    }
