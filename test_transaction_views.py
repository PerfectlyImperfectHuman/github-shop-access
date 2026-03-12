#!/usr/bin/env python3
"""
Simple test script for Transaction Views
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_transaction_views():
    """Test Transaction Views initialization and basic functionality"""
    try:
        print("Testing Transaction Views...")
        
        # Import required modules
        from PySide6.QtWidgets import QApplication
        from app.controllers.main_controller import MainController
        from app.controllers.customer_controller import CustomerController
        from app.controllers.transaction_controller import TransactionController
        from app.views.transaction_views import (
            TransactionListView, CreditTransactionDialog, 
            PaymentTransactionDialog, LedgerView
        )
        
        # Create QApplication instance
        app = QApplication.instance() or QApplication(sys.argv)
        
        # Create controllers
        print("Creating controllers...")
        main_controller = MainController(None)
        customer_controller = CustomerController()
        transaction_controller = TransactionController()
        
        # Test 1: Transaction List View
        print("\n1. Testing TransactionListView...")
        transaction_list = TransactionListView(
            transaction_controller, customer_controller, main_controller
        )
        
        print("✓ TransactionListView created successfully")
        print(f"✓ Filter panel created")
        print(f"✓ Table columns: {transaction_list.transaction_table.columnCount()}")
        print(f"✓ Stats label: {transaction_list.stats_label.text()}")
        
        # Test refresh
        transaction_list.refresh()
        print("✓ Transaction list refresh initiated")
        
        # Test 2: Credit Transaction Dialog
        print("\n2. Testing CreditTransactionDialog...")
        credit_dialog = CreditTransactionDialog(
            transaction_controller, customer_controller, main_controller, None
        )
        
        print("✓ CreditTransactionDialog created successfully")
        print(f"✓ Customer combo: {credit_dialog.customer_combo.count()} customers")
        print(f"✓ Amount input: {credit_dialog.amount_input.value()}")
        
        # Test 3: Payment Transaction Dialog
        print("\n3. Testing PaymentTransactionDialog...")
        payment_dialog = PaymentTransactionDialog(
            transaction_controller, customer_controller, main_controller, None
        )
        
        print("✓ PaymentTransactionDialog created successfully")
        print(f"✓ Payment method combo: {payment_dialog.method_combo.count()} methods")
        
        # Test 4: Ledger View
        print("\n4. Testing LedgerView...")
        ledger_view = LedgerView(
            transaction_controller, customer_controller, main_controller
        )
        
        print("✓ LedgerView created successfully")
        print(f"✓ Ledger table columns: {ledger_view.ledger_table.columnCount()}")
        
        # Refresh ledger
        ledger_view._refresh_ledger()
        print("✓ Ledger refresh initiated")
        
        # Test 5: Show views briefly
        print("\nDisplaying views for 2 seconds each...")
        
        print("  Showing TransactionListView...")
        transaction_list.show()
        import time
        start_time = time.time()
        while time.time() - start_time < 2:
            app.processEvents()
            time.sleep(0.01)
        
        print("  Showing LedgerView...")
        ledger_view.show()
        start_time = time.time()
        while time.time() - start_time < 2:
            app.processEvents()
            time.sleep(0.01)
        
        print("\n✅ Transaction Views tests completed successfully!")
        
        # Clean up
        transaction_list.close()
        ledger_view.close()
        main_controller.cleanup()
        
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
    success = test_transaction_views()
    sys.exit(0 if success else 1)
