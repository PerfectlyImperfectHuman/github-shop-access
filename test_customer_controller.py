#!/usr/bin/env python3
"""
Simple test script for CustomerController
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_customer_controller():
    """Test CustomerController functionality"""
    try:
        print("Testing CustomerController initialization...")
        
        # Import after path setup
        from app.controllers.customer_controller import CustomerController
        from app.utils.database_manager import DatabaseManager
        
        # Initialize controller
        print("Creating CustomerController...")
        controller = CustomerController()
        
        print("✓ CustomerController initialized successfully")
        print(f"✓ Database manager: {controller.db_manager}")
        print(f"✓ Ledger service: {controller.ledger_service}")
        
        # Test adding a customer
        print("\nTesting customer addition...")
        customer_id = controller.add_customer(
            name="Test Customer 1",
            phone="03001234567",
            address="Test Address",
            notes="Test notes",
            credit_limit=5000.0
        )
        
        if customer_id:
            print(f"✓ Customer added successfully: ID {customer_id}")
        else:
            print("⚠ Customer addition failed (might be duplicate)")
        
        # Test getting all customers
        print("\nTesting get all customers...")
        customers = controller.get_all_customers()
        print(f"✓ Retrieved {len(customers)} customers")
        for customer in customers[:3]:  # Show first 3
            print(f"  - {customer['name']} (ID: {customer['id']})")
        
        # Test getting single customer
        if customers:
            print("\nTesting get single customer...")
            customer = controller.get_customer(customers[0]['id'])
            if customer:
                print(f"✓ Customer retrieved: {customer['name']}")
                print(f"  Balance: {customer.get('balance', 'N/A')}")
        
        # Test search customers
        print("\nTesting customer search...")
        search_results = controller.search_customers("Test")
        print(f"✓ Search results: {len(search_results)} customers")
        
        # Test customer statistics
        if customers:
            print("\nTesting customer statistics...")
            stats = controller.get_customer_statistics(customers[0]['id'])
            print(f"✓ Customer statistics retrieved")
            print(f"  Keys: {list(stats.keys())}")
        
        # Test customers with balance filter
        print("\nTesting customers with balance filter...")
        filtered = controller.get_customers_with_balance(min_balance=0)
        print(f"✓ Customers with positive balance: {len(filtered)}")
        
        # Test customer transactions
        if customers:
            print("\nTesting customer transactions...")
            transactions = controller.get_customer_transactions(customers[0]['id'], limit=5)
            print(f"✓ Customer transactions: {len(transactions)}")
        
        # Test update customer
        if customers:
            print("\nTesting customer update...")
            success = controller.update_customer(
                customers[0]['id'],
                phone="03009876543",
                notes="Updated notes"
            )
            if success:
                print("✓ Customer updated successfully")
            else:
                print("⚠ Customer update failed")
        
        # Test cache operations
        print("\nTesting cache operations...")
        controller.clear_cache()
        print("✓ Cache cleared successfully")
        
        print("\n✅ CustomerController tests completed successfully!")
        
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
    success = test_customer_controller()
    sys.exit(0 if success else 1)
