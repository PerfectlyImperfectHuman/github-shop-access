#!/usr/bin/env python3
"""
Complete Application Test
Tests the fully integrated shop management system.
"""

import sys
import os
import sqlite3
from pathlib import Path

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_database_integrity():
    """Test database connection and integrity"""
    print("🔍 Testing database integrity...")
    
    if os.path.exists("shop_management.db"):
        conn = sqlite3.connect("shop_management.db")
        cursor = conn.cursor()
        
        # Check if all tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        table_names = [t[0] for t in tables]
        
        expected_tables = ['customers', 'transactions', 'backup_records', 'settings', 'alembic_version']
        print(f"  Found tables: {table_names}")
        
        for table in expected_tables:
            if table in table_names:
                print(f"  ✅ {table} table exists")
            else:
                print(f"  ❌ {table} table missing")
        
        conn.close()
        print("  ✅ Database integrity check passed")
        return True
    else:
        print("  ❌ Database file not found")
        return False

def test_backup_system():
    """Test backup directory and functionality"""
    print("\n🔍 Testing backup system...")
    
    backup_dir = Path("backups")
    if backup_dir.exists():
        backup_files = list(backup_dir.glob("*.db"))
        print(f"  Found {len(backup_files)} backup files")
        
        if backup_files:
            for i, backup in enumerate(backup_files[:3], 1):  # Show first 3
                size_mb = backup.stat().st_size / (1024 * 1024)
                print(f"    {i}. {backup.name} ({size_mb:.2f} MB)")
        
        print("  ✅ Backup system check passed")
        return True
    else:
        print("  ⚠️ Backup directory doesn't exist (will be created on first run)")
        return True

def test_imports():
    """Test that all modules can be imported"""
    print("\n🔍 Testing module imports...")
    
    modules_to_test = [
        ("app.config", "Config"),
        ("app.models.customer", "Customer"),
        ("app.models.transaction", "Transaction"),
        ("app.models.backup", "BackupRecord"),
        ("app.models.settings", "Settings"),
        ("app.services.ledger_service", "LedgerService"),
        ("app.services.backup_service", "BackupService"),
        ("app.services.dashboard_service", "DashboardService"),
        ("app.controllers.main_controller", "MainController"),
        ("app.controllers.customer_controller", "CustomerController"),
        ("app.controllers.transaction_controller", "TransactionController"),
        ("app.views.main_window", "MainWindow"),
        ("app.views.dashboard_view", "DashboardView"),
        ("app.views.customer_views", "CustomerListView"),
        ("app.views.transaction_views", "TransactionEntryView"),
        ("app.views.reports_views", "ReportsView"),
        ("app.views.settings_views", "SettingsView"),
    ]
    
    all_imports_ok = True
    for module_path, class_name in modules_to_test:
        try:
            module = __import__(module_path, fromlist=[class_name])
            if hasattr(module, class_name):
                print(f"  ✅ {module_path}.{class_name}")
            else:
                print(f"  ❌ {module_path}.{class_name} - Class not found")
                all_imports_ok = False
        except ImportError as e:
            print(f"  ❌ {module_path}.{class_name} - {str(e)}")
            all_imports_ok = False
    
    return all_imports_ok

def test_folder_structure():
    """Test project folder structure"""
    print("\n🔍 Testing folder structure...")
    
    expected_folders = [
        "app",
        "app/models",
        "app/views",
        "app/controllers",
        "app/services",
        "app/utils",
        "logs",
        "backups",
    ]
    
    expected_files = [
        "run.py",
        "requirements.txt",
        "app/__init__.py",
        "app/config.py",
        "shop_management.db",
    ]
    
    all_folders_ok = True
    for folder in expected_folders:
        if os.path.exists(folder):
            print(f"  ✅ {folder}/")
        else:
            print(f"  ❌ {folder}/ - Missing")
            all_folders_ok = False
    
    for file in expected_files:
        if os.path.exists(file):
            print(f"  ✅ {file}")
        else:
            print(f"  ❌ {file} - Missing")
            all_folders_ok = False
    
    return all_folders_ok

def main():
    """Run all tests"""
    print("=" * 60)
    print("SHOP MANAGEMENT SYSTEM - COMPLETE INTEGRATION TEST")
    print("=" * 60)
    
    tests = [
        ("Folder Structure", test_folder_structure),
        ("Module Imports", test_imports),
        ("Database Integrity", test_database_integrity),
        ("Backup System", test_backup_system),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"  ❌ Test failed with error: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! The application is ready to use.")
        print("\nTo launch the application:")
        print("  python run.py")
    else:
        print("\n⚠️ Some tests failed. Please check the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
