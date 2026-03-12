#!/usr/bin/env python3
"""
Test the database manager functionality.
"""

import sys
from pathlib import Path
from decimal import Decimal

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.utils.database_manager import db_manager
from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionType


def test_database_manager():
    """Test basic database operations"""
    print("Testing Database Manager...")
    print("=" * 50)
    
    try:
        # Initialize database
        print("\n1. Initializing database...")
        db_manager.initialize(echo=False)
        print("   ✓ Database initialized")
        
        # Create tables
        print("\n2. Creating tables...")
        db_manager.create_tables()
        print("   ✓ Tables created")
        
        # Get database info
        print("\n3. Getting database info...")
        info = db_manager.get_database_info()
        print(f"   Database path: {info['path']}")
        print(f"   Database size: {info['size_formatted']}")
        print(f"   Tables: {', '.join(info['tables'])}")
        
        # Test session context manager
        print("\n4. Testing session context manager...")
        with db_manager.get_session() as session:
            # Create a customer
            customer = Customer(
                name="Test Customer",
                phone="9876543210",
                notes="Test customer for database manager test"
            )
            session.add(customer)
            # Session will auto-commit when context exits
        
        print(f"   ✓ Customer created with ID: {customer.id}")
        
        # Test transaction creation
        print("\n5. Testing transaction creation...")
        with db_manager.get_session() as session:
            transaction = Transaction(
                customer_id=customer.id,
                type=TransactionType.CREDIT,
                amount=Decimal("2500.50"),
                description="Test transaction: Milk, Bread, Eggs"
            )
            session.add(transaction)
        
        print(f"   ✓ Transaction created with ID: {transaction.id}")
        print(f"   Transaction amount: {transaction.formatted_amount}")
        
        # Test query execution
        print("\n6. Testing query execution...")
        query = "SELECT COUNT(*) as count FROM customers"
        result = db_manager.execute_query(query)
        print(f"   Customer count: {result[0]['count']}")
        
        # Test backup functionality (simulated - won't actually backup in test)
        print("\n7. Testing backup system (simulated)...")
        print("   Backup functionality ready (will be tested with real data)")
        
        # Test database integrity check
        print("\n8. Testing database integrity check...")
        integrity = db_manager.check_integrity()
        print(f"   Integrity check: {integrity['message']}")
        
        # Clean up test data
        print("\n9. Cleaning up test data...")
        with db_manager.get_session() as session:
            # Refresh objects
            customer = session.get(Customer, customer.id)
            transaction = session.get(Transaction, transaction.id)
            
            if transaction:
                session.delete(transaction)
            if customer:
                session.delete(customer)
        
        print("   ✓ Test data cleaned up")
        
        print("\n" + "=" * 50)
        print("✅ Database Manager tests completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Database Manager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_database_manager()
    sys.exit(0 if success else 1)
