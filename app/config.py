"""
Configuration management for the Shop Management System.
Handles database, backup, and application settings.
"""

import os
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()


@dataclass
class DatabaseConfig:
    """Database configuration"""
    dialect: str = "sqlite"
    driver: str = "pysqlite"
    database_name: str = "shop_management.db"
    echo: bool = False  # Set to True for SQL logging in development
    
    @property
    def url(self) -> str:
        """Get database URL for SQLAlchemy"""
        return f"{self.dialect}+{self.driver}:///{self.database_name}"


@dataclass
class BackupConfig:
    """Backup configuration"""
    backup_dir: str = "backups"
    retention_days: int = 40
    backup_prefix: str = "backup"
    auto_backup: bool = True
    auto_backup_time: str = "23:59"  # Daily backup time (HH:MM)
    max_backups: int = 40  # Maximum number of backups to keep


@dataclass
class AppConfig:
    """Application configuration"""
    app_name: str = "Shop Management System"
    app_version: str = "1.0.0"
    company_name: str = "Local Shop"
    currency_symbol: str = "Rs. "  # Pakistani Rupees
    date_format: str = "dd/MM/yyyy"
    time_format: str = "HH:mm"
    datetime_format: str = "dd/MM/yyyy HH:mm"
    
    # UI Settings
    window_width: int = 1200
    window_height: int = 800
    theme: str = "light"  # light, dark, system
    
    # Feature Flags
    enable_auto_backup: bool = True
    enable_transaction_corrections: bool = True
    enable_customer_duplicate_check: bool = True
    
    # Paths
    base_dir: Path = field(default_factory=lambda: Path(__file__).parent.parent)
    
    @property
    def database_path(self) -> Path:
        """Get full database path"""
        return self.base_dir / "shop_management.db"
    
    @property
    def backup_path(self) -> Path:
        """Get backup directory path"""
        return self.base_dir / "backups"
    
    @property
    def resources_path(self) -> Path:
        """Get resources directory path"""
        return self.base_dir / "resources"
    
    @property
    def styles_path(self) -> Path:
        """Get styles directory path"""
        return self.base_dir / "app" / "styles"
    
    def __post_init__(self):
        """Create necessary directories"""
        self.backup_path.mkdir(exist_ok=True)
        self.resources_path.mkdir(exist_ok=True)
        self.styles_path.mkdir(exist_ok=True)


class Config:
    """Main configuration class that loads and manages all configurations"""
    
    # Static class attributes for backward compatibility with settings_views.py
    DEFAULT_CURRENCY = "Rs. "
    DEFAULT_DATE_FORMAT = "dd/MM/yyyy"
    AUTO_BACKUP_ENABLED = True
    BACKUP_RETENTION_DAYS = 40
    DEFAULT_WINDOW_SIZE = (1200, 800)
    
    def __init__(self):
        # Initialize configurations
        self.app = AppConfig()
        self.database = DatabaseConfig()
        self.backup = BackupConfig()
        
        # Override from environment variables
        self._load_from_env()
        
        # Validate configurations
        self._validate_config()
    
    def _load_from_env(self):
        """Load configuration from environment variables"""
        # Database settings
        if db_name := os.getenv("DATABASE_NAME"):
            self.database.database_name = db_name
        
        if db_echo := os.getenv("DATABASE_ECHO"):
            self.database.echo = db_echo.lower() in ("true", "1", "yes")
        
        # Backup settings
        if retention_days := os.getenv("BACKUP_RETENTION_DAYS"):
            try:
                self.backup.retention_days = int(retention_days)
            except ValueError:
                pass
        
        if auto_backup := os.getenv("AUTO_BACKUP"):
            self.backup.auto_backup = auto_backup.lower() in ("true", "1", "yes")
        
        # App settings
        if currency := os.getenv("CURRENCY_SYMBOL"):
            self.app.currency_symbol = currency
        
        if date_fmt := os.getenv("DATE_FORMAT"):
            self.app.date_format = date_fmt
        
        if theme := os.getenv("THEME"):
            if theme in ("light", "dark", "system"):
                self.app.theme = theme
        
        # Window size
        if width := os.getenv("WINDOW_WIDTH"):
            try:
                self.app.window_width = int(width)
            except ValueError:
                pass
        
        if height := os.getenv("WINDOW_HEIGHT"):
            try:
                self.app.window_height = int(height)
            except ValueError:
                pass
    
    def _validate_config(self):
        """Validate configuration values"""
        # Validate backup retention
        if self.backup.retention_days < 1:
            self.backup.retention_days = 1
        
        # Validate window size
        if self.app.window_width < 800:
            self.app.window_width = 800
        if self.app.window_height < 600:
            self.app.window_height = 600
    
    @property
    def database_url(self) -> str:
        """Get the database URL as a property"""
        return self.database.url
    
    @property
    def backup_dir(self) -> Path:
        """Get backup directory path as a property"""
        return self.app.backup_path
    
    def to_dict(self) -> dict:
        """Convert configuration to dictionary for debugging"""
        return {
            "app": {
                "app_name": self.app.app_name,
                "app_version": self.app.app_version,
                "company_name": self.app.company_name,
                "currency_symbol": self.app.currency_symbol,
                "date_format": self.app.date_format,
                "window_width": self.app.window_width,
                "window_height": self.app.window_height,
                "theme": self.app.theme,
            },
            "database": {
                "database_name": self.database.database_name,
                "echo": self.database.echo,
                "url": self.database.url,
            },
            "backup": {
                "backup_dir": self.backup.backup_dir,
                "retention_days": self.backup.retention_days,
                "auto_backup": self.backup.auto_backup,
                "auto_backup_time": self.backup.auto_backup_time,
            }
        }
    
    def __str__(self) -> str:
        """String representation of configuration"""
        config_dict = self.to_dict()
        lines = ["Configuration:"]
        
        for section, values in config_dict.items():
            lines.append(f"\n  [{section}]")
            for key, value in values.items():
                lines.append(f"    {key}: {value}")
        
        return "\n".join(lines)


# Global configuration instance
config = Config()


def print_config():
    """Print current configuration (for debugging)"""
    print(config)


if __name__ == "__main__":
    # Test the configuration
    print_config()
    
    # Test paths
    print(f"\nDatabase path: {config.app.database_path}")
    print(f"Backup path: {config.app.backup_path}")
    print(f"Backup path exists: {config.app.backup_path.exists()}")