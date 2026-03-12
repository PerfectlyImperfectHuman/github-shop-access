"""
Customer Controller
Handles customer CRUD operations, search, and management.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from PySide6.QtCore import QObject, Signal, Slot

from app.services.ledger_service import LedgerService
from app.utils.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class CustomerController(QObject):
    """Controller for customer management operations"""
    
    # Signals for UI updates
    customer_added = Signal(int)  # customer_id
    customer_updated = Signal(int)  # customer_id
    customer_deleted = Signal(int)  # customer_id
    customers_loaded = Signal(list)  # list of customers
    customer_selected = Signal(dict)  # customer details
    error_occurred = Signal(str)  # error message
    
    def __init__(self, db_manager: DatabaseManager = None):
        """Initialize customer controller with services"""
        super().__init__()
        
        # Use provided db_manager or create new instance
        self.db_manager = db_manager or DatabaseManager()
        self.ledger_service = LedgerService()
        
        # Cache for customer data
        self._customers_cache: Dict[int, Dict[str, Any]] = {}
        self._current_search_results: List[Dict[str, Any]] = []
        
        logger.info("CustomerController initialized")
    
    def add_customer(self, name: str, phone: str = "", notes: str = "") -> Optional[int]:
        """
        Add a new customer to the system.
        
        Args:
            name: Customer name (must be unique)
            phone: Contact phone number
            notes: Additional notes
            
        Returns:
            Customer ID if successful, None otherwise
        """
        try:
            with self.db_manager.get_session() as session:
                from app.models import Customer
                
                # Check if customer with same name already exists
                existing = session.query(Customer).filter_by(name=name).first()
                if existing:
                    error_msg = f"Customer with name '{name}' already exists"
                    logger.warning(error_msg)
                    self.error_occurred.emit(error_msg)
                    return None
                
                # Create new customer
                customer = Customer(
                    name=name,
                    phone=phone,
                    notes=notes,
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                session.add(customer)
                session.commit()
                session.refresh(customer)
                
                # Add to cache
                customer_dict = self._customer_to_dict(customer)
                self._customers_cache[customer.id] = customer_dict
                
                # Emit signal
                self.customer_added.emit(customer.id)
                logger.info(f"Customer added: {name} (ID: {customer.id})")
                
                return customer.id
                
        except Exception as e:
            error_msg = f"Failed to add customer: {e}"
            logger.error(error_msg)
            self.error_occurred.emit(error_msg)
            return None
    
    def update_customer(self, customer_id: int, **kwargs) -> bool:
        """
        Update customer information.
        
        Args:
            customer_id: ID of customer to update
            **kwargs: Fields to update (name, phone, notes, is_active)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.db_manager.get_session() as session:
                from app.models import Customer
                
                customer = session.query(Customer).filter_by(id=customer_id).first()
                if not customer:
                    error_msg = f"Customer with ID {customer_id} not found"
                    logger.warning(error_msg)
                    self.error_occurred.emit(error_msg)
                    return False
                
                # Check if name change would cause duplicate
                if 'name' in kwargs and kwargs['name'] != customer.name:
                    existing = session.query(Customer).filter_by(name=kwargs['name']).first()
                    if existing and existing.id != customer_id:
                        error_msg = f"Another customer with name '{kwargs['name']}' already exists"
                        logger.warning(error_msg)
                        self.error_occurred.emit(error_msg)
                        return False
                
                # Update fields
                allowed_fields = ['name', 'phone', 'notes', 'is_active']
                for field in allowed_fields:
                    if field in kwargs:
                        setattr(customer, field, kwargs[field])
                
                customer.updated_at = datetime.now()
                session.commit()
                
                # Update cache
                customer_dict = self._customer_to_dict(customer)
                self._customers_cache[customer_id] = customer_dict
                
                # Emit signal
                self.customer_updated.emit(customer_id)
                logger.info(f"Customer updated: ID {customer_id}")
                
                return True
                
        except Exception as e:
            error_msg = f"Failed to update customer: {e}"
            logger.error(error_msg)
            self.error_occurred.emit(error_msg)
            return False
    
    def delete_customer(self, customer_id: int) -> bool:
        """
        Delete a customer (only if they have no transactions).
        
        Args:
            customer_id: ID of customer to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.db_manager.get_session() as session:
                from app.models import Customer, Transaction
                
                customer = session.query(Customer).filter_by(id=customer_id).first()
                if not customer:
                    error_msg = f"Customer with ID {customer_id} not found"
                    logger.warning(error_msg)
                    self.error_occurred.emit(error_msg)
                    return False
                
                # Check if customer has any transactions
                transaction_count = session.query(Transaction).filter_by(customer_id=customer_id).count()
                if transaction_count > 0:
                    error_msg = f"Cannot delete customer with {transaction_count} transaction(s). Deactivate instead."
                    logger.warning(error_msg)
                    self.error_occurred.emit(error_msg)
                    return False
                
                # Delete customer
                session.delete(customer)
                session.commit()
                
                # Remove from cache
                if customer_id in self._customers_cache:
                    del self._customers_cache[customer_id]
                
                # Emit signal
                self.customer_deleted.emit(customer_id)
                logger.info(f"Customer deleted: ID {customer_id}")
                
                return True
                
        except Exception as e:
            error_msg = f"Failed to delete customer: {e}"
            logger.error(error_msg)
            self.error_occurred.emit(error_msg)
            return False
    
    def get_customer(self, customer_id: int, include_balance: bool = True) -> Optional[Dict[str, Any]]:
        """
        Get customer details by ID.
        
        Args:
            customer_id: ID of customer to retrieve
            include_balance: Whether to include calculated balance
            
        Returns:
            Customer dictionary or None if not found
        """
        try:
            # Check cache first
            if customer_id in self._customers_cache and not include_balance:
                return self._customers_cache[customer_id]
            
            with self.db_manager.get_session() as session:
                from app.models import Customer
                
                customer = session.query(Customer).filter_by(id=customer_id).first()
                if not customer:
                    return None
                
                customer_dict = self._customer_to_dict(customer)
                
                # Calculate balance if requested
                if include_balance:
                    balance = self.ledger_service.get_customer_balance(customer_id)
                    customer_dict['balance'] = balance
                
                # Update cache
                self._customers_cache[customer_id] = customer_dict
                
                return customer_dict
                
        except Exception as e:
            logger.error(f"Failed to get customer {customer_id}: {e}")
            return None
    
    def get_all_customers(self, include_balance: bool = True, active_only: bool = False) -> List[Dict[str, Any]]:
        """
        Get all customers.
        
        Args:
            include_balance: Whether to include calculated balance
            active_only: If True, only return active customers
            
        Returns:
            List of customer dictionaries
        """
        try:
            with self.db_manager.get_session() as session:
                from app.models import Customer
                
                query = session.query(Customer)
                
                if active_only:
                    query = query.filter(Customer.is_active == True)
                
                customers = query.order_by(Customer.name).all()
                result = []
                
                for customer in customers:
                    customer_dict = self._customer_to_dict(customer)
                    
                    if include_balance:
                        balance = self.ledger_service.get_customer_balance(customer.id)
                        customer_dict['balance'] = balance
                    
                    result.append(customer_dict)
                    # Update cache
                    self._customers_cache[customer.id] = customer_dict
                
                # Update search results cache
                self._current_search_results = result
                
                # Emit signal
                self.customers_loaded.emit(result)
                logger.debug(f"Loaded {len(result)} customers")
                
                return result
                
        except Exception as e:
            error_msg = f"Failed to get all customers: {e}"
            logger.error(error_msg)
            self.error_occurred.emit(error_msg)
            return []
    
    def search_customers(self, query: str, search_fields: List[str] = None) -> List[Dict[str, Any]]:
        """
        Search customers by name, phone, or notes.
        
        Args:
            query: Search string
            search_fields: List of fields to search (default: ['name', 'phone', 'notes'])
            
        Returns:
            List of matching customer dictionaries
        """
        try:
            if not query or query.strip() == "":
                return self.get_all_customers(include_balance=True)
            
            query = query.strip().lower()
            if search_fields is None:
                search_fields = ['name', 'phone', 'notes']
            
            with self.db_manager.get_session() as session:
                from app.models import Customer
                from sqlalchemy import or_
                
                # Build search conditions
                conditions = []
                if 'name' in search_fields:
                    conditions.append(Customer.name.ilike(f"%{query}%"))
                if 'phone' in search_fields:
                    conditions.append(Customer.phone.ilike(f"%{query}%"))
                if 'notes' in search_fields:
                    conditions.append(Customer.notes.ilike(f"%{query}%"))
                
                customers = session.query(Customer).filter(or_(*conditions)).order_by(Customer.name).all()
                result = []
                
                for customer in customers:
                    customer_dict = self._customer_to_dict(customer)
                    balance = self.ledger_service.get_customer_balance(customer.id)
                    customer_dict['balance'] = balance
                    result.append(customer_dict)
                
                # Update search results cache
                self._current_search_results = result
                
                logger.debug(f"Search '{query}' returned {len(result)} results")
                return result
                
        except Exception as e:
            logger.error(f"Failed to search customers: {e}")
            return []
    
    def get_customer_transactions(self, customer_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get transaction history for a customer.
        
        Args:
            customer_id: ID of customer
            limit: Maximum number of transactions to return
            
        Returns:
            List of transaction dictionaries
        """
        try:
            return self.ledger_service.get_customer_transactions(customer_id, limit=limit)
        except Exception as e:
            logger.error(f"Failed to get transactions for customer {customer_id}: {e}")
            return []
    
    def get_customers_with_balance(self, min_balance: float = None, max_balance: float = None) -> List[Dict[str, Any]]:
        """
        Get customers filtered by balance range.
        
        Args:
            min_balance: Minimum balance (inclusive)
            max_balance: Maximum balance (inclusive)
            
        Returns:
            List of customer dictionaries with balance
        """
        try:
            with self.db_manager.get_session() as session:
                from app.models import Customer
                
                customers = session.query(Customer).order_by(Customer.name).all()
                result = []
                
                for customer in customers:
                    balance = self.ledger_service.get_customer_balance(customer.id)
                    
                    # Apply balance filters
                    if min_balance is not None and balance < min_balance:
                        continue
                    if max_balance is not None and balance > max_balance:
                        continue
                    
                    customer_dict = self._customer_to_dict(customer)
                    customer_dict['balance'] = balance
                    result.append(customer_dict)
                
                return result
                
        except Exception as e:
            logger.error(f"Failed to get customers with balance filter: {e}")
            return []
    
    def get_customer_statistics(self, customer_id: int) -> Dict[str, Any]:
        """
        Get statistics for a customer.
        
        Args:
            customer_id: ID of customer
            
        Returns:
            Dictionary of customer statistics
        """
        try:
            stats = self.ledger_service.get_customer_statistics(customer_id)
            
            # Add customer info
            customer = self.get_customer(customer_id, include_balance=False)
            if customer:
                stats.update({
                    'customer_name': customer['name'],
                    'phone': customer['phone']
                })
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get customer statistics {customer_id}: {e}")
            return {}
    
    def clear_cache(self) -> None:
        """Clear the customer cache."""
        self._customers_cache.clear()
        self._current_search_results = []
        logger.debug("Customer cache cleared")
    
    def _customer_to_dict(self, customer) -> Dict[str, Any]:
        """Convert SQLAlchemy Customer object to dictionary."""
        return {
            'id': customer.id,
            'name': customer.name,
            'phone': customer.phone or '',
            'notes': customer.notes or '',
            'is_active': customer.is_active,
            'created_at': customer.created_at,
            'updated_at': customer.updated_at
        }
    
    # Slots for UI interactions
    @Slot(str, str, str)
    def on_add_customer_requested(self, name: str, phone: str, notes: str):
        """Handle add customer request from UI"""
        customer_id = self.add_customer(name, phone, notes)
        if customer_id:
            # Emit customer selected signal for the new customer
            customer = self.get_customer(customer_id)
            if customer:
                self.customer_selected.emit(customer)
    
    @Slot(int, dict)
    def on_update_customer_requested(self, customer_id: int, updates: dict):
        """Handle update customer request from UI"""
        success = self.update_customer(customer_id, **updates)
        if success:
            # Emit updated customer details
            customer = self.get_customer(customer_id)
            if customer:
                self.customer_selected.emit(customer)
    
    @Slot(int)
    def on_delete_customer_requested(self, customer_id: int):
        """Handle delete customer request from UI"""
        self.delete_customer(customer_id)
    
    @Slot(str)
    def on_search_customers_requested(self, query: str):
        """Handle search customers request from UI"""
        results = self.search_customers(query)
        self.customers_loaded.emit(results)
    
    @Slot()
    def on_load_all_customers_requested(self):
        """Handle load all customers request from UI"""
        self.get_all_customers()
    
    @Slot(int)
    def on_customer_selected(self, customer_id: int):
        """Handle customer selection from UI"""
        customer = self.get_customer(customer_id)
        if customer:
            self.customer_selected.emit(customer)
