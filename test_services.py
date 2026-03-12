#!/usr/bin/env python3
"""
Test the services layer.
"""

import sys
from pathlib import Path
from decimal import Decimal

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.services.ledger_service import ledger_service
from app.services.backup_service import backup_service
from app.services.dashboard_service import dashboard_service
from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionType  # Fixed: Import Transaction
from app.utils.database_manager import db_manager


def test_services():
    """Test all services"""
    print("Testing Services Layer...")
    print("=" * 60)
    
    try:
        # Initialize database
        db_manager.initialize(echo=False)
        
        # Create a test customer for service tests
        with db_manager.get_session() as session:
            # Check if test customer already exists
            test_customer = session.query(Customer).filter_by(name="Service Test Customer").first()
            if not test_customer:
                test_customer = Customer(
                    name="Service Test Customer",
                    phone="9998887777",
                    notes="Customer for service testing"
                )
                session.add(test_customer)
                session.flush()
        
        customer_id = test_customer.id
        print(f"1. Using test customer ID: {customer_id}")
        
        # Test Ledger Service
        print("\n2. Testing Ledger Service...")
        
        # Add a credit transaction
        credit = ledger_service.add_credit_transaction(
            customer_id=customer_id,
            amount=Decimal("1500.75"),
            description="Test credit: Milk, Eggs, Bread"
        )
        print(f"   ✓ Added credit: {credit.formatted_amount}")
        
        # Add a payment transaction
        payment = ledger_service.add_payment_transaction(
            customer_id=customer_id,
            amount=Decimal("500.25"),
            description="Test payment"
        )
        print(f"   ✓ Added payment: {payment.formatted_amount}")
        
        # Get customer balance
        balance = ledger_service.get_customer_balance(customer_id)
        print(f"   ✓ Customer balance: Rs. {balance:,.2f}")
        
        # Get customer ledger
        ledger = ledger_service.get_customer_ledger(customer_id)
        print(f"   ✓ Ledger entries: {len(ledger)}")
        
        # Get customer summary
        summary = ledger_service.get_customer_summary(customer_id)
        print(f"   ✓ Customer name: {summary['name']}")
        print(f"   ✓ Formatted balance: {summary['formatted_balance']}")
        
        # Get total outstanding
        total_outstanding = ledger_service.get_total_outstanding()
        print(f"   ✓ Total outstanding: Rs. {total_outstanding:,.2f}")
        
        # Get today's summary
        today_summary = ledger_service.get_today_summary()
        print(f"   ✓ Today's credits: {today_summary['formatted_total_credits']}")
        
        # Test Dashboard Service
        print("\n3. Testing Dashboard Service...")
        
        # Get dashboard summary
        dashboard = dashboard_service.get_dashboard_summary()
        print(f"   ✓ Dashboard data retrieved")
        print(f"   - Total customers: {dashboard['customer_summary']['total_customers']}")
        print(f"   - Total outstanding: {dashboard['financial_summary']['formatted_total_outstanding']}")
        print(f"   - Today's net change: {dashboard['today_summary']['formatted_net_change']}")
        
        # Get financial summary
        financial = dashboard_service.get_financial_summary()
        print(f"   ✓ Financial summary retrieved")
        
        # Get customer summary
        customer_stats = dashboard_service.get_customer_summary()
        print(f"   ✓ Customer statistics retrieved")
        
        # Get system status
        system_status = dashboard_service.get_system_status()
        print(f"   ✓ System status: {system_status['status']}")
        
        # Test Backup Service
        print("\n4. Testing Backup Service...")
        
        # Get backup status
        backup_status = backup_service.get_backup_status()
        print(f"   ✓ Auto backup enabled: {backup_status['auto_backup_enabled']}")
        print(f"   ✓ Backup directory: {backup_status['backup_dir']}")
        
        # Get backup list
        backups = backup_service.get_backup_list()
        print(f"   ✓ Backup count: {len(backups)}")
        
        # Perform manual backup (commented out to avoid actual backup during test)
        # backup_result = backup_service.perform_manual_backup()
        # print(f"   ✓ Manual backup: {backup_result['success']}")
        
        # Clean up test data
        print("\n5. Cleaning up test data...")
        with db_manager.get_session() as session:
            # Refresh the test customer
            test_customer = session.get(Customer, customer_id)
            if test_customer:
                # Delete all transactions for this customer first
                for transaction in list(test_customer.transactions):
                    session.delete(transaction)
                
                # Delete the customer
                session.delete(test_customer)
        
        print("   ✓ Test data cleaned up")
        
        print("\n" + "=" * 60)
        print("✅ Services Layer tests completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Services test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_services()
    sys.exit(0 if success else 1)
