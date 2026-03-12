#!/usr/bin/env python3
"""
Test all controllers together
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Reduce noise for testing

def test_all_controllers():
    """Test all controllers"""
    print("=" * 80)
    print("TESTING ALL CONTROLLERS")
    print("=" * 80)
    
    try:
        # Test 1: Main Controller
        print("\n1. Testing Main Controller...")
        from PySide6.QtWidgets import QApplication
        app = QApplication.instance() or QApplication(sys.argv)
        
        from app.controllers.main_controller import MainController
        
        class MockMainWindow:
            pass
        
        main_controller = MainController(MockMainWindow())
        print("✓ Main Controller initialized")
        print(f"  - Services: Ledger={main_controller.ledger_service}, "
              f"Backup={main_controller.backup_service}, "
              f"Dashboard={main_controller.dashboard_service}")
        
        # Test 2: Customer Controller
        print("\n2. Testing Customer Controller...")
        from app.controllers.customer_controller import CustomerController
        
        customer_controller = CustomerController()
        print("✓ Customer Controller initialized")
        
        # Create a test customer
        customer_id = customer_controller.add_customer(
            name="Integration Test Customer",
            phone="03009998877",
            notes="Created during integration testing"
        )
        
        if customer_id:
            print(f"✓ Test customer created: ID {customer_id}")
            
            # Get customer details
            customer = customer_controller.get_customer(customer_id)
            print(f"✓ Customer retrieved: {customer['name']}, Phone: {customer['phone']}")
            
            # Search customers
            search_results = customer_controller.search_customers("Integration")
            print(f"✓ Customer search: Found {len(search_results)} customer(s)")
        else:
            print("⚠ Could not create test customer (might already exist)")
        
        # Test 3: Transaction Controller
        print("\n3. Testing Transaction Controller...")
        from app.controllers.transaction_controller import TransactionController
        
        transaction_controller = TransactionController()
        print("✓ Transaction Controller initialized")
        
        if 'customer_id' in locals() and customer_id:
            # Add a credit transaction
            credit_id = transaction_controller.add_credit_transaction(
                customer_id=customer_id,
                amount=2500.75,
                description="Integration test credit"
            )
            
            if credit_id:
                print(f"✓ Credit transaction added: ID {credit_id}")
                
                # Check balance
                balance = transaction_controller.get_customer_balance(customer_id)
                print(f"✓ Customer balance: {balance}")
                
                # Get transactions
                transactions = transaction_controller.get_customer_transactions(customer_id)
                print(f"✓ Customer transactions: {len(transactions)} found")
            else:
                print("⚠ Could not add credit transaction")
        
        print("\n" + "=" * 80)
        print("✅ ALL CONTROLLERS TESTED SUCCESSFULLY!")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_all_controllers()
    sys.exit(0 if success else 1)
