#!/usr/bin/env python3
"""
Fix to make models accessible from db_manager.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

# Import models to check
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.backup import BackupRecord
from app.models.settings import Settings

print("Models available:")
print(f"Customer: {Customer}")
print(f"Transaction: {Transaction}")
print(f"BackupRecord: {BackupRecord}")
print(f"Settings: {Settings}")

# Now let's update the database_manager to expose these
