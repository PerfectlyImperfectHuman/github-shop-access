#!/usr/bin/env python3
"""
Simple test script for Reports Views
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_reports_views():
    """Test Reports Views initialization and basic functionality"""
    try:
        print("Testing Reports Views...")
        
        # Import required modules
        from PySide6.QtWidgets import QApplication
        from app.controllers.main_controller import MainController
        from app.controllers.customer_controller import CustomerController
        from app.controllers.transaction_controller import TransactionController
        from app.views.reports_views import ReportsView
        
        # Create QApplication instance
        app = QApplication.instance() or QApplication(sys.argv)
        
        # Create controllers
        print("Creating controllers...")
        main_controller = MainController(None)
        customer_controller = CustomerController()
        transaction_controller = TransactionController()
        
        # Test Reports View
        print("\nTesting ReportsView...")
        reports_view = ReportsView(
            transaction_controller, customer_controller, main_controller
        )
        
        print("✓ ReportsView created successfully")
        print(f"✓ Tab count: {reports_view.tab_widget.count()}")
        print(f"✓ Tab names: {[reports_view.tab_widget.tabText(i) for i in range(reports_view.tab_widget.count())]}")
        
        # Check components in each tab
        print("\nChecking Customer Statements tab components...")
        print(f"  Customer combo: {reports_view.statement_customer_combo.count()} customers")
        print(f"  Date inputs: From {reports_view.statement_from_date.date().toString()}, To {reports_view.statement_to_date.date().toString()}")
        print(f"  Preview area: {reports_view.statement_preview.toPlainText()[:50]}...")
        
        print("\nChecking Financial Reports tab components...")
        print(f"  Report type combo: {reports_view.report_type_combo.count()} types")
        print(f"  Report table columns: {reports_view.report_table.columnCount()}")
        
        print("\nChecking Export tab components...")
        print(f"  Export type combo: {reports_view.export_type_combo.count()} types")
        print(f"  Export format combo: {reports_view.export_format_combo.count()} formats")
        print(f"  Progress bar: {reports_view.export_progress.value()}%")
        
        # Test preview functionality
        print("\nTesting statement preview...")
        if reports_view.statement_customer_combo.count() > 0:
            reports_view._preview_statement()
            print("✓ Statement preview executed")
            preview_text = reports_view.statement_preview.toHtml()
            print(f"✓ Preview generated ({len(preview_text)} characters)")
        else:
            print("⚠ No customers available for preview test")
        
        # Test financial report generation
        print("\nTesting financial report generation...")
        reports_view._generate_daily_summary()
        print(f"✓ Daily summary generated")
        print(f"  Table rows: {reports_view.report_table.rowCount()}")
        print(f"  Summary: {reports_view.report_summary_label.text()}")
        
        # Show the view briefly
        print("\nDisplaying ReportsView for 3 seconds...")
        reports_view.show()
        
        import time
        start_time = time.time()
        while time.time() - start_time < 3:
            app.processEvents()
            time.sleep(0.01)
        
        print("\n✅ Reports Views tests completed successfully!")
        
        # Clean up
        reports_view.close()
        main_controller.cleanup()
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_reports_views()
    sys.exit(0 if success else 1)
