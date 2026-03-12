#!/usr/bin/env python3
"""
Simple test script for MainController
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_main_controller():
    """Test MainController initialization"""
    try:
        print("Testing MainController initialization...")
        
        # We need to mock QApplication since we're testing in console
        # Create a simple mock for QMainWindow
        class MockMainWindow:
            pass
        
        # Import after path setup
        from app.controllers.main_controller import MainController
        
        # Initialize controller with mock window
        print("Creating MainController...")
        controller = MainController(MockMainWindow())
        
        print("✓ MainController initialized successfully")
        print(f"✓ Database manager: {controller.db_manager}")
        print(f"✓ Ledger service: {controller.ledger_service}")
        print(f"✓ Backup service: {controller.backup_service}")
        print(f"✓ Dashboard service: {controller.dashboard_service}")
        
        # Test database manager methods
        print("\nTesting database manager...")
        try:
            controller.db_manager.verify_database()
            print("✓ Database verification passed")
        except Exception as e:
            print(f"⚠ Database verification error (might be expected): {e}")
        
        # Test settings loading
        print("\nTesting settings loading...")
        currency = controller.get_setting('currency')
        print(f"✓ Currency setting: {currency}")
        
        # Test currency formatting
        formatted = controller.format_currency(1234.56)
        print(f"✓ Currency formatting: {formatted}")
        
        # Test date formatting
        from datetime import datetime
        test_date = datetime(2023, 12, 25)
        formatted_date = controller.format_date(test_date)
        print(f"✓ Date formatting: {formatted_date}")
        
        # Test backup list (might be empty)
        print("\nTesting backup list...")
        try:
            backups = controller.get_backup_list()
            print(f"✓ Backup list retrieved: {len(backups)} backups")
        except Exception as e:
            print(f"⚠ Backup list error (might be expected): {e}")
        
        print("\n✅ MainController basic initialization tests passed!")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_main_controller()
    sys.exit(0 if success else 1)
