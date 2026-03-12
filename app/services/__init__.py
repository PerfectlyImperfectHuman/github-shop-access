"""
Services package for the Shop Management System.
Contains business logic and data aggregation services.
"""

from .ledger_service import LedgerService, ledger_service
from .backup_service import BackupService, backup_service
from .dashboard_service import DashboardService, dashboard_service

# List all services for easy importing
__all__ = [
    'LedgerService',
    'ledger_service',
    'BackupService',
    'backup_service',
    'DashboardService',
    'dashboard_service'
]
