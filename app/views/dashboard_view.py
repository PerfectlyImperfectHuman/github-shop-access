"""
Dashboard View
Main overview with summary statistics, recent transactions, and quick actions.
"""

import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QPushButton,
    QFrame, QTableWidget, QTableWidgetItem, QHeaderView, QSizePolicy,
    QGroupBox, QScrollArea, QAbstractItemView, QSpacerItem, QProgressBar, QMessageBox, QDialog
)
from PySide6.QtCore import Qt, Signal, Slot, QTimer, QDate
from PySide6.QtGui import QFont, QColor, QBrush

from app.controllers.main_controller import MainController
from app.controllers.customer_controller import CustomerController
from app.controllers.transaction_controller import TransactionController

logger = logging.getLogger(__name__)


class DashboardView(QWidget):
    """Dashboard view showing summary and quick actions"""
    
    # Signals
    view_customer_requested = Signal(int)  # customer_id
    view_transaction_requested = Signal(int)  # transaction_id
    refresh_requested = Signal()
    
    def __init__(self, main_controller: MainController, 
                 customer_controller: CustomerController,
                 transaction_controller: TransactionController):
        """Initialize dashboard view with controllers"""
        super().__init__()
        
        self.main_controller = main_controller
        self.customer_controller = customer_controller
        self.transaction_controller = transaction_controller
        self.main_window = None  # Will be set by main_window.py
        
        self._setup_ui()
        self._connect_signals()
        
        # Set up auto-refresh timer
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_data)
        self.refresh_timer.start(30000)  # Refresh every 30 seconds
        
        logger.info("DashboardView initialized")
    
    def _setup_ui(self) -> None:
        """Setup the dashboard UI"""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(15, 15, 15, 15)
        main_layout.setSpacing(15)
        
        # Header with title and refresh button
        self._create_header(main_layout)
        
        # Create scroll area for content
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        
        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(5, 5, 5, 5)
        content_layout.setSpacing(15)
        
        # Summary cards
        self._create_summary_cards(content_layout)
        
        # Recent transactions and top customers
        self._create_data_tables(content_layout)
        
        # Quick actions
        self._create_quick_actions(content_layout)
        
        # Daily summary
        self._create_daily_summary(content_layout)
        
        scroll_area.setWidget(content_widget)
        main_layout.addWidget(scroll_area)
    
    def _create_header(self, parent_layout: QVBoxLayout) -> None:
        """Create dashboard header with title and refresh button"""
        header_layout = QHBoxLayout()
        
        # Title
        title_label = QLabel("Dashboard")
        title_font = QFont()
        title_font.setPointSize(20)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Last updated label
        self.last_updated_label = QLabel("Last updated: --")
        self.last_updated_label.setStyleSheet("color: #7f8c8d;")
        header_layout.addWidget(self.last_updated_label)
        
        # Refresh button
        refresh_btn = QPushButton("Refresh")
        refresh_btn.setObjectName("refreshButton")
        refresh_btn.clicked.connect(self.refresh_data)
        header_layout.addWidget(refresh_btn)
        
        parent_layout.addLayout(header_layout)
    
    def _create_summary_cards(self, parent_layout: QVBoxLayout) -> None:
        """Create summary cards with key metrics"""
        cards_container = QWidget()
        cards_layout = QGridLayout(cards_container)
        cards_layout.setContentsMargins(0, 0, 0, 0)
        cards_layout.setSpacing(15)
        
        # Define cards with titles, values, and colors
        self.summary_cards = {
            'total_customers': {
                'title': 'Total Customers',
                'value': '0',
                'icon_color': '#3498db',
                'background': '#ebf5fb',
                'widgets': {}
            },
            'total_balance': {
                'title': 'Total Balance',
                'value': 'Rs. 0.00',
                'icon_color': '#2ecc71',
                'background': '#eafaf1',
                'widgets': {}
            },
            'total_credit': {
                'title': 'Total Credit',
                'value': 'Rs. 0.00',
                'icon_color': '#e74c3c',
                'background': '#fdedec',
                'widgets': {}
            },
            'total_payment': {
                'title': 'Total Payment',
                'value': 'Rs. 0.00',
                'icon_color': '#9b59b6',
                'background': '#f4ecf7',
                'widgets': {}
            }
        }
        
        # Create cards
        for i, (card_id, card_info) in enumerate(self.summary_cards.items()):
            card = self._create_summary_card(card_info)
            cards_layout.addWidget(card, i // 2, i % 2)
            card_info['widgets']['card'] = card
        
        parent_layout.addWidget(cards_container)
    
    def _create_summary_card(self, card_info: Dict[str, Any]) -> QFrame:
        """Create a single summary card widget"""
        card = QFrame()
        card.setObjectName("summaryCard")
        card.setFrameShape(QFrame.StyledPanel)
        card.setFrameShadow(QFrame.Raised)
        card.setStyleSheet(f"""
            #summaryCard {{
                background-color: {card_info['background']};
                border-radius: 8px;
                border-left: 5px solid {card_info['icon_color']};
            }}
        """)
        
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(15, 15, 15, 15)
        
        # Title
        title_label = QLabel(card_info['title'])
        title_label.setStyleSheet(f"""
            QLabel {{
                color: #2c3e50;
                font-size: 14px;
                font-weight: bold;
            }}
        """)
        card_layout.addWidget(title_label)
        
        # Value
        value_label = QLabel(card_info['value'])
        value_label.setObjectName("cardValue")
        value_font = QFont()
        value_font.setPointSize(24)
        value_font.setBold(True)
        value_label.setFont(value_font)
        value_label.setStyleSheet(f"""
            QLabel#cardValue {{
                color: {card_info['icon_color']};
            }}
        """)
        card_layout.addWidget(value_label)
        
        # Store the value label for updates
        card_info['widgets']['value_label'] = value_label
        
        return card
    
    def _create_data_tables(self, parent_layout: QVBoxLayout) -> None:
        """Create recent transactions and top customers tables"""
        tables_container = QWidget()
        tables_layout = QHBoxLayout(tables_container)
        tables_layout.setSpacing(15)
        
        # Recent transactions table
        recent_transactions_group = QGroupBox("Recent Transactions")
        recent_transactions_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
        """)
        
        recent_layout = QVBoxLayout(recent_transactions_group)
        
        self.recent_transactions_table = QTableWidget()
        self.recent_transactions_table.setColumnCount(5)
        self.recent_transactions_table.setHorizontalHeaderLabels([
            "Date", "Customer", "Type", "Amount", "Balance"
        ])
        self.recent_transactions_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.recent_transactions_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.recent_transactions_table.setAlternatingRowColors(True)
        self.recent_transactions_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.recent_transactions_table.verticalHeader().setVisible(False)
        self.recent_transactions_table.setMinimumHeight(200)
        
        # Connect double-click signal
        self.recent_transactions_table.doubleClicked.connect(
            self._on_transaction_double_clicked
        )
        
        recent_layout.addWidget(self.recent_transactions_table)
        
        # View all transactions button
        view_all_btn = QPushButton("View All Transactions")
        view_all_btn.clicked.connect(lambda: self._switch_to_view("Transaction History"))
        recent_layout.addWidget(view_all_btn)
        
        # Top customers table
        top_customers_group = QGroupBox("Top Customers by Balance")
        top_customers_group.setStyleSheet(recent_transactions_group.styleSheet())
        
        top_customers_layout = QVBoxLayout(top_customers_group)
        
        self.top_customers_table = QTableWidget()
        self.top_customers_table.setColumnCount(4)
        self.top_customers_table.setHorizontalHeaderLabels([
            "Customer", "Phone", "Balance", "Last Transaction"
        ])
        self.top_customers_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.top_customers_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.top_customers_table.setAlternatingRowColors(True)
        self.top_customers_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.top_customers_table.verticalHeader().setVisible(False)
        self.top_customers_table.setMinimumHeight(200)
        
        # Connect double-click signal
        self.top_customers_table.doubleClicked.connect(
            self._on_customer_double_clicked
        )
        
        top_customers_layout.addWidget(self.top_customers_table)
        
        # View all customers button
        view_all_customers_btn = QPushButton("View All Customers")
        view_all_customers_btn.clicked.connect(lambda: self._switch_to_view("Customers"))
        top_customers_layout.addWidget(view_all_customers_btn)
        
        # Add both groups to layout
        tables_layout.addWidget(recent_transactions_group, 1)
        tables_layout.addWidget(top_customers_group, 1)
        
        parent_layout.addWidget(tables_container)
    
    def _create_quick_actions(self, parent_layout: QVBoxLayout) -> None:
        """Create quick action buttons"""
        actions_group = QGroupBox("Quick Actions")
        actions_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
        """)
        
        actions_layout = QHBoxLayout(actions_group)
        
        # Quick action buttons
        actions = [
            ("Add Credit", "Add a new credit transaction", "#3498db", "credit"),
            ("Receive Payment", "Record a payment", "#2ecc71", "payment"),
            ("Add Customer", "Add a new customer", "#e74c3c", "customer"),
            ("Generate Report", "Generate monthly report", "#9b59b6", "report")
        ]
        
        for text, tooltip, color, action_type in actions:
            btn = QPushButton(text)
            btn.setToolTip(tooltip)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {color};
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 13px;
                }}
                QPushButton:hover {{
                    background-color: {self._darken_color(color)};
                }}
            """)
            
            # Connect signals based on action type
            if action_type == "credit":
                btn.clicked.connect(lambda: self._switch_to_view("New Transaction"))
            elif action_type == "payment":
                btn.clicked.connect(lambda: self._switch_to_view("New Transaction"))
            elif action_type == "customer":
                btn.clicked.connect(self._add_new_customer)  # FIXED: Open customer form directly
            elif action_type == "report":
                btn.clicked.connect(lambda: self._switch_to_view("Reports"))
            
            actions_layout.addWidget(btn)
        
        parent_layout.addWidget(actions_group)
    
    def _create_daily_summary(self, parent_layout: QVBoxLayout) -> None:
        """Create daily transaction summary"""
        daily_group = QGroupBox("Today's Summary")
        daily_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
        """)
        
        daily_layout = QVBoxLayout(daily_group)
        
        # Date display
        date_label = QLabel(f"Date: {QDate.currentDate().toString('dd/MM/yyyy')}")
        date_label.setStyleSheet("font-size: 13px; color: #7f8c8d;")
        daily_layout.addWidget(date_label)
        
        # Summary stats layout
        stats_layout = QHBoxLayout()
        
        self.daily_stats = {
            'total_credit': {'label': 'Total Credit Today:', 'value': 'Rs. 0.00', 'color': '#e74c3c'},
            'total_payment': {'label': 'Total Payment Today:', 'value': 'Rs. 0.00', 'color': '#2ecc71'},
            'transaction_count': {'label': 'Transactions Today:', 'value': '0', 'color': '#3498db'}
        }
        
        for stat_id, stat_info in self.daily_stats.items():
            stat_widget = self._create_stat_widget(stat_info['label'], stat_info['value'], stat_info['color'])
            self.daily_stats[stat_id]['widget'] = stat_widget
            stats_layout.addWidget(stat_widget)
        
        stats_layout.addStretch()
        daily_layout.addLayout(stats_layout)
        
        parent_layout.addWidget(daily_group)
    
    def _create_stat_widget(self, label: str, value: str, color: str) -> QWidget:
        """Create a statistic display widget"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Label
        label_widget = QLabel(label)
        label_widget.setStyleSheet(f"color: #7f8c8d; font-size: 12px;")
        layout.addWidget(label_widget)
        
        # Value
        value_widget = QLabel(value)
        value_widget.setStyleSheet(f"color: {color}; font-size: 18px; font-weight: bold;")
        layout.addWidget(value_widget)
        
        return widget
    
    def _darken_color(self, hex_color: str, factor: float = 0.8) -> str:
        """Darken a hex color by a factor"""
        hex_color = hex_color.lstrip('#')
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        r, g, b = int(r * factor), int(g * factor), int(b * factor)
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def _connect_signals(self) -> None:
        """Connect signals and slots"""
        self.refresh_requested.connect(self.refresh_data)
    
    def _switch_to_view(self, view_name: str) -> None:
        """Switch to another view"""
        if self.main_window and hasattr(self.main_window, 'switch_to_tab'):
            self.main_window.switch_to_tab(view_name)
        else:
            # Fallback: emit signal if main_window is not available
            logger.warning(f"Main window not available for switching to {view_name}")
    
    def _add_new_customer(self) -> None:
        """Open the customer form dialog directly"""
        try:
            from app.views.customer_views import CustomerFormDialog
            dialog = CustomerFormDialog(
                parent=self,
                customer_controller=self.customer_controller,
                main_controller=self.main_controller
            )
            if dialog.exec() == QDialog.Accepted:
                # Refresh dashboard after adding customer
                self.refresh_data()
                # Also notify main window to refresh other views
                if self.main_window:
                    self.main_window.refresh_all()
        except Exception as e:
            logger.error(f"Error opening customer form: {e}")
            QMessageBox.critical(self, "Error", f"Failed to open customer form: {str(e)}")
    
    def _on_transaction_double_clicked(self, index) -> None:
        """Handle double-click on transaction row"""
        row = index.row()
        if row < self.recent_transactions_table.rowCount():
            item = self.recent_transactions_table.item(row, 0)
            if item:
                transaction_id = item.data(Qt.UserRole)
                if transaction_id:
                    self.view_transaction_requested.emit(transaction_id)
    
    def _on_customer_double_clicked(self, index) -> None:
        """Handle double-click on customer row"""
        row = index.row()
        if row < self.top_customers_table.rowCount():
            item = self.top_customers_table.item(row, 0)
            if item:
                customer_id = item.data(Qt.UserRole)
                if customer_id:
                    self.view_customer_requested.emit(customer_id)
    
    @Slot()
    def refresh_data(self) -> None:
        """Refresh all dashboard data"""
        try:
            logger.debug("Refreshing dashboard data")
            
            # Get dashboard summary from main controller
            summary = self.main_controller.get_application_summary()
            
            # Update summary cards
            self._update_summary_cards(summary)
            
            # Update recent transactions table - use summary data
            recent_transactions = self._extract_recent_transactions(summary)
            self._update_recent_transactions(recent_transactions)
            
            # Update top customers table - use summary data
            top_customers = self._extract_top_customers(summary)
            self._update_top_customers(top_customers)
            
            # Update daily summary
            self._update_daily_summary()
            
            # Update last updated timestamp
            current_time = datetime.now().strftime("%H:%M:%S")
            self.last_updated_label.setText(f"Last updated: {current_time}")
            
        except Exception as e:
            logger.error(f"Error refreshing dashboard: {e}")
    
    def _extract_recent_transactions(self, summary: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract recent transactions from the nested summary structure"""
        try:
            # Try the new nested structure first
            if 'recent_activity' in summary:
                return summary['recent_activity']
            elif 'recent_transactions' in summary:
                return summary['recent_transactions']
            else:
                # Fallback to empty list
                return []
        except Exception as e:
            logger.error(f"Error extracting recent transactions: {e}")
            return []
    
    def _extract_top_customers(self, summary: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract top customers from the nested summary structure"""
        try:
            # Try the new nested structure first
            if 'top_customers' in summary:
                return summary['top_customers']
            elif 'customer_summary' in summary and 'top_customers' in summary['customer_summary']:
                return summary['customer_summary']['top_customers']
            else:
                # Fallback to empty list
                return []
        except Exception as e:
            logger.error(f"Error extracting top customers: {e}")
            return []
    
    def _update_summary_cards(self, summary: Dict[str, Any]) -> None:
        """Update summary cards with data"""
        try:
            # Extract total customers
            total_customers = 0
            if 'customer_summary' in summary and 'total_customers' in summary['customer_summary']:
                total_customers = summary['customer_summary']['total_customers']
            elif 'total_customers' in summary:
                total_customers = summary['total_customers']
            
            self.summary_cards['total_customers']['widgets']['value_label'].setText(
                str(total_customers)
            )
            
            # Extract total balance
            total_balance = 0.0
            if 'financial_summary' in summary and 'total_outstanding' in summary['financial_summary']:
                total_balance = summary['financial_summary']['total_outstanding']
            elif 'total_balance' in summary:
                total_balance = summary['total_balance']
            
            self.summary_cards['total_balance']['widgets']['value_label'].setText(
                self.main_controller.format_currency(total_balance)
            )
            
            # Extract total credit
            total_credit = 0.0
            if 'financial_summary' in summary and 'this_week_credits' in summary['financial_summary']:
                total_credit = summary['financial_summary']['this_week_credits']
            elif 'total_credit' in summary:
                total_credit = summary['total_credit']
            
            self.summary_cards['total_credit']['widgets']['value_label'].setText(
                self.main_controller.format_currency(total_credit)
            )
            
            # Extract total payment
            total_payment = 0.0
            if 'financial_summary' in summary and 'this_week_payments' in summary['financial_summary']:
                total_payment = summary['financial_summary']['this_week_payments']
            elif 'total_payment' in summary:
                total_payment = summary['total_payment']
            
            self.summary_cards['total_payment']['widgets']['value_label'].setText(
                self.main_controller.format_currency(total_payment)
            )
            
        except Exception as e:
            logger.error(f"Error updating summary cards: {e}")
    
    def _update_recent_transactions(self, transactions: List[Dict[str, Any]]) -> None:
        """Update recent transactions table"""
        self.recent_transactions_table.setRowCount(0)
        
        for i, transaction in enumerate(transactions[:10]):  # Show last 10
            self.recent_transactions_table.insertRow(i)
            
            # Date
            transaction_date = transaction.get('transaction_date')
            if isinstance(transaction_date, (datetime, str)):
                if isinstance(transaction_date, datetime):
                    date_str = self.main_controller.format_date(transaction_date)
                else:
                    date_str = str(transaction_date)
            else:
                date_str = "N/A"
            
            date_item = QTableWidgetItem(date_str)
            date_item.setData(Qt.UserRole, transaction.get('id'))
            self.recent_transactions_table.setItem(i, 0, date_item)
            
            # Customer
            customer_name = transaction.get('customer_name', 'Unknown')
            customer_item = QTableWidgetItem(customer_name)
            self.recent_transactions_table.setItem(i, 1, customer_item)
            
            # Type
            transaction_type = transaction.get('type', '')
            type_item = QTableWidgetItem(transaction_type)
            
            # Color code based on type
            if transaction_type == 'CREDIT':
                type_item.setForeground(QBrush(QColor('#e74c3c')))  # Red for credit
            elif transaction_type == 'PAYMENT':
                type_item.setForeground(QBrush(QColor('#2ecc71')))  # Green for payment
            elif transaction_type == 'CORRECTION':
                type_item.setForeground(QBrush(QColor('#f39c12')))  # Orange for correction
            
            self.recent_transactions_table.setItem(i, 2, type_item)
            
            # Amount
            amount = transaction.get('amount', 0.0)
            amount_item = QTableWidgetItem(self.main_controller.format_currency(amount))
            
            # Color negative amounts (corrections) differently
            if amount < 0:
                amount_item.setForeground(QBrush(QColor('#f39c12')))
            
            self.recent_transactions_table.setItem(i, 3, amount_item)
            
            # Balance
            balance = transaction.get('running_balance', 0.0)
            if balance == 0.0:
                # Try to get balance from other fields
                balance = transaction.get('balance', 0.0)
            
            balance_item = QTableWidgetItem(self.main_controller.format_currency(balance))
            
            # Color code balance
            if balance > 0:
                balance_item.setForeground(QBrush(QColor('#e74c3c')))  # Red for positive balance
            elif balance < 0:
                balance_item.setForeground(QBrush(QColor('#2ecc71')))  # Green for negative balance
            
            self.recent_transactions_table.setItem(i, 4, balance_item)
        
        # Resize columns to fit content
        self.recent_transactions_table.resizeColumnsToContents()
    
    def _update_top_customers(self, customers: List[Dict[str, Any]]) -> None:
        """Update top customers table"""
        self.top_customers_table.setRowCount(0)
        
        for i, customer in enumerate(customers[:10]):  # Show top 10
            self.top_customers_table.insertRow(i)
            
            # Customer name with ID stored
            customer_name = customer.get('name', 'Unknown')
            name_item = QTableWidgetItem(customer_name)
            name_item.setData(Qt.UserRole, customer.get('id'))
            self.top_customers_table.setItem(i, 0, name_item)
            
            # Phone
            phone_item = QTableWidgetItem(customer.get('phone', ''))
            self.top_customers_table.setItem(i, 1, phone_item)
            
            # Balance
            balance = customer.get('balance', 0.0)
            balance_item = QTableWidgetItem(self.main_controller.format_currency(balance))
            
            # Color code balance
            if balance > 0:
                balance_item.setForeground(QBrush(QColor('#e74c3c')))  # Red for positive balance
            elif balance < 0:
                balance_item.setForeground(QBrush(QColor('#2ecc71')))  # Green for negative balance
            
            self.top_customers_table.setItem(i, 2, balance_item)
            
            # Last transaction date
            last_transaction = customer.get('last_transaction_date')
            if last_transaction:
                if isinstance(last_transaction, datetime):
                    last_transaction_str = self.main_controller.format_date(last_transaction)
                else:
                    last_transaction_str = str(last_transaction)
            else:
                last_transaction_str = 'Never'
            
            last_trans_item = QTableWidgetItem(last_transaction_str)
            self.top_customers_table.setItem(i, 3, last_trans_item)
        
        # Resize columns to fit content
        self.top_customers_table.resizeColumnsToContents()
    
    def _update_daily_summary(self) -> None:
        """Update daily summary statistics"""
        try:
            # Try to get daily summary from transaction controller
            if hasattr(self.transaction_controller, 'get_today_summary'):
                daily_summary = self.transaction_controller.get_today_summary()
                
                # Update total credit today
                total_credit = daily_summary.get('total_credits', 0.0)
                self.daily_stats['total_credit']['widget'].layout().itemAt(1).widget().setText(
                    self.main_controller.format_currency(total_credit)
                )
                
                # Update total payment today
                total_payment = daily_summary.get('total_payments', 0.0)
                self.daily_stats['total_payment']['widget'].layout().itemAt(1).widget().setText(
                    self.main_controller.format_currency(total_payment)
                )
                
                # Update transaction count today
                transaction_count = daily_summary.get('credit_count', 0) + daily_summary.get('payment_count', 0)
                self.daily_stats['transaction_count']['widget'].layout().itemAt(1).widget().setText(
                    str(transaction_count)
                )
        except Exception as e:
            logger.error(f"Error updating daily summary: {e}")
    
    def showEvent(self, event) -> None:
        """Handle show event - refresh data when view is shown"""
        super().showEvent(event)
        self.refresh_data()
    
    def closeEvent(self, event) -> None:
        """Handle close event - stop refresh timer"""
        self.refresh_timer.stop()
        super().closeEvent(event)
