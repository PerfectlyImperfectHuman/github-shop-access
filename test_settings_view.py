#!/usr/bin/env python3
"""
Test script for Settings View
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from app.views.settings_views import SettingsView
from app.controllers.main_controller import MainController

def test_settings_view():
    """Test the settings view"""
    app = QApplication(sys.argv)
    
    # Create main window
    window = QMainWindow()
    window.setWindowTitle("Test - Settings View")
    window.setGeometry(100, 100, 1000, 700)
    
    # Create central widget
    central_widget = QWidget()
    window.setCentralWidget(central_widget)
    
    # Create layout
    layout = QVBoxLayout(central_widget)
    
    # Initialize controller - PASS THE MAIN WINDOW AS REQUIRED
    controller = MainController(window)
    
    # Create settings view
    settings_view = SettingsView(controller)
    layout.addWidget(settings_view)
    
    # Show window
    window.show()
    
    # Start application
    sys.exit(app.exec())

if __name__ == "__main__":
    test_settings_view()