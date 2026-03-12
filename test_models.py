#!/usr/bin/env python3
"""
Simple test to verify models are working correctly.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionType
from decimal import Decimal

print("Testing models...")

# Test Customer model
print("\n1. Testing Customer model...")
customer = Customer(
    name="Test Customer",
    phone="9876543210",
    notes="Test customer for verification"
)

print(f"   Customer created: {customer}")
print(f"   Table name: {customer.__tablename__}")
print(f"   Is active by default: {customer.is_active}")
print(f"   Formatted balance: {customer.formatted_balance}")

# Test Transaction model
print("\n2. Testing Transaction model...")
transaction = Transaction(
    customer_id=1,
    type=TransactionType.CREDIT,
    amount=Decimal("1500.00"),
    description="Milk, Eggs, Bread"
)

print(f"   Transaction created: {transaction}")
print(f"   Table name: {transaction.__tablename__}")
print(f"   Is correction: {transaction.is_correction}")
print(f"   Formatted amount: {transaction.formatted_amount}")

# Test TransactionType constants
print("\n3. Testing TransactionType constants...")
print(f"   CREDIT: {TransactionType.CREDIT}")
print(f"   PAYMENT: {TransactionType.PAYMENT}")
print(f"   CORRECTION: {TransactionType.CORRECTION}")

# Test Customer with is_active explicitly set
print("\n4. Testing Customer with explicit is_active...")
customer2 = Customer(
    name="Test Customer 2",
    phone="1234567890",
    notes="Another test",
    is_active=False
)
print(f"   Customer 2 is_active: {customer2.is_active}")

print("\n✅ Model tests completed successfully!")
