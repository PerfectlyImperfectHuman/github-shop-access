"""
Transaction Controller
Handles transaction operations (credit, payment, correction) and ledger management.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from PySide6.QtCore import QObject, Signal, Slot

from app.services.ledger_service import LedgerService
from app.utils.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class TransactionController(QObject):
    """Controller for transaction management operations"""
    
    # Signals for UI updates
    transaction_added = Signal(int)  # transaction_id
    transaction_corrected = Signal(int, int)  # original_id, correction_id
    transactions_loaded = Signal(list)  # list of transactions
    transaction_selected = Signal(dict)  # transaction details
    ledger_updated = Signal()  # ledger changed
    error_occurred = Signal(str)  # error message
    
    def __init__(self, db_manager: DatabaseManager = None):
        """Initialize transaction controller with services"""
        super().__init__()
        
        # Use provided db_manager or create new instance
        self.db_manager = db_manager or DatabaseManager()
        self.ledger_service = LedgerService()
        
        # Cache for transaction data
        self._transactions_cache: Dict[int, Dict[str, Any]] = {}
        self._current_filters: Dict[str, Any] = {}
        
        logger.info("TransactionController initialized")
    
    def add_credit_transaction(self, customer_id: int, amount: float, 
                              description: str = "", reference: str = "") -> Optional[int]:
        """
        Add a CREDIT transaction (customer takes goods on credit).
        
        Args:
            customer_id: ID of customer
            amount: Credit amount (positive)
            description: Transaction description
            reference: Optional reference number (invoice #, etc.)
            
        Returns:
            Transaction ID if successful, None otherwise
        """
        try:
            if amount <= 0:
                error_msg = "Credit amount must be positive"
                logger.warning(error_msg)
                self.error_occurred.emit(error_msg)
                return None
            
            with self.db_manager.get_session() as session:
                from app.models import Customer
                
                # Check if customer exists
                customer = session.query(Customer).filter_by(id=customer_id).first()
                if not customer:
                    error_msg = f"Customer with ID {customer_id} not found"
                    logger.warning(error_msg)
                    self.error_occurred.emit(error_msg)
                    return None
            
            # Pass reference to ledger service (now properly supported)
            transaction = self.ledger_service.add_credit_transaction(
                customer_id=customer_id,
                amount=Decimal(str(amount)),
                description=description,
                reference=reference if reference else None
            )
            
            if transaction:
                # Update cache
                transaction_dict = self.get_transaction(transaction.id)
                if transaction_dict:
                    self._transactions_cache[transaction.id] = transaction_dict
                
                # Emit signals
                self.transaction_added.emit(transaction.id)
                self.ledger_updated.emit()
                
                logger.info(f"Credit transaction added: ID {transaction.id}, Amount: {amount}, Customer: {customer_id}, Reference: {reference}")
            
            return transaction.id if transaction else None
            
        except Exception as e:
            error_msg = f"Failed to add credit transaction: {e}"
            logger.error(error_msg, exc_info=True)
            self.error_occurred.emit(error_msg)
            return None
    
    def add_payment_transaction(self, customer_id: int, amount: float,
                               description: str = "", reference: str = "",
                               payment_method: str = "cash") -> Optional[int]:
        """
        Add a PAYMENT transaction (customer makes payment).
        
        Args:
            customer_id: ID of customer
            amount: Payment amount (positive)
            description: Transaction description
            reference: Optional reference number (cheque #, transaction ID, etc.)
            payment_method: Payment method (cash, bank_transfer, cheque, etc.)
            
        Returns:
            Transaction ID if successful, None otherwise
        """
        try:
            if amount <= 0:
                error_msg = "Payment amount must be positive"
                logger.warning(error_msg)
                self.error_occurred.emit(error_msg)
                return None
            
            # Pass reference and payment_method to ledger service (now properly supported)
            transaction = self.ledger_service.add_payment_transaction(
                customer_id=customer_id,
                amount=Decimal(str(amount)),
                description=description,
                reference=reference if reference else None,
                payment_method=payment_method
            )
            
            if transaction:
                # Update cache
                transaction_dict = self.get_transaction(transaction.id)
                if transaction_dict:
                    self._transactions_cache[transaction.id] = transaction_dict
                
                # Emit signals
                self.transaction_added.emit(transaction.id)
                self.ledger_updated.emit()
                
                logger.info(f"Payment transaction added: ID {transaction.id}, Amount: {amount}, Customer: {customer_id}, Method: {payment_method}, Reference: {reference}")
            
            return transaction.id if transaction else None
            
        except Exception as e:
            error_msg = f"Failed to add payment transaction: {e}"
            logger.error(error_msg, exc_info=True)
            self.error_occurred.emit(error_msg)
            return None
    
    def add_correction_transaction(self, original_transaction_id: int,
                                  correction_amount: float,
                                  reason: str = "") -> Optional[int]:
        """
        Add a CORRECTION transaction to fix an error.
        
        Args:
            original_transaction_id: ID of transaction being corrected
            correction_amount: Correction amount (can be positive or negative)
            reason: Reason for correction
            
        Returns:
            Correction transaction ID if successful, None otherwise
        """
        try:
            # Get original transaction
            original = self.get_transaction(original_transaction_id)
            if not original:
                error_msg = f"Original transaction {original_transaction_id} not found"
                logger.warning(error_msg)
                self.error_occurred.emit(error_msg)
                return None
            
            # FIXED: Method name corrected from 'add_correction' to 'add_correction_transaction'
            correction = self.ledger_service.add_correction_transaction(
                original_transaction_id=original_transaction_id,
                correction_amount=Decimal(str(correction_amount)),
                reason=reason
            )
            
            if correction:
                # Update cache
                transaction_dict = self.get_transaction(correction.id)
                if transaction_dict:
                    self._transactions_cache[correction.id] = transaction_dict
                
                # Emit signals
                self.transaction_corrected.emit(original_transaction_id, correction.id)
                self.ledger_updated.emit()
                
                logger.info(f"Correction transaction added: ID {correction.id}, Original: {original_transaction_id}, Amount: {correction_amount}")
            
            return correction.id if correction else None
            
        except Exception as e:
            error_msg = f"Failed to add correction transaction: {e}"
            logger.error(error_msg, exc_info=True)
            self.error_occurred.emit(error_msg)
            return None
    
    def get_transaction(self, transaction_id: int) -> Optional[Dict[str, Any]]:
        """
        Get transaction details by ID.
        
        Args:
            transaction_id: ID of transaction to retrieve
            
        Returns:
            Transaction dictionary or None if not found
        """
        try:
            # Check cache first
            if transaction_id in self._transactions_cache:
                return self._transactions_cache[transaction_id]
            
            with self.db_manager.get_session() as session:
                from app.models import Transaction, Customer
                
                transaction = session.query(Transaction).filter_by(id=transaction_id).first()
                if not transaction:
                    return None
                
                # Get customer name
                customer = session.query(Customer).filter_by(id=transaction.customer_id).first()
                customer_name = customer.name if customer else "Unknown"
                
                transaction_dict = self._transaction_to_dict(transaction)
                transaction_dict['customer_name'] = customer_name
                
                # Update cache
                self._transactions_cache[transaction_id] = transaction_dict
                
                return transaction_dict
                
        except Exception as e:
            logger.error(f"Failed to get transaction {transaction_id}: {e}", exc_info=True)
            return None
    
    def get_customer_transactions(self, customer_id: int, 
                                 limit: int = 100,
                                 offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get transaction history for a customer.
        
        Args:
            customer_id: ID of customer
            limit: Maximum number of transactions to return
            offset: Offset for pagination
            
        Returns:
            List of transaction dictionaries
        """
        try:
            transactions = self.ledger_service.get_customer_ledger(customer_id)
            # Limit results client-side since get_customer_ledger doesn't support pagination yet
            return transactions[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get transactions for customer {customer_id}: {e}", exc_info=True)
            return []
    
    def get_all_transactions(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get all transactions across all customers.
        
        Args:
            limit: Maximum number of transactions to return
            offset: Offset for pagination
            
        Returns:
            List of transaction dictionaries
        """
        try:
            with self.db_manager.get_session() as session:
                from app.models import Transaction, Customer
                
                transactions = session.query(Transaction).join(Customer).order_by(
                    Transaction.transaction_date.desc()
                ).limit(limit).offset(offset).all()
                
                result = []
                for transaction in transactions:
                    transaction_dict = self._transaction_to_dict(transaction)
                    transaction_dict['customer_name'] = transaction.customer.name
                    result.append(transaction_dict)
                    
                    # Update cache
                    self._transactions_cache[transaction.id] = transaction_dict
                
                # Emit signal for UI update
                self.transactions_loaded.emit(result)
                
                logger.debug(f"Loaded {len(result)} transactions")
                return result
                
        except Exception as e:
            error_msg = f"Failed to get all transactions: {e}"
            logger.error(error_msg, exc_info=True)
            self.error_occurred.emit(error_msg)
            return []
    
    def search_transactions(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Search transactions with various filters.
        
        Args:
            filters: Dictionary of filter criteria including:
                - customer_id: Filter by customer
                - type: CREDIT/PAYMENT/CORRECTION
                - start_date: Start date for timestamp filter
                - end_date: End date for timestamp filter
                - min_amount: Minimum amount
                - max_amount: Maximum amount
                - description: Search in description
                - reference: Search by reference number
                
        Returns:
            List of matching transaction dictionaries
        """
        try:
            # Store current filters
            self._current_filters = filters.copy()
            
            with self.db_manager.get_session() as session:
                from app.models import Transaction, Customer
                from sqlalchemy import and_
                
                query = session.query(Transaction).join(Customer)
                
                # Apply filters
                if 'customer_id' in filters:
                    query = query.filter(Transaction.customer_id == filters['customer_id'])
                
                if 'type' in filters:
                    query = query.filter(Transaction.type == filters['type'])
                
                if 'start_date' in filters:
                    query = query.filter(Transaction.transaction_date >= filters['start_date'])
                
                if 'end_date' in filters:
                    # Add one day to include entire end date
                    end_datetime = filters['end_date'] + timedelta(days=1)
                    query = query.filter(Transaction.transaction_date < end_datetime)
                
                if 'min_amount' in filters:
                    query = query.filter(Transaction.amount >= filters['min_amount'])
                
                if 'max_amount' in filters:
                    query = query.filter(Transaction.amount <= filters['max_amount'])
                
                if 'description' in filters and filters['description']:
                    query = query.filter(Transaction.description.ilike(f"%{filters['description']}%"))
                
                if 'reference' in filters and filters['reference']:
                    query = query.filter(Transaction.reference.ilike(f"%{filters['reference']}%"))
                
                # Order by most recent first
                transactions = query.order_by(Transaction.transaction_date.desc()).all()
                
                result = []
                for transaction in transactions:
                    transaction_dict = self._transaction_to_dict(transaction)
                    transaction_dict['customer_name'] = transaction.customer.name
                    result.append(transaction_dict)
                    
                    # Update cache
                    self._transactions_cache[transaction.id] = transaction_dict
                
                # Emit signal so UI updates table
                self.transactions_loaded.emit(result)
                
                logger.debug(f"Search returned {len(result)} transactions")
                return result
                
        except Exception as e:
            error_msg = f"Failed to search transactions: {e}"
            logger.error(error_msg, exc_info=True)
            self.error_occurred.emit(error_msg)
            return []
    
    def get_transaction_statistics(self, start_date: datetime = None, 
                                  end_date: datetime = None) -> Dict[str, Any]:
        """
        Get transaction statistics for a period.
        
        Args:
            start_date: Start date for statistics
            end_date: End date for statistics
            
        Returns:
            Dictionary of transaction statistics
        """
        try:
            return self.ledger_service.get_transaction_statistics(start_date, end_date)
        except Exception as e:
            logger.error(f"Failed to get transaction statistics: {e}", exc_info=True)
            return {}
    
    def get_daily_summary(self, date: datetime = None) -> Dict[str, Any]:
        """
        Get daily transaction summary.
        
        Args:
            date: Date for summary (default: today)
            
        Returns:
            Dictionary of daily summary
        """
        try:
            if date is None:
                date = datetime.now().date()
            
            # Set start and end of day
            start_date = datetime.combine(date, datetime.min.time())
            end_date = start_date + timedelta(days=1)
            
            return self.ledger_service.get_daily_summary(start_date, end_date)
        except Exception as e:
            logger.error(f"Failed to get daily summary: {e}", exc_info=True)
            return {}
    
    def get_ledger_entries(self, customer_id: int = None) -> List[Dict[str, Any]]:
        """
        Get formatted ledger entries for display.
        
        Args:
            customer_id: Optional customer ID to filter
            
        Returns:
            List of ledger entry dictionaries
        """
        try:
            return self.ledger_service.get_customer_ledger(customer_id)
        except Exception as e:
            logger.error(f"Failed to get ledger entries: {e}", exc_info=True)
            return []
    
    def get_customer_balance(self, customer_id: int) -> float:
        """
        Get current balance for a customer.
        
        Args:
            customer_id: ID of customer
            
        Returns:
            Current balance
        """
        try:
            return float(self.ledger_service.get_customer_balance(customer_id))
        except Exception as e:
            logger.error(f"Failed to get customer balance {customer_id}: {e}", exc_info=True)
            return 0.0
    
    def get_customer_statement(self, customer_id: int, 
                              start_date: datetime = None,
                              end_date: datetime = None) -> Dict[str, Any]:
        """
        Get customer statement with opening/closing balances and transactions.
        
        Args:
            customer_id: ID of customer
            start_date: Statement start date
            end_date: Statement end date
            
        Returns:
            Complete customer statement
        """
        try:
            return self.ledger_service.get_customer_statement(
                customer_id, start_date, end_date
            )
        except Exception as e:
            logger.error(f"Failed to get customer statement {customer_id}: {e}", exc_info=True)
            return {
                'customer_id': customer_id,
                'opening_balance': 0.0,
                'closing_balance': 0.0,
                'transactions': [],
                'total_credit': 0.0,
                'total_payment': 0.0
            }
    
    def export_statement(self, customer_id: int, filepath: str,
                        start_date: datetime = None,
                        end_date: datetime = None) -> bool:
        """
        Export customer statement to file.
        
        Args:
            customer_id: ID of customer
            filepath: Path to save file
            start_date: Statement start date
            end_date: Statement end date
            
        Returns:
            True if successful, False otherwise
        """
        try:
            statement = self.get_customer_statement(customer_id, start_date, end_date)
            
            # Simple CSV export
            import csv
            
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # Header
                writer.writerow(['Customer Statement'])
                writer.writerow([f"Customer: {statement.get('customer_name', 'Unknown')}"])
                writer.writerow([f"Period: {start_date} to {end_date}" if start_date and end_date else "Full History"])
                writer.writerow([])
                
                # Summary
                writer.writerow(['Summary'])
                writer.writerow(['Opening Balance:', statement.get('opening_balance', 0.0)])
                writer.writerow(['Total Credit:', statement.get('total_credit', 0.0)])
                writer.writerow(['Total Payment:', statement.get('total_payment', 0.0)])
                writer.writerow(['Closing Balance:', statement.get('closing_balance', 0.0)])
                writer.writerow([])
                
                # Transactions
                writer.writerow(['Transactions'])
                writer.writerow(['Date', 'Type', 'Description', 'Reference', 'Payment Method', 'Amount', 'Balance'])
                
                for transaction in statement.get('transactions', []):
                    writer.writerow([
                        transaction.get('transaction_date', ''),
                        transaction.get('type', ''),
                        transaction.get('description', ''),
                        transaction.get('reference', ''),
                        transaction.get('payment_method', ''),
                        transaction.get('amount', 0.0),
                        transaction.get('running_balance', 0.0)
                    ])
            
            logger.info(f"Statement exported to {filepath}")
            return True
            
        except Exception as e:
            error_msg = f"Failed to export statement: {e}"
            logger.error(error_msg, exc_info=True)
            self.error_occurred.emit(error_msg)
            return False
    
    def clear_cache(self) -> None:
        """Clear the transaction cache."""
        self._transactions_cache.clear()
        self._current_filters = {}
        logger.debug("Transaction cache cleared")
    
    def _transaction_to_dict(self, transaction) -> Dict[str, Any]:
        """Convert SQLAlchemy Transaction object to dictionary."""
        return {
            'id': transaction.id,
            'type': transaction.type,
            'customer_id': transaction.customer_id,
            'amount': float(transaction.amount),
            'description': transaction.description or '',
            'reference': transaction.reference or '',
            'payment_method': transaction.payment_method or 'cash',
            'transaction_date': transaction.transaction_date,
            'is_correction': transaction.is_correction,
            'original_transaction_id': transaction.original_transaction_id,
            'created_at': transaction.created_at,
            'updated_at': transaction.updated_at
        }
    
    # Slots for UI interactions
    @Slot(int, float, str)
    def on_add_credit_requested(self, customer_id: int, amount: float, description: str):
        """Handle add credit request from UI"""
        self.add_credit_transaction(customer_id, amount, description)
    
    @Slot(int, float, str, str)
    def on_add_payment_requested(self, customer_id: int, amount: float, description: str, payment_method: str):
        """Handle add payment request from UI"""
        self.add_payment_transaction(customer_id, amount, description, "", payment_method)
    
    @Slot(int, float, str)
    def on_add_correction_requested(self, original_id: int, amount: float, reason: str):
        """Handle add correction request from UI"""
        self.add_correction_transaction(original_id, amount, reason)
    
    @Slot(dict)
    def on_search_transactions_requested(self, filters: dict):
        """Handle search transactions request from UI"""
        results = self.search_transactions(filters)
        # Signal already emitted in search_transactions()
    
    @Slot()
    def on_load_all_transactions_requested(self):
        """Handle load all transactions request from UI"""
        self.get_all_transactions()
    
    @Slot(int)
    def on_transaction_selected(self, transaction_id: int):
        """Handle transaction selection from UI"""
        transaction = self.get_transaction(transaction_id)
        if transaction:
            self.transaction_selected.emit(transaction)
    
    @Slot(int, str, datetime, datetime)
    def on_export_statement_requested(self, customer_id: int, filepath: str, start_date: datetime, end_date: datetime):
        """Handle export statement request from UI"""
        self.export_statement(customer_id, filepath, start_date, end_date)
