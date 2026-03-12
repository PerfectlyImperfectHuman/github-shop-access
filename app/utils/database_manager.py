"""
Database manager for handling SQLite database operations.
Manages connections, sessions, backups, and database utilities.
"""

import os
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Generator
from contextlib import contextmanager
import warnings

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, Session, scoped_session
from sqlalchemy.exc import SQLAlchemyError

from app.config import config
from app.models.base import Base
from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress the specific warning about expression-based index reflection
warnings.filterwarnings('ignore', 
    message='Skipped unsupported reflection of expression-based index'
)


class DatabaseManager:
    """Manages database connections and operations for the Shop Management System"""
    
    def __init__(self):
        self.engine = None
        self.SessionLocal = None
        self._session_factory = None
        self.is_initialized = False
        
        # Expose models
        from app.models import customer, transaction, backup, settings
        self.models = type('Models', (), {
            'Customer': customer.Customer,
            'Transaction': transaction.Transaction,
            'BackupRecord': backup.BackupRecord,
            'Settings': settings.Settings
        })()
    def initialize(self, echo: bool = None) -> None:
        """
        Initialize database connection and session factory.
        
        Args:
            echo: Whether to echo SQL statements (overrides config if provided)
        """
        try:
            # Use config echo setting if not provided
            if echo is None:
                echo = config.database.echo
            
            # Create engine
            self.engine = create_engine(
                config.database_url,  # Use the property
                echo=echo,
                connect_args={"check_same_thread": False},  # SQLite requires this
                pool_pre_ping=True  # Check connection before using
            )
            
            # Create session factory
            self._session_factory = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=self.engine,
                expire_on_commit=False
            )
            
            # Create scoped session for thread safety
            self.SessionLocal = scoped_session(self._session_factory)
            
            self.is_initialized = True
            logger.info(f"Database initialized: {config.database_url}")
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def create_tables(self) -> None:
        """Create all tables in the database"""
        if not self.is_initialized:
            self.initialize()
        
        try:
            # Create all tables
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database tables created successfully")
            
            # Create additional indexes for performance
            self._create_additional_indexes()
            
            # Create default settings if needed
            self._create_default_settings()
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to create tables: {e}")
            raise
    
    def _create_additional_indexes(self) -> None:
        """Create additional performance indexes"""
        try:
            with self.engine.connect() as connection:
                # Index for case-insensitive customer name search
                # Note: This is an expression-based index that SQLAlchemy can't reflect
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_customer_name_lower 
                    ON customers(LOWER(name))
                """))
                
                # Index for transaction search by description
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_transaction_description 
                    ON transactions(description)
                """))
                
                # Index for transaction amount (for reporting)
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_transaction_amount 
                    ON transactions(amount)
                """))
                
                connection.commit()
                logger.debug("Additional indexes created")
                
        except Exception as e:
            logger.warning(f"Could not create additional indexes: {e}")
    
    def _create_default_settings(self) -> None:
        """Create default application settings"""
        try:
            # Check if settings table exists and has records
            inspector = inspect(self.engine)
            if 'settings' in inspector.get_table_names():
                with self.get_session() as session:
                    from app.models.settings import Settings
                    settings_count = session.query(Settings).count()
                    if settings_count == 0:
                        self._insert_default_settings(session)
            else:
                logger.warning("Settings table doesn't exist yet")
                
        except Exception as e:
            logger.warning(f"Could not create default settings: {e}")
    
    def _insert_default_settings(self, session: Session) -> None:
        """Insert default settings into the database"""
        try:
            from app.models.settings import Settings
            
            default_settings = [
                {'key': 'currency_symbol', 'value': 'Rs. '},
                {'key': 'date_format', 'value': 'dd/MM/yyyy'},
                {'key': 'time_format', 'value': 'HH:mm'},
                {'key': 'backup_retention_days', 'value': '40'},
                {'key': 'company_name', 'value': 'Local Shop'},
                {'key': 'last_backup_date', 'value': None},
            ]
            
            for setting in default_settings:
                existing = session.query(Settings).filter_by(key=setting['key']).first()
                if not existing:
                    new_setting = Settings(
                        key=setting['key'],
                        value=setting['value']
                    )
                    session.add(new_setting)
            
            session.commit()
            logger.info("Default settings inserted")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to insert default settings: {e}")
            raise
    
    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager for database sessions.
        Automatically handles session lifecycle.
        
        Usage:
            with db_manager.get_session() as session:
                # Use session
        """
        if not self.is_initialized:
            self.initialize()
        
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Session rollback due to error: {e}")
            raise
        finally:
            session.close()
    
    def execute_query(self, query: str, params: dict = None) -> list:
        """
        Execute a raw SQL query and return results.
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            List of dictionaries representing rows
        """
        if not self.is_initialized:
            self.initialize()
        
        try:
            with self.engine.connect() as connection:
                result = connection.execute(text(query), params or {})
                columns = result.keys()
                return [dict(zip(columns, row)) for row in result.fetchall()]
                
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    def get_database_info(self) -> dict:
        """Get comprehensive database information"""
        if not self.is_initialized:
            self.initialize()
        
        db_path = Path(config.app.database_path)
        
        info = {
            'path': str(db_path.absolute()),
            'exists': db_path.exists(),
            'size_bytes': db_path.stat().st_size if db_path.exists() else 0,
            'tables': [],
            'row_counts': {},
            'indexes': {}
        }
        
        if db_path.exists():
            # Get table information
            inspector = inspect(self.engine)
            info['tables'] = inspector.get_table_names()
            
            # Get row counts for each table
            for table in info['tables']:
                try:
                    count_query = f"SELECT COUNT(*) as count FROM {table}"
                    result = self.execute_query(count_query)
                    if result:
                        info['row_counts'][table] = result[0]['count']
                except Exception:
                    info['row_counts'][table] = 'Error'
            
            # Get index information (ignore warnings)
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings('ignore', 
                    message='Skipped unsupported reflection of expression-based index'
                )
                for table in info['tables']:
                    try:
                        indexes = inspector.get_indexes(table)
                        info['indexes'][table] = indexes
                    except Exception:
                        info['indexes'][table] = []
        
        # Format size for display
        size = info['size_bytes']
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                info['size_formatted'] = f"{size:.1f} {unit}"
                break
            size /= 1024.0
        
        return info
    
    def backup_database(self, backup_type: str = 'MANUAL') -> dict:
        """
        Create a backup of the database.
        
        Args:
            backup_type: Type of backup ('AUTO' or 'MANUAL')
            
        Returns:
            Dictionary with backup information
        """
        try:
            source_path = config.app.database_path
            
            if not source_path.exists():
                error_msg = f"Source database not found: {source_path}"
                logger.error(error_msg)
                return {
                    'success': False,
                    'error': error_msg,
                    'backup_path': None
                }
            
            # Ensure backup directory exists
            backup_dir = config.backup_dir  # Use the property
            backup_dir.mkdir(exist_ok=True)
            
            # Create backup filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
            backup_filename = f"{config.backup.backup_prefix}_{timestamp}_{backup_type}.sqlite"
            backup_path = backup_dir / backup_filename
            
            # Copy the database file
            shutil.copy2(source_path, backup_path)
            
            # Verify backup
            if backup_path.exists() and backup_path.stat().st_size > 0:
                backup_size = backup_path.stat().st_size
                
                # Log backup record
                try:
                    from app.models.backup import BackupRecord
                    with self.get_session() as session:
                        backup_record = BackupRecord(
                            backup_file=str(backup_path.name),
                            backup_size=backup_size,
                            backup_date=datetime.now(),
                            backup_type=backup_type,
                            success=True
                        )
                        session.add(backup_record)
                
                except Exception as e:
                    logger.warning(f"Could not log backup record: {e}")
                
                # Clean old backups
                self._cleanup_old_backups()
                
                logger.info(f"Backup created successfully: {backup_path} ({backup_size} bytes)")
                
                return {
                    'success': True,
                    'backup_path': str(backup_path),
                    'backup_size': backup_size,
                    'backup_type': backup_type,
                    'timestamp': timestamp
                }
            else:
                error_msg = "Backup file creation failed"
                logger.error(error_msg)
                return {
                    'success': False,
                    'error': error_msg,
                    'backup_path': None
                }
                
        except Exception as e:
            error_msg = f"Backup failed: {e}"
            logger.error(error_msg)
            
            # Log failed backup attempt
            try:
                from app.models.backup import BackupRecord
                with self.get_session() as session:
                    backup_record = BackupRecord(
                        backup_file='FAILED',
                        backup_size=0,
                        backup_date=datetime.now(),
                        backup_type=backup_type,
                        success=False,
                        error_message=str(e)
                    )
                    session.add(backup_record)
            except Exception:
                pass
            
            return {
                'success': False,
                'error': error_msg,
                'backup_path': None
            }
    
    def _cleanup_old_backups(self) -> None:
        """Remove backups older than retention period"""
        try:
            backup_dir = config.backup_dir  # Use the property
            if not backup_dir.exists():
                return
            
            retention_days = config.backup.retention_days
            cutoff_date = datetime.now() - timedelta(days=retention_days)
            
            backup_files = list(backup_dir.glob(f"{config.backup.backup_prefix}_*.sqlite"))
            
            for backup_file in backup_files:
                # Try to extract date from filename
                try:
                    # Format: backup_YYYY-MM-DD_HHMMSS_TYPE.sqlite
                    filename = backup_file.stem
                    date_str = filename.split('_')[1]  # YYYY-MM-DD
                    backup_date = datetime.strptime(date_str, "%Y-%m-%d")
                    
                    if backup_date < cutoff_date:
                        backup_file.unlink()
                        logger.info(f"Removed old backup: {backup_file.name}")
                except (IndexError, ValueError) as e:
                    logger.warning(f"Could not parse date from backup file {backup_file.name}: {e}")
                    # If we can't parse the date, check file modification time
                    file_mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)
                    if file_mtime < cutoff_date:
                        backup_file.unlink()
                        logger.info(f"Removed old backup (by mtime): {backup_file.name}")
        
        except Exception as e:
            logger.error(f"Error during backup cleanup: {e}")
    
    def restore_database(self, backup_path: Path) -> dict:
        """
        Restore database from backup.
        
        Args:
            backup_path: Path to the backup file
            
        Returns:
            Dictionary with restore operation results
        """
        try:
            if not backup_path.exists():
                error_msg = f"Backup file not found: {backup_path}"
                logger.error(error_msg)
                return {
                    'success': False,
                    'error': error_msg
                }
            
            # Close all database connections
            if self.engine:
                self.engine.dispose()
            
            current_db = config.app.database_path
            
            # Backup current database if it exists
            if current_db.exists():
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_current = current_db.parent / f"{current_db.stem}_before_restore_{timestamp}.db"
                shutil.copy2(current_db, backup_current)
                logger.info(f"Current database backed up to: {backup_current}")
            
            # Restore from backup
            shutil.copy2(backup_path, current_db)
            
            # Reinitialize database connection
            self.initialize()
            
            # Verify restoration
            if current_db.exists() and current_db.stat().st_size > 0:
                logger.info(f"Database restored successfully from: {backup_path}")
                
                return {
                    'success': True,
                    'restored_from': str(backup_path),
                    'backup_current_created': str(backup_current) if current_db.exists() else None
                }
            else:
                error_msg = "Database restoration failed - file empty or missing"
                logger.error(error_msg)
                return {
                    'success': False,
                    'error': error_msg
                }
                
        except Exception as e:
            error_msg = f"Restore failed: {e}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
    
    def vacuum_database(self) -> bool:
        """Run VACUUM on SQLite database to optimize storage"""
        try:
            with self.engine.connect() as connection:
                connection.execute(text("VACUUM"))
                connection.commit()
            
            logger.info("Database VACUUM completed")
            return True
            
        except Exception as e:
            logger.error(f"Database VACUUM failed: {e}")
            return False
    
    def check_integrity(self) -> dict:
        """Check database integrity"""
        try:
            results = self.execute_query("PRAGMA integrity_check")
            
            if results and results[0].get('integrity_check') == 'ok':
                return {
                    'success': True,
                    'integrity': 'ok',
                    'message': 'Database integrity check passed'
                }
            else:
                return {
                    'success': False,
                    'integrity': 'failed',
                    'message': 'Database integrity check failed',
                    'details': results
                }
                
        except Exception as e:
            return {
                'success': False,
                'integrity': 'error',
                'message': f'Integrity check error: {e}'
            }
    
    def export_to_sql(self, output_path: Path) -> bool:
        """
        Export database to SQL file.
        
        Args:
            output_path: Path to output SQL file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import sqlite3
            
            # Create directory if it doesn't exist
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Connect to SQLite database
            conn = sqlite3.connect(config.app.database_path)
            
            # Write SQL dump to file
            with open(output_path, 'w') as f:
                for line in conn.iterdump():
                    f.write(f'{line}\n')
            
            conn.close()
            logger.info(f"Database exported to SQL: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Database export failed: {e}")
            return False
    
    def import_from_sql(self, sql_path: Path) -> bool:
        """
        Import database from SQL file.
        
        Args:
            sql_path: Path to SQL file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import sqlite3
            
            if not sql_path.exists():
                logger.error(f"SQL file not found: {sql_path}")
                return False
            
            # Close existing connections
            if self.engine:
                self.engine.dispose()
            
            # Backup current database
            current_db = config.app.database_path
            if current_db.exists():
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = current_db.parent / f"{current_db.stem}_before_import_{timestamp}.db"
                shutil.copy2(current_db, backup_path)
                logger.info(f"Current database backed up to: {backup_path}")
            
            # Delete existing database
            if current_db.exists():
                current_db.unlink()
            
            # Create new database and import SQL
            conn = sqlite3.connect(current_db)
            
            with open(sql_path, 'r') as f:
                sql_script = f.read()
            
            conn.executescript(sql_script)
            conn.commit()
            conn.close()
            
            # Reinitialize database connection
            self.initialize()
            
            logger.info(f"Database imported from SQL: {sql_path}")
            return True
            
        except Exception as e:
            logger.error(f"Database import failed: {e}")
            return False
    
    def close(self) -> None:
        """Close all database connections"""
        try:
            if self.engine:
                self.engine.dispose()
                logger.info("Database connections closed")
        except Exception as e:
            logger.warning(f"Error closing database connections: {e}")
    
    def __del__(self):
        """Destructor to ensure connections are closed"""
        self.close()


# Global database manager instance
db_manager = DatabaseManager()

# Add models as an attribute to DatabaseManager class
