#!/usr/bin/env python3
"""
Check the actual model structure
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.database_manager import DatabaseManager
from app.models import Customer

db_manager = DatabaseManager()

with db_manager.get_session() as session:
    # Check Customer model attributes
    customer = session.query(Customer).first()
    if customer:
        print("Customer model attributes:")
        for attr in dir(customer):
            if not attr.startswith('_') and not attr.endswith('_'):
                try:
                    value = getattr(customer, attr)
                    if not callable(value):
                        print(f"  {attr}: {type(value).__name__}")
                except:
                    pass
    else:
        # Create a dummy customer to see attributes
        print("No customers found. Creating dummy to check schema...")
        dummy = Customer(name="Test", phone="123")
        print("Customer model attributes:")
        for attr in dir(dummy):
            if not attr.startswith('_') and not attr.endswith('_'):
                try:
                    value = getattr(dummy, attr)
                    if not callable(value):
                        print(f"  {attr}: {type(value).__name__}")
                except:
                    pass
