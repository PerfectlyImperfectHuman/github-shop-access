#!/usr/bin/env python3
"""
Simple test to verify the application can start without GUI
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.utils.database_manager import DatabaseManager
from app.controllers.main_controller import MainController

def test():
    print("🧪 Simple application test...")
    
    try:
        # Test database
        db = DatabaseManager()
        db.verify_database()
        print("✅ Database OK")
        
        # Test main controller
        controller = MainController()  # Should work now with optional parameter
        print("✅ MainController OK")
        
        # Test settings
        settings = controller.get_settings()
        print(f"✅ Settings loaded: {len(settings)} settings")
        
        # Test services
        summary = controller.get_application_summary()
        print(f"✅ Application summary: {summary.get('total_customers', 0)} customers")
        
        print("\n🎉 All tests passed! Application should run correctly.")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test()
    sys.exit(0 if success else 1)
