#!/usr/bin/env python3
"""
Shop Management System - Main Entry Point
Udhaar (Credit) Management System with GUI
"""

import sys
import os
import logging
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from PySide6.QtWidgets import QApplication, QMainWindow
from app.views.main_window import MainWindow

# Configure logging
def setup_logging():
    """Configure application logging"""
    logs_dir = project_root / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    log_file = logs_dir / "app.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )

def main():
    """Main application entry point"""
    # Setup logging
    setup_logging()
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 60)
    logger.info("Shop Management System Starting")
    logger.info("=" * 60)
    
    try:
        # Create Qt application
        app = QApplication(sys.argv)
        app.setApplicationName("Shop Management System")
        app.setOrganizationName("Local Business")
        
        # Set application style
        app.setStyle("Fusion")
        
        # Create and show main window
        main_window = MainWindow()
        
        # Check if main_window has a method to initialize controllers
        if hasattr(main_window, 'initialize_controllers'):
            main_window.initialize_controllers()
        elif hasattr(main_window, 'setup_controllers'):
            main_window.setup_controllers()
        
        main_window.show()
        
        logger.info("Application started successfully")
        
        # Start event loop
        sys.exit(app.exec())
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}", exc_info=True)
        print(f"Failed to start application: {e}")
        print("Check logs/app.log for details.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
