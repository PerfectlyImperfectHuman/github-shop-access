"""
Main Window Module
The main application window with navigation and tab management.
"""

import logging

from PySide6.QtCore import Qt, Signal, QTimer
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                              QLabel, QPushButton, QTabWidget, QStatusBar,
                              QMessageBox, QToolBar, QApplication)
from PySide6.QtGui import QAction, QIcon, QFont

from app.controllers.main_controller import MainController
from app.views.dashboard_view import DashboardView
from app.views.customer_views import CustomerListView
from app.views.transaction_views import TransactionEntryView, TransactionHistoryView
from app.views.reports_views import ReportsView
from app.views.settings_views import SettingsView

logger = logging.getLogger(__name__)


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.controller = None
        self.current_customer_id = None
        
        # Set window properties
        self.setWindowTitle("Shop Management System - Udhaar (Credit) Management")
        
        # Set window icon (if available)
        # self.setWindowIcon(QIcon("icon.png"))
        
        # Create controller first
        self._create_controller()
        
        # Initialize UI
        self.init_ui()
        
        # Setup connections
        self.setup_connections()
        
        # Auto-refresh dashboard every 30 seconds
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_dashboard)
        self.refresh_timer.start(30000)  # 30 seconds
        
        logger.info("Main window initialized")
    
    def _create_controller(self):
        """Create and initialize the main controller"""
        try:
            self.controller = MainController(main_window=self)
            logger.info("MainController created")
        except Exception as e:
            logger.error(f"Failed to create MainController: {e}")
            QMessageBox.critical(
                self,
                "Application Error",
                f"Failed to initialize application: {e}"
            )
            raise
    
    def init_ui(self):
        """Initialize the user interface"""
        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Create tab widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabPosition(QTabWidget.North)
        self.tab_widget.setMovable(False)
        
        # Initialize views
        self._initialize_views()
        
        main_layout.addWidget(self.tab_widget)
        
        # Create status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        
        # Add status bar widgets
        self.db_status_label = QLabel("Database: Connected")
        self.db_status_label.setStyleSheet("color: green; font-weight: bold;")
        self.status_bar.addPermanentWidget(self.db_status_label)
        
        # Update status bar with current tab info
        self.tab_widget.currentChanged.connect(self.update_status_bar)
        
        # Set initial window size
        self.resize(1200, 800)
    
    def _initialize_views(self):
        """Initialize all views"""
        try:
            # Create views using the main controller
            self.dashboard_view = DashboardView(
                main_controller=self.controller,
                customer_controller=self.controller.customer_controller,
                transaction_controller=self.controller.transaction_controller
            )
            
            # Store reference to main window in dashboard view for tab switching
            self.dashboard_view.main_window = self
            
            self.customer_list_view = CustomerListView(main_controller=self.controller)
            self.transaction_entry_view = TransactionEntryView(main_controller=self.controller)
            self.transaction_history_view = TransactionHistoryView(main_controller=self.controller)
            
            # FIXED: Pass all required controllers to ReportsView
            self.reports_view = ReportsView(
                transaction_controller=self.controller.transaction_controller,
                customer_controller=self.controller.customer_controller,
                main_controller=self.controller
            )
            
            self.settings_view = SettingsView(self.controller)
            
            # Add tabs
            self.tab_widget.addTab(self.dashboard_view, "Dashboard")
            self.tab_widget.addTab(self.customer_list_view, "Customers")
            self.tab_widget.addTab(self.transaction_entry_view, "New Transaction")
            self.tab_widget.addTab(self.transaction_history_view, "Transaction History")
            self.tab_widget.addTab(self.reports_view, "Reports")
            self.tab_widget.addTab(self.settings_view, "Settings")
            
            logger.info("All views initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize views: {e}")
            QMessageBox.critical(
                self,
                "View Initialization Error",
                f"Failed to initialize application views: {e}"
            )
            raise
    
    def setup_connections(self):
        """Setup signal/slot connections"""
        try:
            # Connect dashboard signals
            if hasattr(self.dashboard_view, 'view_customer_requested'):
                self.dashboard_view.view_customer_requested.connect(self.view_customer_details)
            
            if hasattr(self.dashboard_view, 'view_transaction_requested'):
                self.dashboard_view.view_transaction_requested.connect(self.view_transaction_details)
            
            if hasattr(self.dashboard_view, 'refresh_requested'):
                self.dashboard_view.refresh_requested.connect(self.refresh_dashboard)
            
            # Connect transaction entry signals
            if hasattr(self.transaction_entry_view, 'transaction_completed'):
                self.transaction_entry_view.transaction_completed.connect(self.on_transaction_completed)
            
            self.tab_widget.currentChanged.connect(self.on_tab_changed)
            
            # Initialize application
            self.controller.application_initialized.connect(self.on_application_initialized)
            self.controller.initialize_application()
            
            logger.info("Signal connections established")
            
        except Exception as e:
            logger.error(f"Failed to setup connections: {e}")
    
    def on_application_initialized(self):
        """Handle application initialization completion"""
        self.status_bar.showMessage("Application initialized successfully", 3000)
        logger.info("Application fully initialized")
    
    def on_tab_changed(self, index):
        """Handle tab change to refresh settings backup list when needed"""
        current_tab = self.tab_widget.widget(index)
        if current_tab == self.settings_view:
            self.settings_view.refresh_backups()
    
    def on_transaction_completed(self):
        """Handle transaction completion - refresh all relevant views"""
        # Refresh dashboard, customer list, AND transaction history
        self.refresh_dashboard()
        if hasattr(self.customer_list_view, 'refresh_customers'):
            self.customer_list_view.refresh_customers()
        if hasattr(self.transaction_history_view, 'refresh_transactions'):
            self.transaction_history_view.refresh_transactions()
        
        # Show success message
        self.status_bar.showMessage("Transaction completed successfully", 5000)
    
    def refresh_dashboard(self):
        """Refresh the dashboard view"""
        if self.dashboard_view:
            self.dashboard_view.refresh_data()
    
    def refresh_all(self):
        """Refresh all views"""
        self.refresh_dashboard()
        if hasattr(self.customer_list_view, 'refresh_customers'):
            self.customer_list_view.refresh_customers()
        if hasattr(self.transaction_history_view, 'refresh_transactions'):
            self.transaction_history_view.refresh_transactions()
        if hasattr(self.reports_view, 'refresh_reports'):
            self.reports_view.refresh_reports()
    
    def update_status_bar(self, index):
        """Update status bar based on current tab"""
        tab_name = self.tab_widget.tabText(index)
        self.status_bar.showMessage(f"Current tab: {tab_name}", 3000)
    
    def switch_to_tab(self, tab_name: str):
        """Switch to a specific tab by name"""
        # Map view names to tab indices
        tab_mapping = {
            "Dashboard": 0,
            "Customers": 1,
            "New Transaction": 2,
            "Transaction History": 3,
            "Reports": 4,
            "Settings": 5,
            # Aliases for quick actions
            "transactions": 2,  # Default to New Transaction tab
            "customers": 1,
            "reports": 4
        }
        
        if tab_name in tab_mapping:
            index = tab_mapping[tab_name]
            self.tab_widget.setCurrentIndex(index)
            logger.debug(f"Switched to tab: {tab_name}")
        else:
            logger.warning(f"Unknown tab name: {tab_name}")
    
    def view_customer_details(self, customer_id: int):
        """Switch to customer view and show specific customer"""
        # Switch to customers tab
        self.switch_to_tab("Customers")
        
        # If customer list view has method to show specific customer, call it
        if hasattr(self.customer_list_view, 'view_customer'):
            self.customer_list_view.view_customer(customer_id)
        
        logger.debug(f"Viewing customer details for ID: {customer_id}")
    
    def view_transaction_details(self, transaction_id: int):
        """Switch to transaction history and show specific transaction"""
        # Switch to transaction history tab
        self.switch_to_tab("Transaction History")
        
        # If transaction history view has method to show specific transaction, call it
        if hasattr(self.transaction_history_view, 'view_transaction'):
            self.transaction_history_view.view_transaction(transaction_id)
        
        logger.debug(f"Viewing transaction details for ID: {transaction_id}")
    
    def closeEvent(self, event):
        """Handle application close event"""
        # Stop the refresh timer
        self.refresh_timer.stop()
        
        # Save window size
        if self.controller:
            try:
                width = str(self.width())
                height = str(self.height())
                self.controller.update_setting('window_width', width)
                self.controller.update_setting('window_height', height)
            except Exception as e:
                logger.error(f"Failed to save window size: {e}")
        
        # Cleanup controller
        if self.controller:
            self.controller.cleanup()
        
        event.accept()
        logger.info("Application closing")
