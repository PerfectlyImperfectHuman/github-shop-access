"""
Settings model for storing application settings in the database.
"""

from typing import Optional
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Settings(Base):
    """Model for storing application settings"""
    
    __tablename__ = "settings"
    
    # Fields
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    def __str__(self) -> str:
        """String representation"""
        return f"{self.key} = {self.value}"
    
    def __repr__(self) -> str:
        """Detailed representation"""
        return f"<Settings(key='{self.key}', value='{self.value}')>"
