"""
Main Application Controller
Handles main window, navigation, and overall application state.
Coordinates between services, controllers, and UI components.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtWidgets import QMainWindow, QMessageBox

from app.services.ledger_service import LedgerService
from app.services.backup_service import BackupService
from app.services.dashboard_service import DashboardService
from app.utils.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class MainController(QObject):
    """Main application controller managing overall application state"""
    
    # Signals for UI updates
    application_initialized = Signal()
    application_error = Signal(str)
    backup_created = Signal(str, str)  # backup_name, timestamp
    settings_changed = Signal()
    
    def __init__(self, main_window: Optional[QMainWindow] = None):
        """Initialize main controller with services and state"""
        super().__init__()
        
        self.main_window = main_window
        self._initialize_services()
        self._initialize_state()
        
        logger.info("MainController initialized")
    
    def _initialize_services(self) -> None:
        """Initialize all service layers"""
        try:
            # Initialize database manager first
            self.db_manager = DatabaseManager()
            
            # Initialize services
            self.ledger_service = LedgerService()
            self.backup_service = BackupService()
            self.dashboard_service = DashboardService()
            
            # Initialize sub-controllers
            self.customer_controller = None
            self.transaction_controller = None
            self._initialize_sub_controllers()
            
            logger.debug("All services initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize services: {e}")
            raise
    
    def _initialize_sub_controllers(self) -> None:
        """Initialize sub-controllers"""
        from app.controllers.customer_controller import CustomerController
        from app.controllers.transaction_controller import TransactionController
        
        self.customer_controller = CustomerController(self.db_manager)
        self.transaction_controller = TransactionController(self.db_manager)
        
        logger.debug("Sub-controllers initialized")
    
    def _initialize_state(self) -> None:
        """Initialize application state variables"""
        self.app_settings = self._load_settings()
        self.current_customer_id: Optional[int] = None
        self.current_view: str = "dashboard"
        self.filter_criteria: Dict[str, Any] = {}
        
        logger.debug("Application state initialized")
    
    def _load_settings(self) -> Dict[str, Any]:
        """Load application settings from database"""
        try:
            # Use database manager to get session
            with self.db_manager.get_session() as session:
                from app.models import Settings
                
                settings = {}
                db_settings = session.query(Settings).all()
                
                for setting in db_settings:
                    settings[setting.key] = setting.value
                
                # Set defaults if not exists
                defaults = {
                    'currency': 'Rs. ',
                    'date_format': 'dd/MM/yyyy',
                    'backup_retention_days': '40',
                    'window_width': '1024',
                    'window_height': '768'
                }
                
                for key, value in defaults.items():
                    if key not in settings:
                        settings[key] = value
                
                logger.debug(f"Loaded settings: {list(settings.keys())}")
                return settings
                
        except Exception as e:
            logger.error(f"Failed to load settings: {e}")
            return {}
    
    def initialize_application(self) -> bool:
        """Complete application initialization"""
        try:
            # Initialize database and create tables
            self.db_manager.initialize()
            self.db_manager.create_tables()
            
            # Perform initial backup if needed
            self.backup_service.perform_scheduled_backup()
            
            # Emit initialization complete signal
            self.application_initialized.emit()
            
            logger.info("Application initialization completed")
            return True
            
        except Exception as e:
            error_msg = f"Application initialization failed: {e}"
            logger.error(error_msg)
            self.application_error.emit(error_msg)
            return False
    
    def get_application_summary(self) -> Dict[str, Any]:
        """Get summary data for dashboard"""
        try:
            summary = self.dashboard_service.get_dashboard_summary()
            
            # Handle the case where dashboard_service returns a nested structure
            if isinstance(summary, dict) and 'error' not in summary:
                # Return the full nested structure as-is
                return summary
            else:
                # Return default structure with zeros
                return {
                    'financial_summary': {
                        'total_outstanding': 0.0,
                        'positive_balance_customers': 0,
                        'negative_balance_customers': 0,
                        'zero_balance_customers': 0,
                        'this_week_credits': 0.0,
                        'this_week_payments': 0.0,
                        'last_week_credits': 0.0,
                        'last_week_payments': 0.0,
                        'week_credit_change_percent': 0.0,
                        'week_payment_change_percent': 0.0
                    },
                    'customer_summary': {
                        'total_customers': 0,
                        'active_customers': 0,
                        'inactive_customers': 0,
                        'new_customers_this_month': 0,
                        'customers_with_recent_activity': 0,
                        'average_balance': 0.0,
                        'active_percentage': 0.0
                    },
                    'today_summary': {
                        'total_credits': 0.0,
                        'total_payments': 0.0,
                        'credit_count': 0,
                        'payment_count': 0,
                        'customers_with_transactions': 0,
                        'avg_credit_size': 0.0,
                        'avg_payment_size': 0.0
                    },
                    'recent_activity': [],
                    'top_customers': []
                }
                
        except Exception as e:
            logger.error(f"Failed to get application summary: {e}")
            # Return default structure with zeros
            return {
                'financial_summary': {
                    'total_outstanding': 0.0,
                    'positive_balance_customers': 0,
                    'negative_balance_customers': 0,
                    'zero_balance_customers': 0,
                    'this_week_credits': 0.0,
                    'this_week_payments': 0.0,
                    'last_week_credits': 0.0,
                    'last_week_payments': 0.0,
                    'week_credit_change_percent': 0.0,
                    'week_payment_change_percent': 0.0
                },
                'customer_summary': {
                    'total_customers': 0,
                    'active_customers': 0,
                    'inactive_customers': 0,
                    'new_customers_this_month': 0,
                    'customers_with_recent_activity': 0,
                    'average_balance': 0.0,
                    'active_percentage': 0.0
                },
                'today_summary': {
                    'total_credits': 0.0,
                    'total_payments': 0.0,
                    'credit_count': 0,
                    'payment_count': 0,
                    'customers_with_transactions': 0,
                    'avg_credit_size': 0.0,
                    'avg_payment_size': 0.0
                },
                'recent_activity': [],
                'top_customers': []
            }
    
    def create_backup(self, manual: bool = False) -> bool:
        """Create a backup (manual or automatic)"""
        try:
            backup_name = self.backup_service.create_backup(manual=manual)
            if backup_name:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self.backup_created.emit(backup_name, timestamp)
                
                if manual and self.main_window:
                    QMessageBox.information(
                        self.main_window,
                        "Backup Created",
                        f"Backup created successfully: {backup_name}"
                    )
                
                logger.info(f"Backup created: {backup_name}")
                return True
                
        except Exception as e:
            error_msg = f"Failed to create backup: {e}"
            logger.error(error_msg)
            if manual and self.main_window:
                QMessageBox.critical(
                    self.main_window,
                    "Backup Failed",
                    error_msg
                )
        
        return False
    
    def restore_backup(self, backup_file: str) -> bool:
        """Restore from a backup file"""
        try:
            if self.backup_service.restore_backup(backup_file):
                if self.main_window:
                    QMessageBox.information(
                        self.main_window,
                        "Restore Successful",
                        "Backup restored successfully. Application will restart."
                    )
                logger.info(f"Backup restored: {backup_file}")
                return True
                
        except Exception as e:
            error_msg = f"Failed to restore backup: {e}"
            logger.error(error_msg)
            if self.main_window:
                QMessageBox.critical(
                    self.main_window,
                    "Restore Failed",
                    error_msg
                )
        
        return False
    
    def get_backup_list(self) -> list:
        """Get list of available backups"""
        try:
            return self.backup_service.get_backup_list()
        except Exception as e:
            logger.error(f"Failed to get backup list: {e}")
            return []
    
    def cleanup_backups(self) -> None:
        """Cleanup old backups based on retention policy"""
        try:
            deleted = self.backup_service.cleanup_old_backups()
            if deleted:
                logger.info(f"Cleaned up {len(deleted)} old backups")
        except Exception as e:
            logger.error(f"Failed to cleanup backups: {e}")
    
    def update_setting(self, key: str, value: str) -> bool:
        """Update application setting"""
        try:
            with self.db_manager.get_session() as session:
                from app.models import Settings
                
                setting = session.query(Settings).filter_by(key=key).first()
                if setting:
                    setting.value = value
                else:
                    setting = Settings(key=key, value=value)
                    session.add(setting)
                
                session.commit()
                self.app_settings[key] = value
                self.settings_changed.emit()
                
                logger.debug(f"Updated setting: {key} = {value}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to update setting {key}: {e}")
            return False
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get application setting value"""
        return self.app_settings.get(key, default)
    
    def get_settings(self) -> Dict[str, Any]:
        """Return a copy of all current application settings"""
        return self.app_settings.copy()
    
    def format_currency(self, amount: float) -> str:
        """Format amount with currency symbol"""
        currency = self.get_setting('currency', 'Rs. ')
        return f"{currency}{amount:,.2f}"
    
    def format_date(self, date_obj: datetime) -> str:
        """Format date according to settings"""
        date_format = self.get_setting('date_format', 'dd/MM/yyyy')
        # Convert format to Python strftime format
        format_map = {
            'dd': '%d',
            'MM': '%m',
            'yyyy': '%Y',
            'HH': '%H',
            'mm': '%M',
            'ss': '%S'
        }
        for key, value in format_map.items():
            date_format = date_format.replace(key, value)
        return date_obj.strftime(date_format)
    
    def navigate_to(self, view_name: str) -> None:
        """Navigate to specified view"""
        self.current_view = view_name
        logger.debug(f"Navigated to view: {view_name}")
    
    def set_current_customer(self, customer_id: Optional[int]) -> None:
        """Set current active customer"""
        self.current_customer_id = customer_id
        logger.debug(f"Current customer set to: {customer_id}")
    
    def get_db_manager(self):
        """Get database manager instance (for controllers that need it)"""
        return self.db_manager
    
    def cleanup(self) -> None:
        """Cleanup resources before application exit"""
        try:
            if hasattr(self, 'db_manager'):
                self.db_manager.close_all_sessions()
            logger.info("MainController cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    # Slots for UI interactions
    @Slot()
    def on_backup_requested(self):
        """Handle manual backup request from UI"""
        self.create_backup(manual=True)
    
    @Slot(str)
    def on_restore_requested(self, backup_file: str):
        """Handle restore request from UI"""
        self.restore_backup(backup_file)
    
    @Slot()
    def on_refresh_requested(self):
        """Handle refresh request from UI"""
        self.application_initialized.emit()
