#!/usr/bin/env python3
"""
Test script to verify database initialization fix
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.database_manager import DatabaseManager

def test_database_initialization():
    """Test that database can be initialized correctly"""
    print("🔍 Testing database initialization...")
    
    try:
        # Create database manager
        db_manager = DatabaseManager()
        
        # Test initialize method
        print("  Testing initialize() method...")
        db_manager.initialize()
        print("  ✅ Database connection initialized")
        
        # Test create_tables method
        print("  Testing create_tables() method...")
        db_manager.create_tables()
        print("  ✅ Database tables created")
        
        # Test get_session method
        print("  Testing get_session() method...")
        with db_manager.get_session() as session:
            print(f"  ✅ Session created: {session}")
        
        # Test get_database_info method
        print("  Testing get_database_info() method...")
        info = db_manager.get_database_info()
        print(f"  ✅ Database info retrieved:")
        print(f"     - Path: {info['path']}")
        print(f"     - Size: {info['size_formatted']}")
        print(f"     - Tables: {info['tables']}")
        
        print("\n🎉 All database tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Database test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_database_initialization()
    sys.exit(0 if success else 1)
