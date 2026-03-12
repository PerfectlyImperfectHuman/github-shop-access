#!/usr/bin/env python3
"""
Integration test for the complete application.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtWidgets import QApplication
from app.controllers.main_controller import MainController
from app.views.main_window import MainWindow

def test_integration():
    """Test that the application can be created without errors."""
    app = QApplication(sys.argv)
    
    # Create controller
    controller = MainController()
    
    # Create main window
    window = MainWindow(controller)
    
    # Check that the window has the expected tabs
    expected_tabs = ["Dashboard", "Customers", "New Transaction", "Transaction History", "Reports", "Settings"]
    actual_tabs = [window.tab_widget.tabText(i) for i in range(window.tab_widget.count())]
    
    assert actual_tabs == expected_tabs, f"Expected tabs {expected_tabs}, but got {actual_tabs}"
    
    # Check that each view is properly initialized
    assert window.dashboard_view is not None
    assert window.customer_list_view is not None
    assert window.transaction_entry_view is not None
    assert window.transaction_history_view is not None
    assert window.reports_view is not None
    assert window.settings_view is not None
    
    print("✅ Integration test passed: All components initialized correctly.")
    
    # Clean up
    window.close()
    app.quit()

if __name__ == "__main__":
    test_integration()
