#!/usr/bin/env python3
"""
Check Transaction model structure
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.database_manager import DatabaseManager
from app.models import Transaction

db_manager = DatabaseManager()

with db_manager.get_session() as session:
    # Check Transaction model attributes
    transaction = session.query(Transaction).first()
    if transaction:
        print("Transaction model attributes:")
        for attr in dir(transaction):
            if not attr.startswith('_') and not attr.endswith('_'):
                try:
                    value = getattr(transaction, attr)
                    if not callable(value):
                        print(f"  {attr}: {type(value).__name__}")
                except:
                    pass
    else:
        # Create a dummy transaction to see attributes
        print("No transactions found. Checking model definition...")
        from app.models import Customer
        dummy_customer = session.query(Customer).first()
        if dummy_customer:
            dummy = Transaction(
                transaction_type="CREDIT",
                customer_id=dummy_customer.id,
                amount=100.0
            )
            print("Transaction model attributes:")
            for attr in dir(dummy):
                if not attr.startswith('_') and not attr.endswith('_'):
                    try:
                        value = getattr(dummy, attr)
                        if not callable(value):
                            print(f"  {attr}: {type(value).__name__}")
                    except:
                        pass
