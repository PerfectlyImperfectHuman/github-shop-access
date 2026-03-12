#!/usr/bin/env python3
"""
Simple test script for DashboardView
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_dashboard_view():
    """Test DashboardView initialization and basic functionality"""
    try:
        print("Testing DashboardView...")
        
        # Import required modules
        from PySide6.QtWidgets import QApplication
        from app.controllers.main_controller import MainController
        from app.controllers.customer_controller import CustomerController
        from app.controllers.transaction_controller import TransactionController
        from app.views.dashboard_view import DashboardView
        
        # Create QApplication instance
        app = QApplication.instance() or QApplication(sys.argv)
        
        # Create controllers
        print("Creating controllers...")
        main_controller = MainController(None)
        customer_controller = CustomerController()
        transaction_controller = TransactionController()
        
        # Create dashboard view
        print("Creating DashboardView...")
        dashboard = DashboardView(main_controller, customer_controller, transaction_controller)
        
        print("✓ DashboardView created successfully")
        print(f"✓ Summary cards: {len(dashboard.summary_cards)}")
        print(f"✓ Recent transactions table columns: {dashboard.recent_transactions_table.columnCount()}")
        print(f"✓ Top customers table columns: {dashboard.top_customers_table.columnCount()}")
        print(f"✓ Daily stats: {len(dashboard.daily_stats)}")
        
        # Test refresh functionality
        print("\nTesting refresh functionality...")
        dashboard.refresh_data()
        print("✓ Dashboard data refreshed")
        
        # Check summary card values were updated
        customers_card = dashboard.summary_cards['total_customers']
        print(f"✓ Customers card value: {customers_card['widgets']['value_label'].text()}")
        
        balance_card = dashboard.summary_cards['total_balance']
        print(f"✓ Balance card value: {balance_card['widgets']['value_label'].text()}")
        
        # Check tables were populated (or at least cleared)
        print(f"✓ Recent transactions rows: {dashboard.recent_transactions_table.rowCount()}")
        print(f"✓ Top customers rows: {dashboard.top_customers_table.rowCount()}")
        
        # Test daily summary
        print("\nTesting daily summary...")
        credit_widget = dashboard.daily_stats['total_credit']['widget']
        credit_value = credit_widget.layout().itemAt(1).widget().text()
        print(f"✓ Daily credit value: {credit_value}")
        
        # Show the widget briefly for visual verification
        print("\nDisplaying dashboard for 2 seconds...")
        dashboard.show()
        
        # Process events briefly to show widget
        import time
        start_time = time.time()
        while time.time() - start_time < 2:
            app.processEvents()
            time.sleep(0.01)
        
        print("\n✅ DashboardView tests completed successfully!")
        
        # Clean up
        dashboard.close()
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
    success = test_dashboard_view()
    sys.exit(0 if success else 1)
