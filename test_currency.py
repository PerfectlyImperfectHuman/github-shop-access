#!/usr/bin/env python3
"""
Test currency symbol configuration.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.config import config
from decimal import Decimal

print("Testing Currency Configuration...")
print("=" * 50)

print(f"1. Currency symbol from config: '{config.app.currency_symbol}'")
print(f"   Expected: 'Rs. '")

# Test formatting a sample amount
amount = Decimal("1500.75")
formatted = f"{config.app.currency_symbol}{amount:,.2f}"
print(f"\n2. Formatting test:")
print(f"   Amount: {amount}")
print(f"   Formatted: {formatted}")
print(f"   Expected: Rs. 1,500.75")

# Test negative amount
negative_amount = Decimal("-500.25")
negative_formatted = f"-{config.app.currency_symbol}{abs(negative_amount):,.2f}"
print(f"\n3. Negative amount formatting:")
print(f"   Amount: {negative_amount}")
print(f"   Formatted: {negative_formatted}")
print(f"   Expected: -Rs. 500.25")

print("\n" + "=" * 50)
print("✅ Currency configuration test completed!")
