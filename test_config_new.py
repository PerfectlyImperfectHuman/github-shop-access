#!/usr/bin/env python3
"""
Test script to verify config module
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import Config, config

def test_config():
    """Test that config module works correctly"""
    print("🔍 Testing configuration...")
    
    try:
        # Test config instance
        print("  Testing config instance...")
        print(f"  ✅ Config loaded: {config}")
        
        # Test database URL
        print(f"  Database URL: {config.database_url}")
        print(f"  Database path exists: {config.app.database_path.exists()}")
        
        # Test backup directory
        print(f"  Backup directory: {config.backup_dir}")
        print(f"  Backup directory exists: {config.backup_dir.exists()}")
        
        # Test static attributes (used by settings_views.py)
        print("  Testing static attributes...")
        print(f"  DEFAULT_CURRENCY: {Config.DEFAULT_CURRENCY}")
        print(f"  DEFAULT_DATE_FORMAT: {Config.DEFAULT_DATE_FORMAT}")
        print(f"  BACKUP_RETENTION_DAYS: {Config.BACKUP_RETENTION_DAYS}")
        
        print("\n🎉 All config tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Config test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_config()
    sys.exit(0 if success else 1)
