#!/usr/bin/env python3
"""
Integration test for the complete application with reports view.
"""

import sys
import os
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from PySide6.QtWidgets import QApplication
from app.views.main_window import MainWindow
from app.controllers.main_controller import MainController

def test_integration():
    """Test complete application integration."""
    app = QApplication(sys.argv)
    
    # Create main controller
    main_controller = MainController()
    
    # Create main window
    window = MainWindow(main_controller=main_controller)
    window.show()
    
    # Start the application
    ret = app.exec()
    
    # Clean up
    main_controller.close()
    
    return ret

if __name__ == "__main__":
    sys.exit(test_integration())
