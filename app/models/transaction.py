"""
Transaction model for all financial transactions.
Transactions are IMMUTABLE - can only be corrected, not edited.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    String, Text, Numeric, DateTime, ForeignKey, 
    CheckConstraint, Index, Boolean
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from .base import Base
from app.config import config

if TYPE_CHECKING:
    from .customer import Customer


class TransactionType:
    """Transaction type constants"""
    CREDIT = "CREDIT"      # Customer buys on credit
    PAYMENT = "PAYMENT"    # Customer makes payment
    CORRECTION = "CORRECTION"  # Correction for error


class Transaction(Base):
    """Transaction model for all financial transactions (IMMUTABLE)"""
    
    __tablename__ = "transactions"
    
    # Foreign key to customer
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Transaction type
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )
    
    # Amount (always positive, sign determined by type)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),  # 10 digits total, 2 decimal places
        nullable=False
    )
    
    # Description (itemized details for credit)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Reference number/document ID (invoice #, cheque #, transaction ID, etc.)
    reference: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True
    )
    
    # Payment method (only relevant for PAYMENT transactions)
    payment_method: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        default="cash"
    )
    
    # Actual transaction date/time (can be backdated)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        index=True
    )
    
    # For correction transactions
    is_correction: Mapped[bool] = mapped_column(default=False, nullable=False)
    original_transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id"),
        nullable=True
    )
    
    # Relationships
    customer: Mapped["Customer"] = relationship(
        "Customer", 
        back_populates="transactions"
    )
    
    # Self-referential relationship for corrections
    original_transaction: Mapped[Optional["Transaction"]] = relationship(
        "Transaction",
        remote_side="Transaction.id",
        backref="corrections",
        foreign_keys=[original_transaction_id]
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
        CheckConstraint(
            "type IN ('CREDIT', 'PAYMENT', 'CORRECTION')", 
            name="ck_transaction_type"
        ),
        CheckConstraint(
            "(type = 'PAYMENT' AND payment_method IS NOT NULL) OR (type != 'PAYMENT')",
            name="ck_payment_method_required_for_payments"
        ),
        Index('idx_transaction_customer_date', 'customer_id', 'transaction_date'),
        Index('idx_transaction_date_type', 'transaction_date', 'type'),
        Index('idx_transaction_reference', 'reference'),
    )
    
    @property
    def signed_amount(self) -> Decimal:
        """Get amount with proper sign based on transaction type"""
        if self.type == TransactionType.PAYMENT:
            return -self.amount
        return self.amount
    
    @property
    def formatted_amount(self) -> str:
        """Get formatted amount with currency symbol"""
        symbol = config.app.currency_symbol
        
        if self.type == TransactionType.PAYMENT:
            return f"-{symbol}{self.amount:,.2f}"
        else:
            return f"{symbol}{self.amount:,.2f}"
    
    @property
    def is_editable(self) -> bool:
        """Transactions are immutable, but can be corrected"""
        return False
    
    def create_correction(self, new_amount: Decimal, reason: str) -> "Transaction":
        """Create a correction transaction for this transaction"""
        if self.is_correction:
            raise ValueError("Cannot correct a correction transaction")
        
        # Calculate the difference
        amount_difference = new_amount - self.amount
        
        correction = Transaction(
            customer_id=self.customer_id,
            type=TransactionType.CORRECTION,
            amount=abs(amount_difference),  # Store as positive
            description=f"Correction: {reason}. Original: {self.description} | Difference: {amount_difference}",
            reference=self.reference,  # Preserve original reference in correction
            payment_method=self.payment_method if self.type == TransactionType.PAYMENT else None,
            transaction_date=datetime.utcnow(),
            is_correction=True,
            original_transaction_id=self.id
        )
        
        return correction
    
    def summary(self) -> dict:
        """Get transaction summary"""
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else 'Unknown',
            'type': self.type,
            'amount': float(self.amount),
            'signed_amount': float(self.signed_amount),
            'formatted_amount': self.formatted_amount,
            'description': self.description,
            'reference': self.reference,
            'payment_method': self.payment_method,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_correction': self.is_correction,
            'original_transaction_id': self.original_transaction_id
        }
    
    def __str__(self) -> str:
        """String representation"""
        description_preview = self.description[:50] + '...' if len(self.description) > 50 else self.description
        ref_info = f" [Ref: {self.reference}]" if self.reference else ""
        method_info = f" ({self.payment_method})" if self.payment_method and self.type == TransactionType.PAYMENT else ""
        return f"{self.type}{method_info} - {self.formatted_amount}{ref_info} - {description_preview}"
    
    def __repr__(self) -> str:
        """Detailed representation"""
        return f"<Transaction(id={self.id}, type='{self.type}', amount={self.amount}, customer_id={self.customer_id})>"
