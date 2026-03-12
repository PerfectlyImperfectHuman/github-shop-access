#!/usr/bin/env python3
"""
Simple test script for Customer Views
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_customer_views():
    """Test Customer Views initialization and basic functionality"""
    try:
        print("Testing Customer Views...")
        
        # Import required modules
        from PySide6.QtWidgets import QApplication
        from app.controllers.main_controller import MainController
        from app.controllers.customer_controller import CustomerController
        from app.controllers.transaction_controller import TransactionController
        from app.views.customer_views import CustomerListView, CustomerDetailView
        
        # Create QApplication instance
        app = QApplication.instance() or QApplication(sys.argv)
        
        # Create controllers
        print("Creating controllers...")
        main_controller = MainController(None)
        customer_controller = CustomerController()
        transaction_controller = TransactionController()
        
        # Test 1: Customer List View
        print("\n1. Testing CustomerListView...")
        customer_list = CustomerListView(customer_controller)
        
        print("✓ CustomerListView created successfully")
        print(f"✓ Search input: {customer_list.search_input.placeholderText()}")
        print(f"✓ Table columns: {customer_list.customer_table.columnCount()}")
        print(f"✓ Status label: {customer_list.customer_count_label.text()}")
        
        # Test refresh
        customer_list.refresh()
        print("✓ Customer list refresh initiated")
        
        # Test 2: Customer Detail View
        print("\n2. Testing CustomerDetailView...")
        customer_detail = CustomerDetailView(customer_controller, transaction_controller, main_controller)
        
        print("✓ CustomerDetailView created successfully")
        print(f"✓ Detail labels: {len(customer_detail.detail_labels)}")
        print(f"✓ Transactions table: {customer_detail.transactions_table.columnCount()}")
        
        # Try to load a customer if one exists
        customers = customer_controller.get_all_customers()
        if customers:
            customer_id = customers[0]['id']
            print(f"\nLoading customer ID {customer_id}...")
            customer_detail.load_customer(customer_id)
            print(f"✓ Customer loaded: {customer_detail.title_label.text()}")
        
        # Test 3: Show views briefly
        print("\nDisplaying views for 2 seconds each...")
        
        print("  Showing CustomerListView...")
        customer_list.show()
        import time
        start_time = time.time()
        while time.time() - start_time < 2:
            app.processEvents()
            time.sleep(0.01)
        
        print("  Showing CustomerDetailView...")
        customer_detail.show()
        start_time = time.time()
        while time.time() - start_time < 2:
            app.processEvents()
            time.sleep(0.01)
        
        print("\n✅ Customer Views tests completed successfully!")
        
        # Clean up
        customer_list.close()
        customer_detail.close()
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
    success = test_customer_views()
    sys.exit(0 if success else 1)
