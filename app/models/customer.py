"""
Customer model for shop customers.
Each customer has a ledger of transactions.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from app.config import config

if TYPE_CHECKING:
    from .transaction import Transaction


class Customer(Base):
    """Customer model representing a shop customer (individual or family)"""
    
    # Override automatic table name generation
    __tablename__ = "customers"
    
    # Fields
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction", 
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="Transaction.transaction_date.desc()"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        UniqueConstraint('name', name='uq_customer_name'),
        Index('idx_customer_phone', 'phone'),
        Index('idx_customer_active', 'is_active'),
    )
    
    def __init__(self, **kwargs):
        """Initialize customer with default values"""
        # Set default for is_active if not provided
        if 'is_active' not in kwargs:
            kwargs['is_active'] = True
        super().__init__(**kwargs)
    
    @property
    def current_balance(self) -> Decimal:
        """Calculate current balance from all transactions"""
        from decimal import Decimal
        balance = Decimal('0')
        
        if not hasattr(self, 'transactions') or not self.transactions:
            return Decimal('0')
            
        for transaction in self.transactions:
            if transaction.type == 'CREDIT':
                balance += transaction.amount
            elif transaction.type == 'PAYMENT':
                balance -= transaction.amount
            elif transaction.type == 'CORRECTION':
                # Corrections can be positive or negative
                balance += transaction.amount
        
        return balance
    
    @property
    def last_transaction_date(self) -> Optional[datetime]:
        """Get date of last transaction"""
        if not self.transactions:
            return None
        return max(t.transaction_date for t in self.transactions)
    
    @property
    def formatted_balance(self) -> str:
        """Get formatted balance with currency symbol"""
        balance = self.current_balance
        symbol = config.app.currency_symbol
        
        if balance >= 0:
            return f"{symbol}{balance:,.2f}"
        else:
            return f"-{symbol}{abs(balance):,.2f}"
    
    def summary(self) -> dict:
        """Get customer summary"""
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'balance': float(self.current_balance),
            'formatted_balance': self.formatted_balance,
            'transaction_count': len(self.transactions) if self.transactions else 0,
            'last_transaction': self.last_transaction_date.isoformat() if self.last_transaction_date else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __str__(self) -> str:
        """String representation"""
        return f"{self.name} (ID: {self.id})"
    
    def __repr__(self) -> str:
        """Detailed representation"""
        return f"<Customer(id={self.id}, name='{self.name}', balance={self.formatted_balance})>"
