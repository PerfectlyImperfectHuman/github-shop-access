#!/usr/bin/env python3
"""
Simple test script for MainWindow
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_main_window():
    """Test MainWindow initialization and basic functionality"""
    try:
        print("Testing MainWindow...")
        
        # Import required modules
        from PySide6.QtWidgets import QApplication
        from app.controllers.main_controller import MainController
        from app.views.main_window import MainWindow
        
        # Create QApplication instance
        app = QApplication.instance() or QApplication(sys.argv)
        
        # Create main controller
        print("Creating MainController...")
        main_controller = MainController(None)  # No main window needed for controller
        
        # Create main window
        print("Creating MainWindow...")
        main_window = MainWindow(main_controller)
        
        print("✓ MainWindow created successfully")
        print(f"✓ Window title: {main_window.windowTitle()}")
        print(f"✓ Current view: {main_window.get_current_view()}")
        print(f"✓ Navigation buttons: {len(main_window.nav_buttons)}")
        print(f"✓ View widgets: {len(main_window.view_widgets)}")
        
        # Test view switching
        print("\nTesting view switching...")
        test_views = ['customers', 'transactions', 'dashboard']
        for view in test_views:
            main_window._switch_view(view)
            print(f"  Switched to '{view}': Current view = {main_window.get_current_view()}")
        
        # Test status messages
        print("\nTesting status messages...")
        main_window.set_status_message("Test status message")
        print(f"  Status set: {main_window.status_label.text()}")
        
        # Test database status
        main_window.update_database_status(True)
        print(f"  Database status (connected): {main_window.db_status_label.text()}")
        
        main_window.update_database_status(False)
        print(f"  Database status (disconnected): {main_window.db_status_label.text()}")
        
        # Show the window (briefly for testing)
        print("\nDisplaying window for 2 seconds...")
        main_window.show()
        
        # Process events briefly to show window
        import time
        start_time = time.time()
        while time.time() - start_time < 2:
            app.processEvents()
            time.sleep(0.01)
        
        print("\n✅ MainWindow tests completed successfully!")
        
        # Clean exit
        main_window.close()
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
    success = test_main_window()
    sys.exit(0 if success else 1)
