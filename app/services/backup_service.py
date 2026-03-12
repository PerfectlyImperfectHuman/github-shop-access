"""
Backup Service for handling automated backups, scheduling,
and backup management for the Shop Management System.
"""

import schedule
import time
import threading
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from app.config import config
from app.utils.database_manager import db_manager

# Configure logging
logger = logging.getLogger(__name__)


class BackupService:
    """Service for managing automated backups and backup operations"""
    
    def __init__(self):
        self.scheduler = None
        self.backup_thread = None
        self.is_running = False
        self.last_backup = None
        
    def start_auto_backup(self) -> bool:
        """
        Start the automatic backup scheduler.
        
        Returns:
            True if started successfully
        """
        if self.is_running:
            logger.warning("Backup scheduler is already running")
            return False
        
        try:
            # Parse backup time
            backup_time = config.backup.auto_backup_time
            hour, minute = map(int, backup_time.split(':'))
            
            # Schedule daily backup
            schedule.every().day.at(f"{hour:02d}:{minute:02d}").do(
                self.perform_auto_backup
            )
            
            # Start scheduler in a separate thread
            self.is_running = True
            self.backup_thread = threading.Thread(
                target=self._run_scheduler,
                daemon=True,
                name="BackupScheduler"
            )
            self.backup_thread.start()
            
            logger.info(f"Auto backup scheduler started. Backups scheduled daily at {backup_time}")
            
            # Perform initial backup check
            self._check_initial_backup()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to start auto backup scheduler: {e}")
            return False
    
    def stop_auto_backup(self) -> bool:
        """
        Stop the automatic backup scheduler.
        
        Returns:
            True if stopped successfully
        """
        if not self.is_running:
            logger.warning("Backup scheduler is not running")
            return False
        
        try:
            self.is_running = False
            if self.backup_thread:
                self.backup_thread.join(timeout=5)
            
            logger.info("Auto backup scheduler stopped")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop auto backup scheduler: {e}")
            return False
    
    def _run_scheduler(self):
        """Run the schedule loop in background thread"""
        while self.is_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def _check_initial_backup(self):
        """Check if a backup needs to be created initially"""
        try:
            backup_dir = config.backup_dir
            if not backup_dir.exists():
                return
            
            # Check if we have any backups from today
            today = datetime.now().date()
            today_backups = list(backup_dir.glob(f"backup_{today.strftime('%Y-%m-%d')}*.sqlite"))
            
            if not today_backups:
                logger.info("No backup exists for today. Creating initial backup...")
                self.perform_auto_backup()
                
        except Exception as e:
            logger.warning(f"Initial backup check failed: {e}")
    
    def perform_auto_backup(self) -> Dict:
        """
        Perform an automatic backup.
        
        Returns:
            Dictionary with backup results
        """
        logger.info("Starting automatic backup...")
        return self.perform_backup(backup_type='AUTO')
    
    def perform_manual_backup(self) -> Dict:
        """
        Perform a manual backup (triggered by user).
        
        Returns:
            Dictionary with backup results
        """
        logger.info("Starting manual backup...")
        return self.perform_backup(backup_type='MANUAL')
    
    def perform_backup(self, backup_type: str = 'AUTO') -> Dict:
        """
        Perform a backup operation.
        
        Args:
            backup_type: Type of backup ('AUTO' or 'MANUAL')
            
        Returns:
            Dictionary with backup results
        """
        try:
            # Perform backup using database manager
            result = db_manager.backup_database(backup_type)
            
            if result['success']:
                self.last_backup = datetime.now()
                logger.info(f"Backup completed successfully: {result['backup_path']}")
                
                # Return enhanced result
                result.update({
                    'timestamp': self.last_backup.isoformat(),
                    'message': 'Backup completed successfully'
                })
            else:
                logger.error(f"Backup failed: {result.get('error', 'Unknown error')}")
                result.update({
                    'timestamp': datetime.now().isoformat(),
                    'message': f"Backup failed: {result.get('error', 'Unknown error')}"
                })
            
            return result
            
        except Exception as e:
            error_msg = f"Backup operation failed: {e}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'timestamp': datetime.now().isoformat(),
                'message': error_msg
            }
    
    def get_backup_list(self) -> List[Dict]:
        """
        Get list of all available backups.
        
        Returns:
            List of backup information dictionaries
        """
        try:
            backup_dir = config.backup_dir
            if not backup_dir.exists():
                return []
            
            backups = []
            backup_files = list(backup_dir.glob(f"{config.backup.backup_prefix}_*.sqlite"))
            
            for backup_file in sorted(backup_files, reverse=True):
                try:
                    stat = backup_file.stat()
                    
                    # Parse information from filename
                    filename = backup_file.stem
                    parts = filename.split('_')
                    
                    if len(parts) >= 3:
                        date_str = parts[1]  # YYYY-MM-DD
                        time_str = parts[2] if len(parts[2]) == 6 else "000000"  # HHMMSS
                        backup_type = parts[3] if len(parts) >= 4 else 'UNKNOWN'
                        
                        # Parse datetime
                        try:
                            backup_time = datetime.strptime(
                                f"{date_str} {time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}",
                                "%Y-%m-%d %H:%M:%S"
                            )
                        except ValueError:
                            backup_time = datetime.fromtimestamp(stat.st_mtime)
                    else:
                        backup_type = 'UNKNOWN'
                        backup_time = datetime.fromtimestamp(stat.st_mtime)
                    
                    backups.append({
                        'filename': backup_file.name,
                        'path': str(backup_file.absolute()),
                        'size_bytes': stat.st_size,
                        'size_formatted': self._format_file_size(stat.st_size),
                        'created': backup_time,
                        'modified': datetime.fromtimestamp(stat.st_mtime),
                        'type': backup_type,
                        'age_days': (datetime.now() - backup_time).days
                    })
                    
                except Exception as e:
                    logger.warning(f"Could not parse backup file {backup_file.name}: {e}")
            
            return backups
            
        except Exception as e:
            logger.error(f"Failed to get backup list: {e}")
            return []
    
    def get_backup_status(self) -> Dict:
        """
        Get current backup system status.
        
        Returns:
            Dictionary with backup system status
        """
        try:
            backup_dir = config.backup_dir
            exists = backup_dir.exists()
            
            # Count backups
            backup_count = 0
            total_size = 0
            if exists:
                backup_files = list(backup_dir.glob(f"{config.backup.backup_prefix}_*.sqlite"))
                backup_count = len(backup_files)
                total_size = sum(f.stat().st_size for f in backup_files)
            
            # Get oldest and newest backup
            oldest_backup = None
            newest_backup = None
            
            backups = self.get_backup_list()
            if backups:
                oldest_backup = min(backups, key=lambda x: x['created'])
                newest_backup = max(backups, key=lambda x: x['created'])
            
            return {
                'auto_backup_enabled': config.backup.auto_backup,
                'auto_backup_time': config.backup.auto_backup_time,
                'retention_days': config.backup.retention_days,
                'backup_dir': str(backup_dir),
                'backup_dir_exists': exists,
                'backup_count': backup_count,
                'total_size_bytes': total_size,
                'total_size_formatted': self._format_file_size(total_size),
                'scheduler_running': self.is_running,
                'last_backup_time': self.last_backup.isoformat() if self.last_backup else None,
                'oldest_backup': oldest_backup['created'].isoformat() if oldest_backup else None,
                'newest_backup': newest_backup['created'].isoformat() if newest_backup else None,
                'backups_need_cleanup': self._check_backup_cleanup_needed()
            }
            
        except Exception as e:
            logger.error(f"Failed to get backup status: {e}")
            return {
                'error': str(e),
                'auto_backup_enabled': config.backup.auto_backup,
                'scheduler_running': self.is_running
            }
    
    def _check_backup_cleanup_needed(self) -> bool:
        """Check if backup cleanup is needed"""
        try:
            backup_dir = config.backup_dir
            if not backup_dir.exists():
                return False
            
            backup_files = list(backup_dir.glob(f"{config.backup.backup_prefix}_*.sqlite"))
            if len(backup_files) > config.backup.max_backups:
                return True
            
            # Check for backups older than retention period
            retention_days = config.backup.retention_days
            cutoff_date = datetime.now() - timedelta(days=retention_days)
            
            for backup_file in backup_files:
                try:
                    filename = backup_file.stem
                    parts = filename.split('_')
                    if len(parts) >= 2:
                        date_str = parts[1]
                        backup_date = datetime.strptime(date_str, "%Y-%m-%d")
                        if backup_date < cutoff_date:
                            return True
                except (IndexError, ValueError):
                    # If we can't parse the date, check modification time
                    file_mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)
                    if file_mtime < cutoff_date:
                        return True
            
            return False
            
        except Exception:
            return False
    
    def cleanup_old_backups(self) -> Dict:
        """
        Manually trigger cleanup of old backups.
        
        Returns:
            Dictionary with cleanup results
        """
        try:
            # This will trigger during the next backup or we can call db_manager's cleanup
            # For now, we'll manually check and delete
            backup_dir = config.backup_dir
            if not backup_dir.exists():
                return {
                    'success': True,
                    'message': 'No backup directory exists',
                    'deleted_count': 0
                }
            
            retention_days = config.backup.retention_days
            cutoff_date = datetime.now() - timedelta(days=retention_days)
            
            backup_files = list(backup_dir.glob(f"{config.backup.backup_prefix}_*.sqlite"))
            deleted_count = 0
            
            for backup_file in backup_files:
                try:
                    filename = backup_file.stem
                    parts = filename.split('_')
                    if len(parts) >= 2:
                        date_str = parts[1]
                        backup_date = datetime.strptime(date_str, "%Y-%m-%d")
                        if backup_date < cutoff_date:
                            backup_file.unlink()
                            deleted_count += 1
                            logger.info(f"Deleted old backup: {backup_file.name}")
                except (IndexError, ValueError):
                    # If we can't parse the date, check modification time
                    file_mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)
                    if file_mtime < cutoff_date:
                        backup_file.unlink()
                        deleted_count += 1
                        logger.info(f"Deleted old backup (by mtime): {backup_file.name}")
            
            message = f"Deleted {deleted_count} old backup(s)"
            logger.info(message)
            
            return {
                'success': True,
                'message': message,
                'deleted_count': deleted_count,
                'retention_days': retention_days
            }
            
        except Exception as e:
            error_msg = f"Backup cleanup failed: {e}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'deleted_count': 0
            }
    
    def restore_backup(self, backup_path: str) -> Dict:
        """
        Restore database from a backup file.
        
        Args:
            backup_path: Path to the backup file
            
        Returns:
            Dictionary with restore results
        """
        try:
            backup_file = Path(backup_path)
            if not backup_file.exists():
                return {
                    'success': False,
                    'error': f"Backup file not found: {backup_path}"
                }
            
            logger.info(f"Starting restore from backup: {backup_path}")
            
            # Stop any running operations if needed
            was_running = self.is_running
            if was_running:
                self.stop_auto_backup()
            
            # Perform restore
            result = db_manager.restore_database(backup_file)
            
            # Restart scheduler if it was running
            if was_running:
                self.start_auto_backup()
            
            if result['success']:
                message = f"Database restored successfully from {backup_path}"
                logger.info(message)
                result['message'] = message
            else:
                logger.error(f"Restore failed: {result.get('error', 'Unknown error')}")
            
            return result
            
        except Exception as e:
            error_msg = f"Restore operation failed: {e}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
    
    def verify_backup(self, backup_path: str) -> Dict:
        """
        Verify the integrity of a backup file.
        
        Args:
            backup_path: Path to the backup file
            
        Returns:
            Dictionary with verification results
        """
        try:
            import sqlite3
            
            backup_file = Path(backup_path)
            if not backup_file.exists():
                return {
                    'success': False,
                    'error': f"Backup file not found: {backup_path}"
                }
            
            # Try to open the backup database
            conn = None
            try:
                conn = sqlite3.connect(backup_file)
                cursor = conn.cursor()
                
                # Check if it's a valid SQLite database
                cursor.execute("SELECT sqlite_version()")
                version = cursor.fetchone()[0]
                
                # Check for required tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                
                required_tables = {'customers', 'transactions'}
                missing_tables = required_tables - set(tables)
                
                if missing_tables:
                    return {
                        'success': False,
                        'error': f"Missing required tables: {missing_tables}",
                        'version': version,
                        'tables_found': tables
                    }
                
                # Get some statistics
                cursor.execute("SELECT COUNT(*) FROM customers")
                customer_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM transactions")
                transaction_count = cursor.fetchone()[0]
                
                return {
                    'success': True,
                    'message': 'Backup verification passed',
                    'version': version,
                    'tables': tables,
                    'customer_count': customer_count,
                    'transaction_count': transaction_count,
                    'file_size': backup_file.stat().st_size,
                    'file_size_formatted': self._format_file_size(backup_file.stat().st_size)
                }
                
            finally:
                if conn:
                    conn.close()
                    
        except Exception as e:
            return {
                'success': False,
                'error': f"Backup verification failed: {e}"
            }
    
    def _format_file_size(self, size_bytes: int) -> str:
        """
        Format file size in human-readable format.
        
        Args:
            size_bytes: Size in bytes
            
        Returns:
            Formatted size string
        """
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"


# Global backup service instance
backup_service = BackupService()
