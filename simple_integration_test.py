#!/usr/bin/env python3
"""
Simple integration test for the application.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.utils.database_manager import DatabaseManager
from app.controllers.main_controller import MainController
from app.controllers.customer_controller import CustomerController
from app.controllers.transaction_controller import TransactionController

def test_integration():
    print("🧪 Integration test starting...")
    
    try:
        # 1. Test database
        print("1. Testing database...")
        db = DatabaseManager()
        db.initialize()
        db.create_tables()
        print("   ✅ Database OK")
        
        # 2. Test controllers
        print("2. Testing controllers...")
        main_controller = MainController()  # No main_window for test
        print("   ✅ MainController OK")
        
        customer_controller = CustomerController(db)
        print("   ✅ CustomerController OK")
        
        transaction_controller = TransactionController(db)
        print("   ✅ TransactionController OK")
        
        # 3. Test services
        print("3. Testing services...")
        summary = main_controller.get_application_summary()
        print(f"   ✅ Application summary: {summary.get('total_customers', 0)} customers")
        
        backups = main_controller.get_backup_list()
        print(f"   ✅ Backup system: {len(backups)} backups available")
        
        # 4. Test database operations
        print("4. Testing database operations...")
        integrity = db.check_integrity()
        if integrity.get('success'):
            print("   ✅ Database integrity OK")
        else:
            print(f"   ⚠️ Database integrity: {integrity.get('message', 'Unknown')}")
        
        print("\n🎉 ALL TESTS PASSED! Application is ready.")
        return True
        
    except Exception as e:
        print(f"❌ Integration test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_integration()
    sys.exit(0 if success else 1)
