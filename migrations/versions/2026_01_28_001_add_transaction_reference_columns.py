"""Add reference and payment_method columns to transactions table

Revision ID: 20260128_001
Revises: base
Create Date: 2026-01-28
"""

from alembic import op
import sqlalchemy as sa

revision = '20260128_001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add reference column (for invoice/cheque numbers)
    op.add_column(
        'transactions',
        sa.Column('reference', sa.String(length=100), nullable=True)
    )
    
    # Add payment_method column (for payment tracking)
    op.add_column(
        'transactions',
        sa.Column('payment_method', sa.String(length=50), nullable=True, server_default='cash')
    )
    
    # Create index for efficient reference lookups
    op.create_index(
        'idx_transaction_reference',
        'transactions',
        ['reference']
    )
    
    # Create index for payment method filtering
    op.create_index(
        'idx_transaction_payment_method',
        'transactions',
        ['payment_method']
    )

def downgrade():
    op.drop_index('idx_transaction_payment_method', table_name='transactions')
    op.drop_index('idx_transaction_reference', table_name='transactions')
    op.drop_column('transactions', 'payment_method')
    op.drop_column('transactions', 'reference')