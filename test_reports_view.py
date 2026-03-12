#!/usr/bin/env python3
"""
Test script for the Reports View.
"""

import sys
import os
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from app.views.reports_views import ReportsView
from app.controllers.main_controller import MainController
from app.config import Config

def test_reports_view():
    """Test the reports view."""
    app = QApplication(sys.argv)
    
    # Create main controller
    main_controller = MainController()
    
    # Create main window
    window = QMainWindow()
    window.setWindowTitle("Test - Reports View")
    window.setGeometry(100, 100, 1000, 700)
    
    # Create central widget
    central_widget = QWidget()
    window.setCentralWidget(central_widget)
    layout = QVBoxLayout(central_widget)
    
    # Create reports view
    reports_view = ReportsView(main_controller=main_controller)
    layout.addWidget(reports_view)
    
    # Refresh all reports
    reports_view.refresh_all()
    
    window.show()
    
    # Start the application
    ret = app.exec()
    
    # Clean up
    main_controller.close()
    
    return ret

if __name__ == "__main__":
    sys.exit(test_reports_view())
