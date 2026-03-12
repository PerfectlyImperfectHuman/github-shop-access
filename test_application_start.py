#!/usr/bin/env python3
"""
Test application startup and basic functionality.
"""

import sys
import os
import logging
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.utils.database_manager import DatabaseManager

def test_setup():
    """Test basic application setup"""
    print("🔍 Testing application setup...")
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    logger.info("Test application setup starting")
    
    try:
        # Test database
        db_manager = DatabaseManager()
        db_manager.initialize()
        db_manager.create_tables()
        logger.info("Database initialized")
        
        # Test database integrity
        integrity = db_manager.check_integrity()
        print(f"✅ Database integrity check: {integrity.get('integrity', 'N/A')}")
        
        # Get database info
        info = db_manager.get_database_info()
        print(f"✅ Database info: {len(info.get('tables', []))} tables")
        
        # Test backup
        backup_result = db_manager.backup_database(backup_type='MANUAL')
        if backup_result.get('success'):
            print(f"✅ Backup created: {backup_result.get('backup_path', 'N/A')}")
        else:
            print(f"⚠️ Backup creation failed: {backup_result.get('error', 'Unknown error')}")
        
        print("✅ Application setup test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"Application setup test FAILED: {e}", exc_info=True)
        print(f"❌ Application setup test FAILED: {e}")
        return False
    finally:
        # Cleanup
        if 'db_manager' in locals():
            db_manager.close()

if __name__ == "__main__":
    success = test_setup()
    sys.exit(0 if success else 1)
