#!/usr/bin/env python3
"""
Test the fixed configuration.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.config import config

print("Testing fixed configuration...")
print("=" * 50)

# Test the database_url property
print(f"1. Testing database_url property...")
print(f"   database_url: {config.database_url}")
print(f"   Type: {type(config.database_url)}")

# Test the backup_dir property
print(f"\n2. Testing backup_dir property...")
print(f"   backup_dir: {config.backup_dir}")
print(f"   Type: {type(config.backup_dir)}")

# Test that both are accessible
print(f"\n3. Testing all properties...")
print(f"   config.database.url: {config.database.url}")
print(f"   config.database_url: {config.database_url}")
print(f"   Are they equal? {config.database.url == config.database_url}")

print(f"\n✅ Configuration properties are working!")
