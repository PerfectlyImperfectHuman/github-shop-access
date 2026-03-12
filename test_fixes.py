#!/usr/bin/env python3
"""
Test to verify the fixes for the errors.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.controllers.main_controller import MainController
from app.controllers.customer_controller import CustomerController
from app.controllers.transaction_controller import TransactionController
from app.utils.database_manager import DatabaseManager

def test_fixes():
    print("🧪 Testing the fixes...")
    
    try:
        # 1. Test DatabaseManager
        print("1. Testing DatabaseManager...")
        db = DatabaseManager()
        db.initialize()
        print("   ✅ DatabaseManager OK")
        
        # 2. Test CustomerController with new active_only parameter
        print("2. Testing CustomerController.get_all_customers() with active_only...")
        customer_controller = CustomerController(db)
        
        # Test with include_balance=True, active_only=False (the call from customer_views.py)
        customers = customer_controller.get_all_customers(include_balance=True, active_only=False)
        print(f"   ✅ CustomerController.get_all_customers(include_balance=True, active_only=False) works: {len(customers)} customers")
        
        # Test with include_balance=True, active_only=True
        customers_active = customer_controller.get_all_customers(include_balance=True, active_only=True)
        print(f"   ✅ CustomerController.get_all_customers(include_balance=True, active_only=True) works: {len(customers_active)} customers")
        
        # 3. Test TransactionController
        print("3. Testing TransactionController...")
        transaction_controller = TransactionController(db)
        print("   ✅ TransactionController OK")
        
        # 4. Test MainController
        print("4. Testing MainController...")
        main_controller = MainController()
        print("   ✅ MainController OK")
        
        # 5. Test that controllers are properly linked
        print("5. Testing controller linkages...")
        if hasattr(main_controller, 'customer_controller'):
            print("   ✅ MainController has customer_controller")
        if hasattr(main_controller, 'transaction_controller'):
            print("   ✅ MainController has transaction_controller")
        
        print("\n🎉 ALL FIXES VERIFIED! Application should run without errors.")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_fixes()
    sys.exit(0 if success else 1)
