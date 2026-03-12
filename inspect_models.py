#!/usr/bin/env python3
"""
Inspect the actual model structure
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import inspect
from app.models import Customer, Transaction, BackupRecord, Settings

print("=" * 80)
print("INSPECTING CUSTOMER MODEL")
print("=" * 80)

# Check Customer class definition
print("\nCustomer class attributes:")
for name, value in inspect.getmembers(Customer):
    if not name.startswith('_') and not inspect.ismethod(value):
        print(f"  {name}: {type(value)}")

# Check Customer __table__ columns
print("\nCustomer table columns:")
if hasattr(Customer, '__table__'):
    for column in Customer.__table__.columns:
        print(f"  {column.name}: {column.type}")

# Check Customer __init__ signature
print("\nCustomer __init__ signature:")
try:
    sig = inspect.signature(Customer.__init__)
    for param in sig.parameters.values():
        print(f"  {param.name}: {param.default if param.default != inspect.Parameter.empty else 'required'}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 80)
print("INSPECTING TRANSACTION MODEL")
print("=" * 80)

# Check Transaction class definition
print("\nTransaction class attributes:")
for name, value in inspect.getmembers(Transaction):
    if not name.startswith('_') and not inspect.ismethod(value):
        print(f"  {name}: {type(value)}")

# Check Transaction __table__ columns
print("\nTransaction table columns:")
if hasattr(Transaction, '__table__'):
    for column in Transaction.__table__.columns:
        print(f"  {column.name}: {column.type}")

print("\n" + "=" * 80)
print("COMPLETE MODEL INSPECTION")
print("=" * 80)

# Try to create a customer instance with minimal fields
print("\nTrying to create a Customer instance...")
try:
    customer = Customer(name="Test Inspection")
    print(f"  Success: Created customer with name='Test Inspection'")
    
    # Check what attributes are settable
    print("\n  Trying to set various attributes:")
    test_attrs = ['phone', 'address', 'notes', 'credit_limit', 'email', 'contact_person']
    for attr in test_attrs:
        try:
            setattr(customer, attr, "test")
            print(f"    ✓ {attr} is settable")
        except AttributeError:
            print(f"    ✗ {attr} is NOT an attribute")
except Exception as e:
    print(f"  Error creating customer: {e}")

# Try to create a transaction instance
print("\nTrying to create a Transaction instance...")
try:
    transaction = Transaction(transaction_type="CREDIT", amount=100.0)
    print(f"  Success: Created transaction with type='CREDIT', amount=100.0")
    
    # Check what attributes are settable
    print("\n  Trying to set various attributes:")
    test_attrs = ['description', 'reference', 'payment_method', 'customer_id', 'original_transaction_id']
    for attr in test_attrs:
        try:
            if attr == 'customer_id':
                setattr(transaction, attr, 1)
            elif attr == 'original_transaction_id':
                setattr(transaction, attr, None)
            else:
                setattr(transaction, attr, "test")
            print(f"    ✓ {attr} is settable")
        except AttributeError:
            print(f"    ✗ {attr} is NOT an attribute")
except Exception as e:
    print(f"  Error creating transaction: {e}")
