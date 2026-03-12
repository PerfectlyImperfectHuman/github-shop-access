"""
Ledger Service for handling balance calculations, transaction history,
and financial operations for the Shop Management System.
"""

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionType
from app.utils.database_manager import db_manager


class LedgerService:
    """Service for ledger operations and balance calculations"""
    
    def __init__(self):
        pass
    
    def get_customer_balance(self, customer_id: int) -> Decimal:
        """
        Get current balance for a customer.
        
        Args:
            customer_id: ID of the customer
            
        Returns:
            Current balance as Decimal
        """
        with db_manager.get_session() as session:
            customer = session.get(Customer, customer_id)
            if not customer:
                raise ValueError(f"Customer with ID {customer_id} not found")
            
            return customer.current_balance
    
    def get_customer_ledger(
        self, 
        customer_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """
        Get complete ledger for a customer with running balance.
        
        Args:
            customer_id: ID of the customer
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of ledger entries with running balance
        """
        with db_manager.get_session() as session:
            customer = session.get(Customer, customer_id)
            if not customer:
                raise ValueError(f"Customer with ID {customer_id} not found")
            
            # Get transactions with filters
            query = session.query(Transaction).filter(
                Transaction.customer_id == customer_id
            )
            
            if start_date:
                query = query.filter(Transaction.transaction_date >= start_date)
            if end_date:
                query = query.filter(Transaction.transaction_date <= end_date)
            
            transactions = query.order_by(
                Transaction.transaction_date,
                Transaction.created_at
            ).all()
            
            # Calculate running balance
            ledger_entries = []
            running_balance = Decimal('0')
            
            for transaction in transactions:
                if transaction.type == TransactionType.CREDIT:
                    running_balance += transaction.amount
                elif transaction.type == TransactionType.PAYMENT:
                    running_balance -= transaction.amount
                elif transaction.type == TransactionType.CORRECTION:
                    running_balance += transaction.amount
                
                ledger_entries.append({
                    'id': transaction.id,
                    'type': transaction.type,
                    'amount': transaction.amount,
                    'signed_amount': transaction.signed_amount,
                    'formatted_amount': transaction.formatted_amount,
                    'description': transaction.description,
                    'reference': transaction.reference,
                    'payment_method': transaction.payment_method,
                    'transaction_date': transaction.transaction_date,
                    'created_at': transaction.created_at,
                    'is_correction': transaction.is_correction,
                    'original_transaction_id': transaction.original_transaction_id,
                    'running_balance': running_balance,
                    'formatted_running_balance': self._format_currency(running_balance)
                })
            
            return ledger_entries
    
    def get_customer_summary(self, customer_id: int) -> Dict:
        """
        Get comprehensive summary for a customer.
        
        Args:
            customer_id: ID of the customer
            
        Returns:
            Dictionary with customer summary
        """
        with db_manager.get_session() as session:
            customer = session.get(Customer, customer_id)
            if not customer:
                raise ValueError(f"Customer with ID {customer_id} not found")
            
            # Get current balance
            balance = customer.current_balance
            
            # Get transaction counts by type
            credit_count = session.query(Transaction).filter(
                Transaction.customer_id == customer_id,
                Transaction.type == TransactionType.CREDIT
            ).count()
            
            payment_count = session.query(Transaction).filter(
                Transaction.customer_id == customer_id,
                Transaction.type == TransactionType.PAYMENT
            ).count()
            
            # Get last transaction date
            last_transaction = session.query(Transaction).filter(
                Transaction.customer_id == customer_id
            ).order_by(Transaction.transaction_date.desc()).first()
            
            # Get total credit amount using SQLAlchemy's func.sum
            total_credit_result = session.query(
                func.sum(Transaction.amount)
            ).filter(
                Transaction.customer_id == customer_id,
                Transaction.type == TransactionType.CREDIT
            ).scalar()
            
            total_credit = Decimal(str(total_credit_result)) if total_credit_result else Decimal('0')
            
            # Get total payment amount
            total_payment_result = session.query(
                func.sum(Transaction.amount)
            ).filter(
                Transaction.customer_id == customer_id,
                Transaction.type == TransactionType.PAYMENT
            ).scalar()
            
            total_payment = Decimal(str(total_payment_result)) if total_payment_result else Decimal('0')
            
            return {
                'customer_id': customer_id,
                'name': customer.name,
                'phone': customer.phone,
                'current_balance': float(balance),
                'formatted_balance': customer.formatted_balance,
                'total_credit': float(total_credit),
                'total_payment': float(total_payment),
                'credit_count': credit_count,
                'payment_count': payment_count,
                'last_transaction_date': last_transaction.transaction_date if last_transaction else None,
                'is_active': customer.is_active,
                'notes': customer.notes,
                'customer_since': customer.created_at
            }
    
    def add_credit_transaction(
        self,
        customer_id: int,
        amount: Decimal,
        description: str,
        reference: Optional[str] = None,
        transaction_date: Optional[datetime] = None
    ) -> Transaction:
        """
        Add a credit (udhaar) transaction for a customer.
        
        Args:
            customer_id: ID of the customer
            amount: Credit amount
            description: Itemized description
            reference: Optional reference number/document ID (invoice #, etc.)
            transaction_date: Optional transaction date (defaults to now)
            
        Returns:
            Created transaction object
        """
        with db_manager.get_session() as session:
            # Verify customer exists
            customer = session.get(Customer, customer_id)
            if not customer:
                raise ValueError(f"Customer with ID {customer_id} not found")
            
            # Create transaction with reference field
            transaction = Transaction(
                customer_id=customer_id,
                type=TransactionType.CREDIT,
                amount=amount,
                description=description,
                reference=reference,
                payment_method=None,  # Not applicable for credit
                transaction_date=transaction_date or datetime.now()
            )
            
            session.add(transaction)
            session.flush()  # Get the ID without committing
            
            # Update customer's updated_at timestamp
            customer.updated_at = datetime.now()
            
            return transaction
    
    def add_payment_transaction(
        self,
        customer_id: int,
        amount: Decimal,
        description: str = "Payment",
        reference: Optional[str] = None,
        payment_method: str = "cash",
        transaction_date: Optional[datetime] = None
    ) -> Transaction:
        """
        Add a payment transaction for a customer.
        
        Args:
            customer_id: ID of the customer
            amount: Payment amount
            description: Payment description
            reference: Optional reference number (cheque #, transaction ID, etc.)
            payment_method: Payment method (cash, bank_transfer, cheque, etc.)
            transaction_date: Optional transaction date (defaults to now)
            
        Returns:
            Created transaction object
        """
        with db_manager.get_session() as session:
            # Verify customer exists
            customer = session.get(Customer, customer_id)
            if not customer:
                raise ValueError(f"Customer with ID {customer_id} not found")
            
            # Create transaction with reference and payment_method fields
            transaction = Transaction(
                customer_id=customer_id,
                type=TransactionType.PAYMENT,
                amount=amount,
                description=description,
                reference=reference,
                payment_method=payment_method,
                transaction_date=transaction_date or datetime.now()
            )
            
            session.add(transaction)
            session.flush()
            
            # Update customer's updated_at timestamp
            customer.updated_at = datetime.now()
            
            return transaction
    
    def add_correction_transaction(
        self,
        original_transaction_id: int,
        correction_amount: Decimal,
        reason: str
    ) -> Transaction:
        """
        Add a correction transaction for an existing transaction.
        
        Args:
            original_transaction_id: ID of the transaction to correct
            correction_amount: Delta amount to adjust the original transaction 
                               (positive = increase original amount, negative = decrease)
            reason: Reason for correction
            
        Returns:
            Created correction transaction
        """
        with db_manager.get_session() as session:
            # Get original transaction
            original = session.get(Transaction, original_transaction_id)
            if not original:
                raise ValueError(f"Transaction with ID {original_transaction_id} not found")
            
            if original.is_correction:
                raise ValueError("Cannot correct a correction transaction")
            
            # Create correction transaction (Transaction.create_correction handles delta correctly)
            correction = original.create_correction(correction_amount, reason)
            
            session.add(correction)
            session.flush()
            
            # Update customer's updated_at timestamp
            customer = session.get(Customer, original.customer_id)
            if customer:
                customer.updated_at = datetime.now()
            
            return correction
    
    def get_total_outstanding(self) -> Decimal:
        """
        Calculate total outstanding udhaar across all customers.
        
        Returns:
            Total outstanding amount as Decimal
        """
        with db_manager.get_session() as session:
            # Get all customers
            customers = session.query(Customer).all()
            
            total = Decimal('0')
            for customer in customers:
                total += customer.current_balance
            
            return total
    
    def get_today_summary(self) -> Dict:
        """
        Get summary of today's transactions.
        
        Returns:
            Dictionary with today's summary
        """
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        with db_manager.get_session() as session:
            # Today's credits
            today_credits = session.query(Transaction).filter(
                Transaction.type == TransactionType.CREDIT,
                Transaction.transaction_date >= today,
                Transaction.transaction_date < tomorrow
            ).all()
            
            # Today's payments
            today_payments = session.query(Transaction).filter(
                Transaction.type == TransactionType.PAYMENT,
                Transaction.transaction_date >= today,
                Transaction.transaction_date < tomorrow
            ).all()
            
            total_credits = sum(t.amount for t in today_credits)
            total_payments = sum(t.amount for t in today_payments)
            
            return {
                'date': today,
                'total_credits': total_credits,
                'total_payments': total_payments,
                'credit_count': len(today_credits),
                'payment_count': len(today_payments),
                'net_change': total_credits - total_payments,
                'formatted_total_credits': self._format_currency(total_credits),
                'formatted_total_payments': self._format_currency(total_payments),
                'formatted_net_change': self._format_currency(total_credits - total_payments)
            }
    
    def get_date_range_summary(
        self,
        start_date: date,
        end_date: date
    ) -> Dict:
        """
        Get summary for a date range.
        
        Args:
            start_date: Start date
            end_date: End date (inclusive)
            
        Returns:
            Dictionary with date range summary
        """
        end_date_next = end_date + timedelta(days=1)
        
        with db_manager.get_session() as session:
            # Credits in date range
            credits = session.query(Transaction).filter(
                Transaction.type == TransactionType.CREDIT,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date < end_date_next
            ).all()
            
            # Payments in date range
            payments = session.query(Transaction).filter(
                Transaction.type == TransactionType.PAYMENT,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date < end_date_next
            ).all()
            
            total_credits = sum(t.amount for t in credits)
            total_payments = sum(t.amount for t in payments)
            
            return {
                'start_date': start_date,
                'end_date': end_date,
                'total_credits': total_credits,
                'total_payments': total_payments,
                'credit_count': len(credits),
                'payment_count': len(payments),
                'net_change': total_credits - total_payments,
                'formatted_total_credits': self._format_currency(total_credits),
                'formatted_total_payments': self._format_currency(total_payments),
                'formatted_net_change': self._format_currency(total_credits - total_payments)
            }
    
    def get_recent_activity(self, limit: int = 10) -> List[Dict]:
        """
        Get recent transactions across all customers.
        
        Args:
            limit: Number of recent transactions to return
            
        Returns:
            List of recent transactions
        """
        with db_manager.get_session() as session:
            recent_transactions = session.query(Transaction).join(
                Customer
            ).order_by(
                Transaction.transaction_date.desc()
            ).limit(limit).all()
            
            activity = []
            for transaction in recent_transactions:
                activity.append({
                    'id': transaction.id,
                    'customer_id': transaction.customer_id,
                    'customer_name': transaction.customer.name,
                    'type': transaction.type,
                    'amount': transaction.amount,
                    'formatted_amount': transaction.formatted_amount,
                    'description': transaction.description[:50] + '...' if len(transaction.description) > 50 else transaction.description,
                    'reference': transaction.reference,
                    'payment_method': transaction.payment_method,
                    'transaction_date': transaction.transaction_date,
                    'is_correction': transaction.is_correction
                })
            
            return activity
    
    def search_customers(
        self,
        search_term: str,
        active_only: bool = True
    ) -> List[Dict]:
        """
        Search customers by name or phone.
        
        Args:
            search_term: Search term (partial match)
            active_only: Only return active customers
            
        Returns:
            List of matching customers with balances
        """
        with db_manager.get_session() as session:
            query = session.query(Customer)
            
            if active_only:
                query = query.filter(Customer.is_active == True)
            
            if search_term:
                search_pattern = f"%{search_term}%"
                query = query.filter(
                    (Customer.name.ilike(search_pattern)) |
                    (Customer.phone.ilike(search_pattern))
                )
            
            customers = query.order_by(Customer.name).all()
            
            results = []
            for customer in customers:
                results.append({
                    'id': customer.id,
                    'name': customer.name,
                    'phone': customer.phone,
                    'balance': float(customer.current_balance),
                    'formatted_balance': customer.formatted_balance,
                    'transaction_count': len(customer.transactions),
                    'last_transaction_date': customer.last_transaction_date,
                    'is_active': customer.is_active
                })
            
            return results
    
    def _format_currency(self, amount: Decimal) -> str:
        """
        Format currency amount with symbol.
        
        Args:
            amount: Amount to format
            
        Returns:
            Formatted currency string
        """
        from app.config import config
        symbol = config.app.currency_symbol
        
        if amount >= 0:
            return f"{symbol}{amount:,.2f}"
        else:
            return f"-{symbol}{abs(amount):,.2f}"


# Global ledger service instance
ledger_service = LedgerService()
