"""
Backup model for tracking backup operations.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class BackupRecord(Base):
    """Model to track backup operations"""
    
    __tablename__ = "backup_records"
    
    # Fields
    backup_file: Mapped[str] = mapped_column(String(500), nullable=False)
    backup_size: Mapped[int] = mapped_column(Integer, nullable=False)  # Size in bytes
    backup_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    backup_type: Mapped[str] = mapped_column(String(20), nullable=False)  # AUTO, MANUAL
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    @property
    def formatted_size(self) -> str:
        """Get human-readable file size"""
        size = self.backup_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
    
    def summary(self) -> dict:
        """Get backup summary"""
        return {
            'id': self.id,
            'backup_file': self.backup_file,
            'backup_size': self.backup_size,
            'formatted_size': self.formatted_size,
            'backup_date': self.backup_date.isoformat() if self.backup_date else None,
            'backup_type': self.backup_type,
            'success': self.success,
            'error_message': self.error_message
        }
    
    def __str__(self) -> str:
        """String representation"""
        status = "✓" if self.success else "✗"
        return f"{status} {self.backup_type} - {self.backup_file} - {self.backup_date.strftime('%Y-%m-%d %H:%M')}"
    
    def __repr__(self) -> str:
        """Detailed representation"""
        return f"<BackupRecord(id={self.id}, file='{self.backup_file}', type='{self.backup_type}', success={self.success})>"
