# auth.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
from pydantic import BaseModel

from database import get_db
from models import User

# NOTE: Keep SECRET_KEY in sync with server.py
SECRET_KEY = "1e6f2130f17354bdf1c9ff2b07dfe5f05d8cb9d9840676b7033a665369717639"  # <-- Replace in prod (env var)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter()


class AuthIn(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(payload: AuthIn, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    resp = await db.execute(stmt)
    existing = resp.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed = pwd_ctx.hash(payload.password)
    user = User(email=payload.email, password_hash=hashed)
    db.add(user)
    await db.commit()
    return {"message": "ok"}


@router.post("/login")
async def login(payload: AuthIn, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    resp = await db.execute(stmt)
    user = resp.scalar_one_or_none()
    if not user or not pwd_ctx.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": payload.email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token}
