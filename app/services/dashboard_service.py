"""
Dashboard Service for aggregating data for the main dashboard
and generating business insights for the Shop Management System.
"""

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, List, Optional
from collections import defaultdict

from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionType
from app.utils.database_manager import db_manager
from app.services.ledger_service import ledger_service


class DashboardService:
    """Service for dashboard data aggregation and business insights"""
    
    def __init__(self):
        self.ledger_service = ledger_service
    
    def get_dashboard_summary(self) -> Dict:
        """
        Get comprehensive dashboard summary.
        
        Returns:
            Dictionary with all dashboard data
        """
        try:
            summary = {
                'financial_summary': self.get_financial_summary(),
                'customer_summary': self.get_customer_summary(),
                'today_summary': self.get_today_summary(),
                'recent_activity': self.get_recent_activity(limit=10),
                'top_customers': self.get_top_customers(limit=5),
                'system_status': self.get_system_status()
            }
            
            return summary
            
        except Exception as e:
            return {
                'error': str(e),
                'financial_summary': {},
                'customer_summary': {},
                'today_summary': {},
                'recent_activity': [],
                'top_customers': [],
                'system_status': {}
            }
    
    def get_financial_summary(self) -> Dict:
        """
        Get financial summary including totals and trends.
        
        Returns:
            Dictionary with financial summary
        """
        with db_manager.get_session() as session:
            # Total outstanding udhaar
            total_outstanding = self.ledger_service.get_total_outstanding()
            
            # Total customers with balance
            customers_with_balance = session.query(Customer).filter(
                Customer.is_active == True
            ).all()
            
            positive_balance_count = 0
            negative_balance_count = 0
            zero_balance_count = 0
            
            for customer in customers_with_balance:
                balance = customer.current_balance
                if balance > 0:
                    positive_balance_count += 1
                elif balance < 0:
                    negative_balance_count += 1
                else:
                    zero_balance_count += 1
            
            # This week's summary
            today = date.today()
            start_of_week = today - timedelta(days=today.weekday())
            this_week_summary = self.ledger_service.get_date_range_summary(
                start_of_week, today
            )
            
            # Last week's summary
            start_of_last_week = start_of_week - timedelta(days=7)
            end_of_last_week = start_of_week - timedelta(days=1)
            last_week_summary = self.ledger_service.get_date_range_summary(
                start_of_last_week, end_of_last_week
            )
            
            # Calculate week-over-week change
            week_credit_change = Decimal('0')
            week_payment_change = Decimal('0')
            
            if last_week_summary['total_credits'] > 0:
                week_credit_change = (
                    (this_week_summary['total_credits'] - last_week_summary['total_credits']) /
                    last_week_summary['total_credits'] * 100
                )
            
            if last_week_summary['total_payments'] > 0:
                week_payment_change = (
                    (this_week_summary['total_payments'] - last_week_summary['total_payments']) /
                    last_week_summary['total_payments'] * 100
                )
            
            return {
                'total_outstanding': float(total_outstanding),
                'formatted_total_outstanding': self._format_currency(total_outstanding),
                'positive_balance_customers': positive_balance_count,
                'negative_balance_customers': negative_balance_count,
                'zero_balance_customers': zero_balance_count,
                'this_week_credits': float(this_week_summary['total_credits']),
                'this_week_payments': float(this_week_summary['total_payments']),
                'last_week_credits': float(last_week_summary['total_credits']),
                'last_week_payments': float(last_week_summary['total_payments']),
                'week_credit_change_percent': float(week_credit_change),
                'week_payment_change_percent': float(week_payment_change),
                'formatted_this_week_credits': self._format_currency(this_week_summary['total_credits']),
                'formatted_this_week_payments': self._format_currency(this_week_summary['total_payments']),
                'is_credit_trend_up': week_credit_change > 0,
                'is_payment_trend_up': week_payment_change > 0
            }
    
    def get_customer_summary(self) -> Dict:
        """
        Get customer statistics and summary.
        
        Returns:
            Dictionary with customer summary
        """
        with db_manager.get_session() as session:
            # Total customers
            total_customers = session.query(Customer).count()
            
            # Active customers
            active_customers = session.query(Customer).filter(
                Customer.is_active == True
            ).count()
            
            # New customers this month
            today = date.today()
            first_day_of_month = date(today.year, today.month, 1)
            
            new_customers_this_month = session.query(Customer).filter(
                Customer.created_at >= first_day_of_month
            ).count()
            
            # Customers with recent activity (last 30 days)
            thirty_days_ago = datetime.now() - timedelta(days=30)
            
            customers_with_recent_activity = session.query(Customer).join(
                Transaction
            ).filter(
                Transaction.transaction_date >= thirty_days_ago
            ).distinct().count()
            
            # Average balance per customer
            all_customers = session.query(Customer).all()
            total_balance = Decimal('0')
            customer_count_with_balance = 0
            
            for customer in all_customers:
                balance = customer.current_balance
                if balance != 0:
                    total_balance += balance
                    customer_count_with_balance += 1
            
            avg_balance = total_balance / customer_count_with_balance if customer_count_with_balance > 0 else Decimal('0')
            
            return {
                'total_customers': total_customers,
                'active_customers': active_customers,
                'inactive_customers': total_customers - active_customers,
                'new_customers_this_month': new_customers_this_month,
                'customers_with_recent_activity': customers_with_recent_activity,
                'average_balance': float(avg_balance),
                'formatted_average_balance': self._format_currency(avg_balance),
                'active_percentage': (active_customers / total_customers * 100) if total_customers > 0 else 0
            }
    
    def get_today_summary(self) -> Dict:
        """
        Get today's transaction summary.
        
        Returns:
            Dictionary with today's summary
        """
        today_summary = self.ledger_service.get_today_summary()
        
        # Add additional metrics
        with db_manager.get_session() as session:
            # Customers with transactions today
            today = date.today()
            tomorrow = today + timedelta(days=1)
            
            customers_today = session.query(Transaction.customer_id).filter(
                Transaction.transaction_date >= today,
                Transaction.transaction_date < tomorrow
            ).distinct().count()
            
            # Average transaction size today
            avg_credit_size = Decimal('0')
            avg_payment_size = Decimal('0')
            
            if today_summary['credit_count'] > 0:
                avg_credit_size = today_summary['total_credits'] / today_summary['credit_count']
            
            if today_summary['payment_count'] > 0:
                avg_payment_size = today_summary['total_payments'] / today_summary['payment_count']
            
            today_summary.update({
                'customers_with_transactions': customers_today,
                'avg_credit_size': float(avg_credit_size),
                'avg_payment_size': float(avg_payment_size),
                'formatted_avg_credit_size': self._format_currency(avg_credit_size),
                'formatted_avg_payment_size': self._format_currency(avg_payment_size)
            })
            
            return today_summary
    
    def get_recent_activity(self, limit: int = 10) -> List[Dict]:
        """
        Get recent activity across all customers.
        
        Args:
            limit: Number of activities to return
            
        Returns:
            List of recent activities
        """
        return self.ledger_service.get_recent_activity(limit)
    
    def get_top_customers(self, limit: int = 5, order_by: str = 'balance') -> List[Dict]:
        """
        Get top customers by balance or activity.
        
        Args:
            limit: Number of customers to return
            order_by: Order by 'balance' or 'activity'
            
        Returns:
            List of top customers
        """
        with db_manager.get_session() as session:
            customers = session.query(Customer).filter(
                Customer.is_active == True
            ).all()
            
            customer_data = []
            for customer in customers:
                balance = customer.current_balance
                transaction_count = len(customer.transactions)
                last_transaction = customer.last_transaction_date
                
                customer_data.append({
                    'id': customer.id,
                    'name': customer.name,
                    'phone': customer.phone,
                    'balance': float(balance),
                    'formatted_balance': customer.formatted_balance,
                    'transaction_count': transaction_count,
                    'last_transaction_date': last_transaction,
                    'days_since_last_transaction': (
                        (datetime.now() - last_transaction).days 
                        if last_transaction else None
                    )
                })
            
            # Sort based on order_by parameter
            if order_by == 'balance':
                customer_data.sort(key=lambda x: abs(x['balance']), reverse=True)
            elif order_by == 'activity':
                customer_data.sort(
                    key=lambda x: x['last_transaction_date'] or datetime.min,
                    reverse=True
                )
            else:  # Default to balance
                customer_data.sort(key=lambda x: abs(x['balance']), reverse=True)
            
            return customer_data[:limit]
    
    def get_system_status(self) -> Dict:
        """
        Get system health and status information.
        
        Returns:
            Dictionary with system status
        """
        from app.config import config
        
        try:
            # Database status
            db_info = db_manager.get_database_info()
            integrity_check = db_manager.check_integrity()
            
            # File system status
            db_size = db_info['size_bytes']
            backup_dir = config.backup_dir
            backup_dir_exists = backup_dir.exists()
            
            if backup_dir_exists:
                backup_files = list(backup_dir.glob("*.sqlite"))
                backup_count = len(backup_files)
                total_backup_size = sum(f.stat().st_size for f in backup_files)
            else:
                backup_count = 0
                total_backup_size = 0
            
            # Transaction statistics
            with db_manager.get_session() as session:
                total_transactions = session.query(Transaction).count()
                today = date.today()
                tomorrow = today + timedelta(days=1)
                
                today_transactions = session.query(Transaction).filter(
                    Transaction.transaction_date >= today,
                    Transaction.transaction_date < tomorrow
                ).count()
            
            return {
                'database': {
                    'path': db_info['path'],
                    'size_bytes': db_size,
                    'size_formatted': self._format_file_size(db_size),
                    'tables': len(db_info['tables']),
                    'integrity': integrity_check['integrity'],
                    'integrity_message': integrity_check['message']
                },
                'backup': {
                    'directory': str(backup_dir),
                    'exists': backup_dir_exists,
                    'count': backup_count,
                    'total_size_bytes': total_backup_size,
                    'total_size_formatted': self._format_file_size(total_backup_size),
                    'auto_backup_enabled': config.backup.auto_backup
                },
                'transactions': {
                    'total': total_transactions,
                    'today': today_transactions
                },
                'app': {
                    'name': config.app.app_name,
                    'version': config.app.app_version,
                    'currency_symbol': config.app.currency_symbol
                },
                'status': 'healthy' if integrity_check['success'] else 'warning',
                'last_updated': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                'last_updated': datetime.now().isoformat()
            }
    
    def get_monthly_summary(self, year: Optional[int] = None, month: Optional[int] = None) -> Dict:
        """
        Get monthly summary for a specific month.
        
        Args:
            year: Year (defaults to current year)
            month: Month (defaults to current month)
            
        Returns:
            Dictionary with monthly summary
        """
        now = datetime.now()
        target_year = year or now.year
        target_month = month or now.month
        
        # Calculate date range for the month
        if target_month == 12:
            next_year = target_year + 1
            next_month = 1
        else:
            next_year = target_year
            next_month = target_month + 1
        
        start_date = date(target_year, target_month, 1)
        end_date = date(next_year, next_month, 1) - timedelta(days=1)
        
        # Get summary for the month
        monthly_summary = self.ledger_service.get_date_range_summary(start_date, end_date)
        
        # Get daily breakdown
        daily_breakdown = self._get_daily_breakdown(start_date, end_date)
        
        # Get top customers for the month
        monthly_top_customers = self._get_monthly_top_customers(start_date, end_date)
        
        monthly_summary.update({
            'year': target_year,
            'month': target_month,
            'month_name': start_date.strftime('%B'),
            'start_date': start_date,
            'end_date': end_date,
            'daily_breakdown': daily_breakdown,
            'top_customers': monthly_top_customers
        })
        
        return monthly_summary
    
    def _get_daily_breakdown(self, start_date: date, end_date: date) -> List[Dict]:
        """Get daily transaction breakdown for a date range"""
        daily_data = []
        current_date = start_date
        
        while current_date <= end_date:
            next_date = current_date + timedelta(days=1)
            day_summary = self.ledger_service.get_date_range_summary(current_date, current_date)
            
            daily_data.append({
                'date': current_date,
                'credits': float(day_summary['total_credits']),
                'payments': float(day_summary['total_payments']),
                'credit_count': day_summary['credit_count'],
                'payment_count': day_summary['payment_count'],
                'formatted_credits': day_summary['formatted_total_credits'],
                'formatted_payments': day_summary['formatted_total_payments']
            })
            
            current_date = next_date
        
        return daily_data
    
    def _get_monthly_top_customers(self, start_date: date, end_date: date, limit: int = 5) -> List[Dict]:
        """Get top customers for a specific month"""
        with db_manager.get_session() as session:
            # Get transactions for the month
            monthly_transactions = session.query(Transaction).filter(
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date
            ).all()
            
            # Aggregate by customer
            customer_totals = defaultdict(lambda: {
                'credits': Decimal('0'),
                'payments': Decimal('0'),
                'count': 0
            })
            
            for transaction in monthly_transactions:
                customer_id = transaction.customer_id
                if transaction.type == TransactionType.CREDIT:
                    customer_totals[customer_id]['credits'] += transaction.amount
                elif transaction.type == TransactionType.PAYMENT:
                    customer_totals[customer_id]['payments'] += transaction.amount
                customer_totals[customer_id]['count'] += 1
            
            # Get customer details and calculate net
            top_customers = []
            for customer_id, totals in customer_totals.items():
                customer = session.get(Customer, customer_id)
                if customer:
                    net = totals['credits'] - totals['payments']
                    top_customers.append({
                        'id': customer_id,
                        'name': customer.name,
                        'credits': float(totals['credits']),
                        'payments': float(totals['payments']),
                        'net': float(net),
                        'transaction_count': totals['count'],
                        'formatted_net': self._format_currency(net)
                    })
            
            # Sort by net amount (descending)
            top_customers.sort(key=lambda x: x['net'], reverse=True)
            
            return top_customers[:limit]
    
    def _format_currency(self, amount: Decimal) -> str:
        """Format currency amount with symbol"""
        from app.config import config
        symbol = config.app.currency_symbol
        
        if amount >= 0:
            return f"{symbol}{amount:,.2f}"
        else:
            return f"-{symbol}{abs(amount):,.2f}"
    
    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"


# Global dashboard service instance
dashboard_service = DashboardService()
