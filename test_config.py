#!/usr/bin/env python3
"""
Test the configuration system.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.config import config, print_config

print("Testing configuration system...")
print("=" * 50)

# Print the configuration
print_config()

# Test specific properties
print("\n" + "=" * 50)
print("Testing specific properties:")

# Database
print(f"Database URL: {config.get_database_url()}")
print(f"Database path: {config.app.database_path}")
print(f"Database path exists: {config.app.database_path.exists()}")

# Backup
print(f"\nBackup directory: {config.get_backup_dir()}")
print(f"Backup directory exists: {config.get_backup_dir().exists()}")
print(f"Backup retention days: {config.backup.retention_days}")

# App settings
print(f"\nCurrency symbol: {config.app.currency_symbol}")
print(f"Date format: {config.app.date_format}")
print(f"Window size: {config.app.window_width}x{config.app.window_height}")

# Test to_dict method
print("\n" + "=" * 50)
print("Testing to_dict method:")
config_dict = config.to_dict()
print(f"Keys in config dict: {list(config_dict.keys())}")

print("\n✅ Configuration test completed successfully!")
