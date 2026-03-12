#!/usr/bin/env python3
"""
Simple test script for TransactionController
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_transaction_controller():
    """Test TransactionController functionality"""
    try:
        print("Testing TransactionController initialization...")
        
        # Import after path setup
        from app.controllers.transaction_controller import TransactionController
        from app.controllers.customer_controller import CustomerController
        
        # Initialize controllers
        print("Creating TransactionController...")
        transaction_controller = TransactionController()
        customer_controller = CustomerController()
        
        print("✓ TransactionController initialized successfully")
        print(f"✓ Database manager: {transaction_controller.db_manager}")
        print(f"✓ Ledger service: {transaction_controller.ledger_service}")
        
        # First, create a test customer if none exists
        print("\nSetting up test customer...")
        customers = customer_controller.get_all_customers()
        
        if not customers:
            print("No customers found, creating test customer...")
            customer_id = customer_controller.add_customer(
                name="Test Customer for Transactions",
                phone="03001112222",
                notes="Test customer for transaction testing"
            )
            if customer_id:
                print(f"✓ Test customer created: ID {customer_id}")
            else:
                print("⚠ Could not create test customer")
                return False
        else:
            customer_id = customers[0]['id']
            print(f"✓ Using existing customer: ID {customer_id}")
        
        # Test adding credit transaction
        print("\nTesting credit transaction...")
        credit_id = transaction_controller.add_credit_transaction(
            customer_id=customer_id,
            amount=1500.50,
            description="Test credit purchase"
        )
        
        if credit_id:
            print(f"✓ Credit transaction added: ID {credit_id}")
        else:
            print("⚠ Credit transaction addition failed")
        
        # Test adding payment transaction
        print("\nTesting payment transaction...")
        payment_id = transaction_controller.add_payment_transaction(
            customer_id=customer_id,
            amount=500.25,
            description="Test payment",
            payment_method="cash"
        )
        
        if payment_id:
            print(f"✓ Payment transaction added: ID {payment_id}")
        else:
            print("⚠ Payment transaction addition failed")
        
        # Test getting customer transactions
        print("\nTesting get customer transactions...")
        transactions = transaction_controller.get_customer_transactions(customer_id, limit=10)
        print(f"✓ Retrieved {len(transactions)} transactions for customer")
        if transactions:
            for tx in transactions[:3]:  # Show first 3
                print(f"  - {tx.get('type', 'N/A')}: {tx.get('amount', 0)}")
        
        # Test getting all transactions
        print("\nTesting get all transactions...")
        all_transactions = transaction_controller.get_all_transactions(limit=5)
        print(f"✓ Retrieved {len(all_transactions)} total transactions")
        
        # Test getting customer balance
        print("\nTesting customer balance...")
        balance = transaction_controller.get_customer_balance(customer_id)
        print(f"✓ Customer balance: {balance}")
        
        # Test transaction search
        print("\nTesting transaction search...")
        filters = {
            'customer_id': customer_id,
            'start_date': datetime.now() - timedelta(days=7)
        }
        search_results = transaction_controller.search_transactions(filters)
        print(f"✓ Search results: {len(search_results)} transactions")
        
        # Test transaction statistics
        print("\nTesting transaction statistics...")
        stats = transaction_controller.get_transaction_statistics()
        print(f"✓ Transaction statistics retrieved")
        print(f"  Keys: {list(stats.keys())}")
        
        # Test ledger entries
        print("\nTesting ledger entries...")
        ledger = transaction_controller.get_ledger_entries(customer_id)
        print(f"✓ Ledger entries: {len(ledger)}")
        
        # Test customer statement
        print("\nTesting customer statement...")
        statement = transaction_controller.get_customer_statement(customer_id)
        print(f"✓ Customer statement retrieved")
        print(f"  Opening balance: {statement.get('opening_balance', 0)}")
        print(f"  Closing balance: {statement.get('closing_balance', 0)}")
        print(f"  Total credit: {statement.get('total_credit', 0)}")
        print(f"  Total payment: {statement.get('total_payment', 0)}")
        
        # Test cache operations
        print("\nTesting cache operations...")
        transaction_controller.clear_cache()
        print("✓ Cache cleared successfully")
        
        print("\n✅ TransactionController tests completed successfully!")
        
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
    success = test_transaction_controller()
    sys.exit(0 if success else 1)
