# auth.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
from pydantic import BaseModel
from typing import Optional
import uuid

from database import get_db
from models import User, Organization, UserRole

# NOTE: Keep SECRET_KEY in sync with server.py
SECRET_KEY = "1e6f2130f17354bdf1c9ff2b07dfe5f05d8cb9d9840676b7033a665369717639"  # <-- Replace in prod (env var)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter()


class AuthIn(BaseModel):
    email: str
    password: str
    role: Optional[str] = "ordinary"  # For admin to set role during user creation
    organization_name: Optional[str] = None


async def get_or_create_default_organization(db: AsyncSession) -> uuid.UUID:
    """Get or create the default organization"""
    stmt = select(Organization).where(Organization.name == "Default Organization")
    result = await db.execute(stmt)
    org = result.scalar_one_or_none()

    if not org:
        org = Organization(
            id=uuid.uuid4(),
            name="Default Organization"
        )
        db.add(org)
        await db.commit()
        await db.refresh(org)

    return org.id


@router.post("/register")
async def register(payload: AuthIn, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    resp = await db.execute(stmt)
    existing = resp.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    # Get or create default organization
    org_id = await get_or_create_default_organization(db)

    # Validate role
    role = UserRole.ORDINARY
    if payload.role:
        try:
            role = UserRole(payload.role.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be 'admin' or 'ordinary'")

    hashed = pwd_ctx.hash(payload.password)
    user = User(
        email=payload.email,
        password_hash=hashed,
        role=role,
        organization_id=org_id
    )
    db.add(user)
    await db.commit()
    return {"message": "ok", "role": role.value, "organization_id": str(org_id)}


@router.post("/login")
async def login(payload: AuthIn, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    resp = await db.execute(stmt)
    user = resp.scalar_one_or_none()
    if not user or not pwd_ctx.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Include role and organization in token
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": payload.email,
        "role": user.role.value if user.role else "ordinary",
        "organization_id": str(user.organization_id) if user.organization_id else None,
        "exp": expire
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "token": token,
        "role": user.role.value if user.role else "ordinary",
        "organization_id": str(user.organization_id) if user.organization_id else None
    }
