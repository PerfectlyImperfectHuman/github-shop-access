#!/usr/bin/env python3
"""
Database initialization script for Shop Management System.
"""

import sys
import logging
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.utils.database_manager import db_manager
from app.config import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def initialize_database(force: bool = False) -> bool:
    """
    Initialize the database with all tables.
    
    Args:
        force: If True, recreate tables even if they exist
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info("Initializing database...")
        
        # Initialize database manager
        db_manager.initialize(echo=False)
        
        # Check if database already exists and has tables
        db_info = db_manager.get_database_info()
        
        if db_info['exists'] and db_info['tables'] and not force:
            logger.info(f"Database already exists at: {db_info['path']}")
            logger.info(f"Existing tables: {', '.join(db_info['tables'])}")
            
            response = input("Database already exists. Recreate tables? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                logger.info("Skipping table creation")
                return True
        
        # Create all tables
        db_manager.create_tables()
        
        # Get updated database info
        db_info = db_manager.get_database_info()
        
        logger.info("Database initialized successfully!")
        logger.info(f"Database path: {db_info['path']}")
        logger.info(f"Database size: {db_info['size_formatted']}")
        logger.info(f"Tables created: {', '.join(db_info['tables'])}")
        
        # Test database connection with a sample query
        logger.info("Testing database connection...")
        test_result = db_manager.execute_query("SELECT 1 as test_value")
        if test_result and test_result[0]['test_value'] == 1:
            logger.info("Database connection test: ✓ PASSED")
        else:
            logger.warning("Database connection test: ✗ FAILED")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False


def check_database() -> bool:
    """Check if database exists and is accessible"""
    try:
        db_path = Path(config.app.database_path)
        
        if not db_path.exists():
            logger.warning(f"Database file not found: {db_path}")
            return False
        
        # Try to connect
        db_manager.initialize()
        
        # Test connection with a simple query
        result = db_manager.execute_query("SELECT 1 as test")
        
        if result and result[0]['test'] == 1:
            logger.info("Database connection successful")
            return True
        else:
            logger.error("Database test query failed")
            return False
            
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        return False


def main():
    """Main function"""
    print("=" * 60)
    print("Shop Management System - Database Initialization")
    print("=" * 60)
    
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize database for Shop Management System")
    parser.add_argument('--force', '-f', action='store_true', help='Force recreation of tables')
    parser.add_argument('--check', '-c', action='store_true', help='Only check database status')
    
    args = parser.parse_args()
    
    if args.check:
        # Only check database status
        if check_database():
            print("\n✅ Database is accessible and working.")
        else:
            print("\n❌ Database check failed.")
        return
    
    # Check if database exists
    if check_database() and not args.force:
        print("\n✅ Database already exists and is accessible.")
        response = input("Do you want to reinitialize? (yes/no): ").strip().lower()
        
        if response not in ['yes', 'y']:
            print("Exiting without changes.")
            sys.exit(0)
    
    # Initialize database
    if initialize_database(force=args.force):
        print("\n✅ Database initialized successfully!")
        print("\nYou can now run the application with:")
        print("  python -m app.main")
    else:
        print("\n❌ Database initialization failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
