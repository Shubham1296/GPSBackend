# models.py
from sqlalchemy import Column, Float, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
from sqlalchemy.dialects.postgresql import TIMESTAMP as PG_TIMESTAMP

timestamp = Column(PG_TIMESTAMP(timezone=True), nullable=False)

import uuid

Base = declarative_base()

class Frame(Base):
    __tablename__ = "frames"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(PG_TIMESTAMP(timezone=True), nullable=False)
    lat = Column(Float)
    lon = Column(Float)
    file_path = Column(String, nullable=False)
    is_pothole = Column(Boolean, default=False)   # NEW FIELD
