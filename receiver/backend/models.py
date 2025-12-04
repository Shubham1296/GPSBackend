# models.py
from sqlalchemy import Column, Float, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import TIMESTAMP as PG_TIMESTAMP
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Column, Integer
from sqlalchemy import Text
import enum
import uuid

Base = declarative_base()

class Frame(Base):
    __tablename__ = "frames"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(PG_TIMESTAMP(timezone=True), nullable=False)
    lat = Column(Float)
    lon = Column(Float)
    file_path = Column(String, nullable=False)
    is_pothole = Column(Boolean, default=False)
    porthole_area_percentage = Column(Float, default=0.0, nullable=False, server_default='0.0')

# -----------------------
# Organization model
# -----------------------
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default='now()')

    # Relationship
    users = relationship("User", back_populates="organization")

# -----------------------
# User role enum
# -----------------------
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ORDINARY = "ordinary"

class User(Base):
    __tablename__ = "users"

    # Using email as primary key (string); change if you prefer numeric id
    email = Column(String, primary_key=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.ORDINARY, server_default='ordinary')
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=True)

    # Relationship
    organization = relationship("Organization", back_populates="users")
