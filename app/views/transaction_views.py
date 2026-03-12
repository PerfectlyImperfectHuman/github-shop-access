"""
Transaction Management Views
Includes transaction entry forms, transaction history, and ledger views.
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from decimal import Decimal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QPushButton,
    QLineEdit, QTextEdit, QTableWidget, QTableWidgetItem, QHeaderView,
    QFrame, QSplitter, QGroupBox, QFormLayout, QMessageBox, QDialog,
    QDialogButtonBox, QComboBox, QDateEdit, QTabWidget, QScrollArea,
    QAbstractItemView, QCheckBox, QToolBar, QStatusBar, QApplication,
    QSizePolicy, QSpacerItem, QDoubleSpinBox, QRadioButton, QButtonGroup,
    QListWidget, QListWidgetItem, QProgressBar
)
from PySide6.QtCore import Qt, Signal, Slot, QDate, QTimer, QSize, QDateTime
from PySide6.QtGui import QFont, QColor, QBrush, QAction, QIcon, QPalette
from app.controllers.transaction_controller import TransactionController
from app.controllers.customer_controller import CustomerController
from app.controllers.main_controller import MainController
logger = logging.getLogger(__name__)


class TransactionEntryView(QWidget):
    """View for entering new transactions (credit, payment, correction)."""
    transaction_completed = Signal()  # Emitted when transaction is successfully added
    
    def __init__(self, main_controller=None):
        """Initialize transaction entry view."""
        super().__init__()
        self.main_controller = main_controller
        self.transaction_controller = main_controller.transaction_controller if main_controller else None
        self.customer_controller = main_controller.customer_controller if main_controller else None
        self.init_ui()
        self.load_customers()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        
        # Title
        title_label = QLabel("New Transaction")
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)
        
        # Transaction type selection
        type_group = QGroupBox("Transaction Type")
        type_layout = QHBoxLayout(type_group)
        self.credit_btn = QPushButton("Credit (Udhaar)")
        self.credit_btn.setCheckable(True)
        self.credit_btn.setChecked(True)
        self.credit_btn.setStyleSheet("""
        QPushButton {
            background-color: #f44336;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
        }
        QPushButton:checked {
            background-color: #d32f2f;
            border: 2px solid #b71c1c;
        }
        """)
        self.payment_btn = QPushButton("Payment")
        self.payment_btn.setCheckable(True)
        self.payment_btn.setStyleSheet("""
        QPushButton {
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
        }
        QPushButton:checked {
            background-color: #388E3C;
            border: 2px solid #2E7D32;
        }
        """)
        self.correction_btn = QPushButton("Correction")
        self.correction_btn.setCheckable(True)
        self.correction_btn.setStyleSheet("""
        QPushButton {
            background-color: #2196F3;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
        }
        QPushButton:checked {
            background-color: #1976D2;
            border: 2px solid #1565C0;
        }
        """)
        
        # Button group for exclusive selection
        self.type_group = QButtonGroup(self)
        self.type_group.addButton(self.credit_btn, 0)
        self.type_group.addButton(self.payment_btn, 1)
        self.type_group.addButton(self.correction_btn, 2)
        self.type_group.setExclusive(True)
        
        type_layout.addWidget(self.credit_btn)
        type_layout.addWidget(self.payment_btn)
        type_layout.addWidget(self.correction_btn)
        type_layout.addStretch()
        layout.addWidget(type_group)
        
        # Form area
        self.form_widget = QWidget()
        self.form_layout = QVBoxLayout(self.form_widget)
        self.form_layout.setSpacing(10)
        
        # Customer selection
        customer_layout = QHBoxLayout()
        customer_layout.addWidget(QLabel("Customer:"))
        self.customer_combo = QComboBox()
        self.customer_combo.setMinimumWidth(200)
        customer_layout.addWidget(self.customer_combo)
        customer_layout.addStretch()
        self.form_layout.addLayout(customer_layout)
        
        # Amount
        amount_layout = QHBoxLayout()
        amount_layout.addWidget(QLabel("Amount (Rs.):"))
        self.amount_input = QDoubleSpinBox()
        self.amount_input.setRange(0.01, 1000000)
        self.amount_input.setPrefix("Rs. ")
        self.amount_input.setDecimals(2)
        self.amount_input.setValue(0.01)
        self.amount_input.setMinimumWidth(150)
        amount_layout.addWidget(self.amount_input)
        amount_layout.addStretch()
        self.form_layout.addLayout(amount_layout)
        
        # Date
        date_layout = QHBoxLayout()
        date_layout.addWidget(QLabel("Date:"))
        self.date_input = QDateEdit()
        self.date_input.setCalendarPopup(True)
        self.date_input.setDate(QDate.currentDate())
        self.date_input.setMinimumWidth(150)
        date_layout.addWidget(self.date_input)
        date_layout.addStretch()
        self.form_layout.addLayout(date_layout)
        
        # Description
        desc_layout = QVBoxLayout()
        desc_layout.addWidget(QLabel("Description:"))
        self.desc_input = QTextEdit()
        self.desc_input.setMaximumHeight(100)
        self.desc_input.setPlaceholderText("Enter transaction description...")
        desc_layout.addWidget(self.desc_input)
        self.form_layout.addLayout(desc_layout)
        
        # Reference (optional)
        ref_layout = QHBoxLayout()
        ref_layout.addWidget(QLabel("Reference (optional):"))
        self.ref_input = QLineEdit()
        self.ref_input.setPlaceholderText("Enter reference number...")
        ref_layout.addWidget(self.ref_input)
        ref_layout.addStretch()
        self.form_layout.addLayout(ref_layout)
        
        # Correction-specific fields (hidden by default)
        self.correction_widget = QWidget()
        correction_layout = QVBoxLayout(self.correction_widget)
        correction_layout.addWidget(QLabel("Original Transaction ID:"))
        self.original_trans_id_input = QLineEdit()
        self.original_trans_id_input.setPlaceholderText("Enter transaction ID to correct...")
        correction_layout.addWidget(self.original_trans_id_input)
        correction_layout.addWidget(QLabel("Correction Reason:"))
        self.correction_reason_input = QTextEdit()
        self.correction_reason_input.setMaximumHeight(80)
        self.correction_reason_input.setPlaceholderText("Explain why this correction is needed...")
        correction_layout.addWidget(self.correction_reason_input)
        self.correction_widget.setVisible(False)
        self.form_layout.addWidget(self.correction_widget)
        
        # Payment method (for payment transactions)
        self.payment_method_widget = QWidget()
        payment_method_layout = QHBoxLayout(self.payment_method_widget)
        payment_method_layout.addWidget(QLabel("Payment Method:"))
        self.payment_method_combo = QComboBox()
        self.payment_method_combo.addItems(["Cash", "Bank Transfer", "Cheque", "Other"])
        payment_method_layout.addWidget(self.payment_method_combo)
        payment_method_layout.addStretch()
        self.payment_method_widget.setVisible(False)
        self.form_layout.addWidget(self.payment_method_widget)
        
        layout.addWidget(self.form_widget, 1)
        
        # Submit button
        self.submit_btn = QPushButton("Add Credit Transaction")
        self.submit_btn.setStyleSheet("""
        QPushButton {
            background-color: #4CAF50;
            color: white;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
        }
        QPushButton:hover {
            background-color: #45a049;
        }
        QPushButton:disabled {
            background-color: #cccccc;
            color: #666666;
        }
        """)
        self.submit_btn.clicked.connect(self.submit_transaction)
        layout.addWidget(self.submit_btn, 0, Qt.AlignCenter)
        
        # Connect signals
        self.type_group.buttonClicked.connect(self.update_ui_for_type)
        self.update_ui_for_type()
    
    def load_customers(self):
        """Load customers into combo box."""
        try:
            if not self.customer_controller:
                return
            self.customer_combo.clear()
            customers = self.customer_controller.get_all_customers(active_only=True)
            for customer in customers:
                self.customer_combo.addItem(f"{customer['name']}", customer['id'])
        except Exception as e:
            logger.error(f"Error loading customers: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load customers: {str(e)}")
    
    def update_ui_for_type(self):
        """Update UI based on selected transaction type."""
        if self.credit_btn.isChecked():
            self.submit_btn.setText("Add Credit Transaction")
            self.submit_btn.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                padding: 12px 30px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #d32f2f;
            }
            """)
            self.correction_widget.setVisible(False)
            self.payment_method_widget.setVisible(False)
        elif self.payment_btn.isChecked():
            self.submit_btn.setText("Add Payment Transaction")
            self.submit_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                padding: 12px 30px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            """)
            self.correction_widget.setVisible(False)
            self.payment_method_widget.setVisible(True)
        else:  # Correction
            self.submit_btn.setText("Add Correction Transaction")
            self.submit_btn.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                padding: 12px 30px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #1976D2;
            }
            """)
            self.correction_widget.setVisible(True)
            self.payment_method_widget.setVisible(False)
    
    def submit_transaction(self):
        """Submit the transaction via controller."""
        try:
            if not self.transaction_controller:
                QMessageBox.warning(self, "Error", "Transaction controller not available.")
                return
            
            # Get customer ID
            customer_id = self.customer_combo.currentData()
            if not customer_id:
                QMessageBox.warning(self, "Error", "Please select a customer.")
                return
            
            amount = self.amount_input.value()
            description = self.desc_input.toPlainText().strip()
            reference = self.ref_input.text().strip() or None
            
            if self.credit_btn.isChecked():
                # Credit transaction
                transaction_id = self.transaction_controller.add_credit_transaction(
                    customer_id=customer_id,
                    amount=amount,
                    description=description,
                    reference=reference
                )
                if transaction_id:
                    QMessageBox.information(self, "Success", "Credit transaction added successfully!")
                    self.clear_form()
                    self.transaction_completed.emit()
                else:
                    QMessageBox.warning(self, "Error", "Failed to add credit transaction.")
            
            elif self.payment_btn.isChecked():
                # Payment transaction
                payment_method = self.payment_method_combo.currentText()
                transaction_id = self.transaction_controller.add_payment_transaction(
                    customer_id=customer_id,
                    amount=amount,
                    description=description,
                    reference=reference,
                    payment_method=payment_method
                )
                if transaction_id:
                    QMessageBox.information(self, "Success", "Payment transaction added successfully!")
                    self.clear_form()
                    self.transaction_completed.emit()
                else:
                    QMessageBox.warning(self, "Error", "Failed to add payment transaction.")
            
            else:  # Correction
                original_trans_id = self.original_trans_id_input.text().strip()
                if not original_trans_id:
                    QMessageBox.warning(self, "Error", "Please enter original transaction ID.")
                    return
                reason = self.correction_reason_input.toPlainText().strip()
                if not reason:
                    QMessageBox.warning(self, "Error", "Please enter correction reason.")
                    return
                try:
                    original_trans_id = int(original_trans_id)
                except ValueError:
                    QMessageBox.warning(self, "Error", "Transaction ID must be a number.")
                    return
                
                transaction_id = self.transaction_controller.add_correction_transaction(
                    original_transaction_id=original_trans_id,
                    correction_amount=amount,
                    reason=reason
                )
                if transaction_id:
                    QMessageBox.information(self, "Success", "Correction transaction added successfully!")
                    self.clear_form()
                    self.transaction_completed.emit()
                else:
                    QMessageBox.warning(self, "Error", "Failed to add correction transaction.")
        
        except Exception as e:
            logger.error(f"Error adding transaction: {e}")
            QMessageBox.critical(self, "Error", f"Failed to add transaction: {str(e)}")
    
    def clear_form(self):
        """Clear the form."""
        self.amount_input.setValue(0.01)
        self.desc_input.clear()
        self.ref_input.clear()
        self.original_trans_id_input.clear()
        self.correction_reason_input.clear()
        self.date_input.setDate(QDate.currentDate())
        # Keep customer selection but reset to first item
        if self.customer_combo.count() > 0:
            self.customer_combo.setCurrentIndex(0)


class TransactionHistoryView(QWidget):
    """View for displaying transaction history with proper controller integration."""
    
    def __init__(self, main_controller=None):
        """Initialize transaction history view."""
        super().__init__()
        self.main_controller = main_controller
        self.transaction_controller = main_controller.transaction_controller if main_controller else None
        self.customer_controller = main_controller.customer_controller if main_controller else None
        self.init_ui()
        self.setup_connections()
        self.load_customers()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        
        # Header
        header_layout = QHBoxLayout()
        title_label = QLabel("Transaction History")
        title_font = QFont()
        title_font.setPointSize(16)
        title_font.setBold(True)
        title_label.setFont(title_font)
        header_layout.addWidget(title_label)
        header_layout.addStretch()
        
        # Refresh button
        refresh_btn = QPushButton("⟳ Refresh")
        refresh_btn.clicked.connect(self.refresh_transactions)
        header_layout.addWidget(refresh_btn)
        layout.addLayout(header_layout)
        
        # Filters
        filter_group = QGroupBox("Filters")
        filter_layout = QHBoxLayout(filter_group)
        filter_layout.addWidget(QLabel("Customer:"))
        self.customer_filter = QComboBox()
        self.customer_filter.addItem("All Customers", None)
        filter_layout.addWidget(self.customer_filter)
        filter_layout.addWidget(QLabel("Type:"))
        self.type_filter = QComboBox()
        self.type_filter.addItems(["All Types", "CREDIT", "PAYMENT", "CORRECTION"])
        filter_layout.addWidget(self.type_filter)
        filter_layout.addWidget(QLabel("From:"))
        self.from_date = QDateEdit()
        self.from_date.setCalendarPopup(True)
        self.from_date.setDate(QDate.currentDate().addDays(-30))
        filter_layout.addWidget(self.from_date)
        filter_layout.addWidget(QLabel("To:"))
        self.to_date = QDateEdit()
        self.to_date.setCalendarPopup(True)
        self.to_date.setDate(QDate.currentDate())
        filter_layout.addWidget(self.to_date)
        apply_btn = QPushButton("Apply Filters")
        apply_btn.clicked.connect(self.apply_filters)
        filter_layout.addWidget(apply_btn)
        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(self.clear_filters)
        filter_layout.addWidget(clear_btn)
        layout.addWidget(filter_group)
        
        # Transaction table
        self.transaction_table = QTableWidget()
        self.transaction_table.setColumnCount(7)
        self.transaction_table.setHorizontalHeaderLabels([
            "ID", "Date", "Customer", "Type", "Amount", "Description", "Reference"
        ])
        self.transaction_table.horizontalHeader().setStretchLastSection(False)
        self.transaction_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.transaction_table.horizontalHeader().setSectionResizeMode(5, QHeaderView.Stretch)
        self.transaction_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.transaction_table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.transaction_table, 1)
        
        # Status bar
        self.status_label = QLabel("Ready")
        self.status_label.setStyleSheet("color: #666; font-style: italic;")
        layout.addWidget(self.status_label)
    
    def setup_connections(self):
        """Setup signal/slot connections to controller."""
        if self.transaction_controller:
            self.transaction_controller.transactions_loaded.connect(self._on_transactions_loaded)
            self.transaction_controller.error_occurred.connect(self._on_error)
    
    def load_customers(self):
        """Load customers into filter combo box."""
        try:
            if not self.customer_controller:
                return
            self.customer_filter.clear()
            self.customer_filter.addItem("All Customers", None)
            customers = self.customer_controller.get_all_customers(active_only=True)
            for customer in customers:
                self.customer_filter.addItem(f"{customer['name']}", customer['id'])
        except Exception as e:
            logger.error(f"Error loading customers for filter: {e}")
    
    def refresh_transactions(self):
        """Refresh transaction list using controller."""
        try:
            if not self.transaction_controller:
                self.status_label.setText("Transaction controller not available")
                return
            
            # Get all transactions without filters
            self.transaction_controller.get_all_transactions(limit=100, offset=0)
            self.status_label.setText("Loading transactions...")
        except Exception as e:
            logger.error(f"Error refreshing transactions: {e}")
            self.status_label.setText(f"Error: {str(e)}")
    
    def apply_filters(self):
        """Apply filters to transaction list."""
        try:
            if not self.transaction_controller:
                return
            
            filters = {}
            # Customer filter
            customer_id = self.customer_filter.currentData()
            if customer_id is not None:
                filters['customer_id'] = customer_id
            
            # Type filter
            type_filter = self.type_filter.currentText()
            if type_filter != "All Types":
                filters['type'] = type_filter
            
            # Date range
            from_date = self.from_date.date().toPython()
            to_date = self.to_date.date().toPython()
            filters['start_date'] = datetime.combine(from_date, datetime.min.time())
            filters['end_date'] = datetime.combine(to_date, datetime.max.time())
            
            # Search transactions with filters
            self.transaction_controller.search_transactions(filters)
            self.status_label.setText("Applying filters...")
        except Exception as e:
            logger.error(f"Error applying filters: {e}")
            QMessageBox.critical(self, "Error", f"Failed to apply filters: {str(e)}")
    
    def clear_filters(self):
        """Clear all filters."""
        self.customer_filter.setCurrentIndex(0)
        self.type_filter.setCurrentIndex(0)
        self.from_date.setDate(QDate.currentDate().addDays(-30))
        self.to_date.setDate(QDate.currentDate())
        self.refresh_transactions()
    
    @Slot(list)
    def _on_transactions_loaded(self, transactions: List[Dict[str, Any]]):
        """Handle transactions loaded signal from controller."""
        try:
            # Clear table
            self.transaction_table.setRowCount(0)
            
            # Populate table efficiently
            for row, transaction in enumerate(transactions):
                self.transaction_table.insertRow(row)
                
                # ID
                id_item = QTableWidgetItem(str(transaction.get('id', '')))
                self.transaction_table.setItem(row, 0, id_item)
                
                # Date
                date_val = transaction.get('transaction_date')
                if date_val:
                    if isinstance(date_val, str):
                        date_text = date_val[:10]  # YYYY-MM-DD
                    else:
                        date_text = date_val.strftime("%d/%m/%Y")
                else:
                    date_text = "--"
                date_item = QTableWidgetItem(date_text)
                self.transaction_table.setItem(row, 1, date_item)
                
                # Customer
                customer_name = transaction.get('customer_name', 'Unknown')
                customer_item = QTableWidgetItem(customer_name)
                self.transaction_table.setItem(row, 2, customer_item)
                
                # Type
                type_text = transaction.get('type', '')
                type_item = QTableWidgetItem(type_text)
                if type_text == "CREDIT":
                    type_item.setForeground(Qt.red)
                elif type_text == "PAYMENT":
                    type_item.setForeground(Qt.darkGreen)
                elif type_text == "CORRECTION":
                    type_item.setForeground(Qt.blue)
                self.transaction_table.setItem(row, 3, type_item)
                
                # Amount
                amount = transaction.get('amount', 0.0)
                amount_item = QTableWidgetItem(f"Rs. {amount:,.2f}")
                amount_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                self.transaction_table.setItem(row, 4, amount_item)
                
                # Description
                desc_item = QTableWidgetItem(transaction.get('description', '')[:50])
                self.transaction_table.setItem(row, 5, desc_item)
                
                # Reference
                ref_item = QTableWidgetItem(transaction.get('reference', ''))
                self.transaction_table.setItem(row, 6, ref_item)
            
            # Update status with count
            self.status_label.setText(f"Showing {len(transactions)} transactions")
            logger.debug(f"Loaded {len(transactions)} transactions into table")
        except Exception as e:
            logger.error(f"Error loading transactions into table: {e}")
            self.status_label.setText(f"Display error: {str(e)}")
    
    @Slot(str)
    def _on_error(self, error_message: str):
        """Handle error signal from controller."""
        self.status_label.setText(f"Error: {error_message}")
        QMessageBox.warning(self, "Transaction Error", error_message)


class TransactionListView(QWidget):
    """Main transaction list view with filters and management"""
    # Signals
    transaction_selected = Signal(int)  # transaction_id
    add_transaction_requested = Signal()
    refresh_requested = Signal()
    
    def __init__(self, transaction_controller: TransactionController,
                 customer_controller: CustomerController,
                 main_controller: MainController):
        """Initialize transaction list view"""
        super().__init__()
        self.transaction_controller = transaction_controller
        self.customer_controller = customer_controller
        self.main_controller = main_controller
        self.current_filters: Dict[str, Any] = {}
        self._setup_ui()
        self._connect_signals()
        logger.info("TransactionListView initialized")
    
    def _setup_ui(self) -> None:
        """Setup the transaction list UI"""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Header with title and buttons
        self._create_header(main_layout)
        
        # Filter panel
        self._create_filter_panel(main_layout)
        
        # Transaction table
        self._create_transaction_table(main_layout)
        
        # Status bar
        self._create_status_bar(main_layout)
    
    def _create_header(self, parent_layout: QVBoxLayout) -> None:
        """Create header with title and action buttons"""
        header_layout = QHBoxLayout()
        
        # Title
        title_label = QLabel("Transaction Management")
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #2c3e50;")
        header_layout.addWidget(title_label)
        header_layout.addStretch()
        
        # Action buttons
        action_buttons = [
            ("Add Credit", "Add a credit transaction", "#e74c3c", self._on_add_credit),
            ("Add Payment", "Add a payment transaction", "#2ecc71", self._on_add_payment),
            ("Refresh", "Refresh transaction list", "#3498db", self.refresh_requested.emit),
            ("Export", "Export transactions", "#9b59b6", self._on_export)
        ]
        
        for text, tooltip, color, slot in action_buttons:
            btn = QPushButton(text)
            btn.setToolTip(tooltip)
            btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {color};
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {self._darken_color(color)};
            }}
            """)
            btn.clicked.connect(slot)
            header_layout.addWidget(btn)
        
        parent_layout.addLayout(header_layout)
    
    def _create_filter_panel(self, parent_layout: QVBoxLayout) -> None:
        """Create filter panel with various filter options"""
        filter_group = QGroupBox("Filter Transactions")
        filter_group.setStyleSheet("""
        QGroupBox {
            font-weight: bold;
            font-size: 13px;
            color: #2c3e50;
            border: 1px solid #bdc3c7;
            border-radius: 5px;
            margin-top: 10px;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
            color: #2c3e50;
        }
        """)
        filter_layout = QGridLayout(filter_group)
        filter_layout.setContentsMargins(10, 20, 10, 10)
        filter_layout.setVerticalSpacing(10)
        filter_layout.setHorizontalSpacing(15)
        
        # Row 1: Customer, Type, Date range
        # Customer filter
        filter_layout.addWidget(QLabel("Customer:"), 0, 0)
        self.customer_filter = QComboBox()
        self.customer_filter.addItem("All Customers", None)
        self._load_customers_into_filter()
        filter_layout.addWidget(self.customer_filter, 0, 1)
        
        # Transaction type filter
        filter_layout.addWidget(QLabel("Type:"), 0, 2)
        self.type_filter = QComboBox()
        self.type_filter.addItems(["All Types", "CREDIT", "PAYMENT", "CORRECTION"])
        filter_layout.addWidget(self.type_filter, 0, 3)
        
        # Row 2: Date range
        filter_layout.addWidget(QLabel("From Date:"), 1, 0)
        self.from_date_filter = QDateEdit()
        self.from_date_filter.setCalendarPopup(True)
        self.from_date_filter.setDate(QDate.currentDate().addDays(-30))
        filter_layout.addWidget(self.from_date_filter, 1, 1)
        
        filter_layout.addWidget(QLabel("To Date:"), 1, 2)
        self.to_date_filter = QDateEdit()
        self.to_date_filter.setCalendarPopup(True)
        self.to_date_filter.setDate(QDate.currentDate())
        filter_layout.addWidget(self.to_date_filter, 1, 3)
        
        # Row 3: Amount range and search
        filter_layout.addWidget(QLabel("Min Amount:"), 2, 0)
        self.min_amount_filter = QDoubleSpinBox()
        self.min_amount_filter.setRange(0, 1000000)
        self.min_amount_filter.setPrefix("Rs. ")
        self.min_amount_filter.setValue(0)
        filter_layout.addWidget(self.min_amount_filter, 2, 1)
        
        filter_layout.addWidget(QLabel("Max Amount:"), 2, 2)
        self.max_amount_filter = QDoubleSpinBox()
        self.max_amount_filter.setRange(0, 1000000)
        self.max_amount_filter.setPrefix("Rs. ")
        self.max_amount_filter.setValue(1000000)
        filter_layout.addWidget(self.max_amount_filter, 2, 3)
        
        # Row 4: Description search and buttons
        filter_layout.addWidget(QLabel("Search:"), 3, 0)
        self.search_filter = QLineEdit()
        self.search_filter.setPlaceholderText("Search in description...")
        filter_layout.addWidget(self.search_filter, 3, 1, 1, 2)
        
        # Filter buttons
        filter_buttons_layout = QHBoxLayout()
        apply_filter_btn = QPushButton("Apply Filters")
        apply_filter_btn.setStyleSheet("""
        QPushButton {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #2980b9;
        }
        """)
        apply_filter_btn.clicked.connect(self._apply_filters)
        filter_buttons_layout.addWidget(apply_filter_btn)
        
        clear_filter_btn = QPushButton("Clear Filters")
        clear_filter_btn.setStyleSheet("""
        QPushButton {
            background-color: #95a5a6;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #7f8c8d;
        }
        """)
        clear_filter_btn.clicked.connect(self._clear_filters)
        filter_buttons_layout.addWidget(clear_filter_btn)
        
        filter_layout.addLayout(filter_buttons_layout, 3, 3)
        parent_layout.addWidget(filter_group)
    
    def _create_transaction_table(self, parent_layout: QVBoxLayout) -> None:
        """Create the transaction table widget"""
        # Table widget
        self.transaction_table = QTableWidget()
        self.transaction_table.setColumnCount(8)
        self.transaction_table.setHorizontalHeaderLabels([
            "ID", "Date", "Customer", "Type", "Amount", "Description", "Balance", "Actions"
        ])
        self.transaction_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.transaction_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.transaction_table.setAlternatingRowColors(True)
        self.transaction_table.verticalHeader().setVisible(False)
        self.transaction_table.setMinimumHeight(400)
        
        # Set column widths
        header = self.transaction_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # ID
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)  # Date
        header.setSectionResizeMode(2, QHeaderView.Stretch)           # Customer
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)  # Type
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # Amount
        header.setSectionResizeMode(5, QHeaderView.Stretch)           # Description
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)  # Balance
        header.setSectionResizeMode(7, QHeaderView.ResizeToContents)  # Actions
        
        # Connect signals
        self.transaction_table.doubleClicked.connect(self._on_table_double_clicked)
        parent_layout.addWidget(self.transaction_table, 1)
    
    def _create_status_bar(self, parent_layout: QVBoxLayout) -> None:
        """Create status bar at bottom"""
        status_layout = QHBoxLayout()
        
        # Transaction count and totals
        self.stats_label = QLabel("Total: 0 transactions | Credit: Rs. 0.00 | Payment: Rs. 0.00")
        self.stats_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
        status_layout.addWidget(self.stats_label)
        status_layout.addStretch()
        
        # Last updated
        self.last_updated_label = QLabel("Last updated: --")
        self.last_updated_label.setStyleSheet("color: #2c3e50;")
        status_layout.addWidget(self.last_updated_label)
        
        parent_layout.addLayout(status_layout)
    
    def _darken_color(self, hex_color: str, factor: float = 0.8) -> str:
        """Darken a hex color by a factor"""
        hex_color = hex_color.lstrip('#')
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        r, g, b = int(r * factor), int(g * factor), int(b * factor)
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def _load_customers_into_filter(self) -> None:
        """Load customers into the customer filter dropdown"""
        try:
            customers = self.customer_controller.get_all_customers(include_balance=False)
            for customer in customers:
                self.customer_filter.addItem(customer['name'], customer['id'])
        except Exception as e:
            logger.error(f"Error loading customers for filter: {e}")
    
    def _connect_signals(self) -> None:
        """Connect signals from controllers"""
        self.transaction_controller.transactions_loaded.connect(self._on_transactions_loaded)
        self.transaction_controller.transaction_added.connect(self._on_transaction_added)
        self.transaction_controller.transaction_corrected.connect(self._on_transaction_corrected)
        self.transaction_controller.error_occurred.connect(self._on_error)
        self.customer_controller.customer_added.connect(self._on_customer_added)
        self.customer_controller.customer_updated.connect(self._on_customer_updated)
        self.refresh_requested.connect(self.refresh)
    
    @Slot()
    def refresh(self) -> None:
        """Refresh transaction list with current filters"""
        self._apply_filters()
    
    def _get_current_filters(self) -> Dict[str, Any]:
        """Get current filter values"""
        filters = {}
        
        # Customer filter
        customer_id = self.customer_filter.currentData()
        if customer_id:
            filters['customer_id'] = customer_id
        
        # Type filter
        type_filter = self.type_filter.currentText()
        if type_filter != "All Types":
            filters['type'] = type_filter
        
        # Date range
        from_date = self.from_date_filter.date().toPython()
        to_date = self.to_date_filter.date().toPython()
        filters['start_date'] = datetime.combine(from_date, datetime.min.time())
        filters['end_date'] = datetime.combine(to_date, datetime.max.time())
        
        # Amount range
        min_amount = self.min_amount_filter.value()
        max_amount = self.max_amount_filter.value()
        if min_amount > 0:
            filters['min_amount'] = min_amount
        if max_amount < 1000000:
            filters['max_amount'] = max_amount
        
        # Search text
        search_text = self.search_filter.text().strip()
        if search_text:
            filters['description'] = search_text
        
        return filters
    
    @Slot()
    def _apply_filters(self) -> None:
        """Apply current filters and refresh transactions"""
        try:
            self.current_filters = self._get_current_filters()
            # Use controller method to search transactions
            self.transaction_controller.search_transactions(self.current_filters)
        except Exception as e:
            logger.error(f"Error applying filters: {e}")
            QMessageBox.critical(self, "Error", f"Failed to apply filters: {e}")
    
    @Slot()
    def _clear_filters(self) -> None:
        """Clear all filters"""
        self.customer_filter.setCurrentIndex(0)
        self.type_filter.setCurrentIndex(0)
        self.from_date_filter.setDate(QDate.currentDate().addDays(-30))
        self.to_date_filter.setDate(QDate.currentDate())
        self.min_amount_filter.setValue(0)
        self.max_amount_filter.setValue(1000000)
        self.search_filter.clear()
        self._apply_filters()
    
    @Slot(list)
    def _on_transactions_loaded(self, transactions: List[Dict[str, Any]]) -> None:
        """Handle transactions loaded signal"""
        try:
            # Clear table efficiently
            self.transaction_table.setRowCount(0)
            
            # Calculate totals
            total_credit = 0.0
            total_payment = 0.0
            
            # Populate table with minimal overhead
            for i, transaction in enumerate(transactions):
                self.transaction_table.insertRow(i)
                
                # ID
                id_item = QTableWidgetItem(str(transaction.get('id', '')))
                id_item.setData(Qt.UserRole, transaction.get('id'))
                self.transaction_table.setItem(i, 0, id_item)
                
                # Date
                date_val = transaction.get('transaction_date')
                if date_val:
                    if isinstance(date_val, str):
                        date_text = date_val
                    else:
                        date_text = self.main_controller.format_date(date_val)
                else:
                    date_text = "--"
                date_item = QTableWidgetItem(date_text)
                self.transaction_table.setItem(i, 1, date_item)
                
                # Customer
                customer_item = QTableWidgetItem(transaction.get('customer_name', 'Unknown'))
                self.transaction_table.setItem(i, 2, customer_item)
                
                # Type
                type_text = transaction.get('type', '')
                type_item = QTableWidgetItem(type_text)
                # Color code type
                if type_text == 'CREDIT':
                    type_item.setForeground(QBrush(QColor('#e74c3c')))  # Red
                    total_credit += abs(transaction.get('amount', 0))
                elif type_text == 'PAYMENT':
                    type_item.setForeground(QBrush(QColor('#2ecc71')))  # Green
                    total_payment += abs(transaction.get('amount', 0))
                elif type_text == 'CORRECTION':
                    type_item.setForeground(QBrush(QColor('#f39c12')))  # Orange
                self.transaction_table.setItem(i, 3, type_item)
                
                # Amount
                amount = transaction.get('amount', 0.0)
                amount_item = QTableWidgetItem(self.main_controller.format_currency(amount))
                # Color amount based on type
                if type_text == 'CREDIT':
                    amount_item.setForeground(QBrush(QColor('#e74c3c')))
                elif type_text == 'PAYMENT':
                    amount_item.setForeground(QBrush(QColor('#2ecc71')))
                elif type_text == 'CORRECTION':
                    amount_item.setForeground(QBrush(QColor('#f39c12')))
                self.transaction_table.setItem(i, 4, amount_item)
                
                # Description
                desc = transaction.get('description', '')
                desc_item = QTableWidgetItem(desc)
                self.transaction_table.setItem(i, 5, desc_item)
                
                # Balance (if available)
                balance = transaction.get('running_balance', 0.0)
                balance_item = QTableWidgetItem(self.main_controller.format_currency(balance))
                # Color balance
                if balance > 0:
                    balance_item.setForeground(QBrush(QColor('#e74c3c')))
                elif balance < 0:
                    balance_item.setForeground(QBrush(QColor('#2ecc71')))
                self.transaction_table.setItem(i, 6, balance_item)
                
                # Actions column - create widget only when needed
                actions_widget = QWidget()
                actions_layout = QHBoxLayout(actions_widget)
                actions_layout.setContentsMargins(5, 2, 5, 2)
                actions_layout.setSpacing(3)
                
                # View button
                view_btn = QPushButton("View")
                view_btn.setStyleSheet("""
                QPushButton {
                    background-color: #3498db;
                    color: white;
                    border: none;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                }
                QPushButton:hover {
                    background-color: #2980b9;
                }
                """)
                trans_id = transaction.get('id')
                view_btn.clicked.connect(lambda checked, tid=trans_id: self._on_view_transaction(tid))
                actions_layout.addWidget(view_btn)
                
                # Correction button (only for non-correction transactions)
                if type_text != 'CORRECTION':
                    correct_btn = QPushButton("Correct")
                    correct_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #f39c12;
                        color: white;
                        border: none;
                        padding: 3px 8px;
                        border-radius: 3px;
                        font-size: 11px;
                    }
                    QPushButton:hover {
                        background-color: #d68910;
                    }
                    """)
                    correct_btn.clicked.connect(lambda checked, tid=trans_id: self._on_correct_transaction(tid))
                    actions_layout.addWidget(correct_btn)
                
                actions_layout.addStretch()
                self.transaction_table.setCellWidget(i, 7, actions_widget)
            
            # Update status bar
            total_transactions = len(transactions)
            self.stats_label.setText(
                f"Total: {total_transactions} transactions | "
                f"Credit: {self.main_controller.format_currency(total_credit)} | "
                f"Payment: {self.main_controller.format_currency(total_payment)}"
            )
            self.last_updated_label.setText(f"Last updated: {datetime.now().strftime('%H:%M:%S')}")
            logger.debug(f"Loaded {total_transactions} transactions into table")
        except Exception as e:
            logger.error(f"Error loading transactions into table: {e}")
            QMessageBox.critical(self, "Error", f"Failed to display transactions: {e}")
    
    @Slot(int)
    def _on_transaction_added(self, transaction_id: int) -> None:
        """Handle transaction added signal - refresh UI"""
        self.refresh()
    
    @Slot(int, int)
    def _on_transaction_corrected(self, original_id: int, correction_id: int) -> None:
        """Handle transaction corrected signal - refresh UI"""
        self.refresh()
    
    @Slot(str)
    def _on_error(self, error_message: str) -> None:
        """Handle error signal"""
        QMessageBox.critical(self, "Error", error_message)
    
    @Slot(int)
    def _on_customer_added(self, customer_id: int) -> None:
        """Handle customer added signal - refresh customer filter"""
        self._load_customers_into_filter()
    
    @Slot(int)
    def _on_customer_updated(self, customer_id: int) -> None:
        """Handle customer updated signal - refresh customer filter"""
        # Note: This is a simple refresh; could be optimized
        self.customer_filter.clear()
        self.customer_filter.addItem("All Customers", None)
        self._load_customers_into_filter()
    
    @Slot()
    def _on_add_credit(self) -> None:
        """Handle add credit button click"""
        dialog = CreditTransactionDialog(
            self.transaction_controller,
            self.customer_controller,
            self.main_controller,
            self
        )
        if dialog.exec() == QDialog.Accepted:
            self.refresh()
    
    @Slot()
    def _on_add_payment(self) -> None:
        """Handle add payment button click"""
        dialog = PaymentTransactionDialog(
            self.transaction_controller,
            self.customer_controller,
            self.main_controller,
            self
        )
        if dialog.exec() == QDialog.Accepted:
            self.refresh()
    
    @Slot()
    def _on_export(self) -> None:
        """Handle export button click"""
        # TODO: Implement export functionality
        QMessageBox.information(self, "Export", "Export functionality will be implemented soon.")
    
    def _on_view_transaction(self, transaction_id: int) -> None:
        """Handle view transaction button click"""
        self.transaction_selected.emit(transaction_id)
    
    def _on_correct_transaction(self, transaction_id: int) -> None:
        """Handle correct transaction button click"""
        dialog = CorrectionTransactionDialog(
            self.transaction_controller,
            self.main_controller,
            transaction_id,
            self
        )
        if dialog.exec() == QDialog.Accepted:
            self.refresh()
    
    @Slot()
    def _on_table_double_clicked(self, index) -> None:
        """Handle double click on table row"""
        if index.isValid():
            row = index.row()
            transaction_id = self.transaction_table.item(row, 0).data(Qt.UserRole)
            if transaction_id:
                self.transaction_selected.emit(transaction_id)
    
    def showEvent(self, event) -> None:
        """Handle show event - refresh data when shown"""
        super().showEvent(event)
        self.refresh()


class CreditTransactionDialog(QDialog):
    """Dialog for adding a credit transaction"""
    
    def __init__(self, transaction_controller: TransactionController,
                 customer_controller: CustomerController,
                 main_controller: MainController,
                 parent: QWidget = None):
        """Initialize credit transaction dialog"""
        super().__init__(parent)
        self.transaction_controller = transaction_controller
        self.customer_controller = customer_controller
        self.main_controller = main_controller
        self._setup_ui()
        self.setWindowTitle("Add Credit Transaction")
        self.resize(500, 400)
    
    def _setup_ui(self) -> None:
        """Setup the dialog UI"""
        layout = QVBoxLayout(self)
        
        # Form layout
        form_layout = QFormLayout()
        form_layout.setVerticalSpacing(15)
        
        # Customer selection
        form_layout.addWidget(QLabel("Customer:"))
        self.customer_combo = QComboBox()
        self._load_customers()
        form_layout.addWidget(self.customer_combo)
        
        # Amount
        form_layout.addWidget(QLabel("Amount (Rs.):"))
        self.amount_input = QDoubleSpinBox()
        self.amount_input.setRange(0.01, 1000000)
        self.amount_input.setPrefix("Rs. ")
        self.amount_input.setDecimals(2)
        self.amount_input.setValue(0.01)
        form_layout.addWidget(self.amount_input)
        
        # Date
        form_layout.addWidget(QLabel("Date:"))
        self.date_input = QDateEdit()
        self.date_input.setCalendarPopup(True)
        self.date_input.setDate(QDate.currentDate())
        form_layout.addWidget(self.date_input)
        
        # Description
        form_layout.addWidget(QLabel("Description:"))
        self.description_input = QTextEdit()
        self.description_input.setPlaceholderText("Enter transaction description...")
        self.description_input.setMaximumHeight(80)
        form_layout.addWidget(self.description_input)
        
        # Reference (optional)
        form_layout.addWidget(QLabel("Reference (optional):"))
        self.reference_input = QLineEdit()
        self.reference_input.setPlaceholderText("Enter reference number...")
        form_layout.addWidget(self.reference_input)
        
        layout.addLayout(form_layout, 1)
        
        # Customer balance info
        self.balance_label = QLabel("Customer Balance: --")
        self.balance_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
        layout.addWidget(self.balance_label)
        
        # Connect customer selection change
        self.customer_combo.currentIndexChanged.connect(self._on_customer_changed)
        
        # Dialog buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self._on_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
        
        # Update balance for first customer
        if self.customer_combo.count() > 0:
            self._on_customer_changed(0)
    
    def _load_customers(self) -> None:
        """Load customers into combo box"""
        try:
            customers = self.customer_controller.get_all_customers(include_balance=True)
            for customer in customers:
                self.customer_combo.addItem(
                    f"{customer['name']} (Balance: {self.main_controller.format_currency(customer.get('balance', 0))})",
                    customer['id']
                )
        except Exception as e:
            logger.error(f"Error loading customers: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load customers: {e}")
    
    @Slot(int)
    def _on_customer_changed(self, index: int) -> None:
        """Handle customer selection change"""
        if index >= 0:
            customer_id = self.customer_combo.itemData(index)
            if customer_id:
                try:
                    balance = self.transaction_controller.get_customer_balance(customer_id)
                    self.balance_label.setText(
                        f"Customer Balance: {self.main_controller.format_currency(balance)}"
                    )
                    # Color code balance
                    if balance > 0:
                        self.balance_label.setStyleSheet("color: #e74c3c; font-weight: bold;")
                    elif balance < 0:
                        self.balance_label.setStyleSheet("color: #2ecc71; font-weight: bold;")
                    else:
                        self.balance_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
                except Exception as e:
                    logger.error(f"Error getting customer balance: {e}")
    
    def _validate_form(self) -> bool:
        """Validate form data"""
        if self.customer_combo.currentIndex() < 0:
            QMessageBox.warning(self, "Validation Error", "Please select a customer.")
            return False
        if self.amount_input.value() <= 0:
            QMessageBox.warning(self, "Validation Error", "Amount must be greater than 0.")
            self.amount_input.setFocus()
            return False
        return True
    
    def _on_accept(self) -> None:
        """Handle accept button - use controller method"""
        if not self._validate_form():
            return
        
        try:
            customer_id = self.customer_combo.currentData()
            amount = self.amount_input.value()
            description = self.description_input.toPlainText().strip()
            reference = self.reference_input.text().strip() or None
            
            # Use controller method to add transaction
            transaction_id = self.transaction_controller.add_credit_transaction(
                customer_id=customer_id,
                amount=amount,
                description=description,
                reference=reference
            )
            
            if transaction_id:
                self.accept()
            else:
                QMessageBox.warning(self, "Error", "Failed to add credit transaction.")
        except Exception as e:
            logger.error(f"Error adding credit transaction: {e}")
            QMessageBox.critical(self, "Error", f"Failed to add transaction: {e}")


class PaymentTransactionDialog(QDialog):
    """Dialog for adding a payment transaction"""
    
    def __init__(self, transaction_controller: TransactionController,
                 customer_controller: CustomerController,
                 main_controller: MainController,
                 parent: QWidget = None):
        """Initialize payment transaction dialog"""
        super().__init__(parent)
        self.transaction_controller = transaction_controller
        self.customer_controller = customer_controller
        self.main_controller = main_controller
        self._setup_ui()
        self.setWindowTitle("Add Payment Transaction")
        self.resize(500, 400)
    
    def _setup_ui(self) -> None:
        """Setup the dialog UI"""
        layout = QVBoxLayout(self)
        
        # Form layout
        form_layout = QFormLayout()
        form_layout.setVerticalSpacing(15)
        
        # Customer selection
        form_layout.addWidget(QLabel("Customer:"))
        self.customer_combo = QComboBox()
        self._load_customers()
        form_layout.addWidget(self.customer_combo)
        
        # Amount
        form_layout.addWidget(QLabel("Amount (Rs.):"))
        self.amount_input = QDoubleSpinBox()
        self.amount_input.setRange(0.01, 1000000)
        self.amount_input.setPrefix("Rs. ")
        self.amount_input.setDecimals(2)
        self.amount_input.setValue(0.01)
        form_layout.addWidget(self.amount_input)
        
        # Date
        form_layout.addWidget(QLabel("Date:"))
        self.date_input = QDateEdit()
        self.date_input.setCalendarPopup(True)
        self.date_input.setDate(QDate.currentDate())
        form_layout.addWidget(self.date_input)
        
        # Description
        form_layout.addWidget(QLabel("Description:"))
        self.description_input = QTextEdit()
        self.description_input.setPlaceholderText("Enter transaction description...")
        self.description_input.setMaximumHeight(80)
        form_layout.addWidget(self.description_input)
        
        # Reference (optional)
        form_layout.addWidget(QLabel("Reference (optional):"))
        self.reference_input = QLineEdit()
        self.reference_input.setPlaceholderText("Enter reference number...")
        form_layout.addWidget(self.reference_input)
        
        # Payment method
        form_layout.addWidget(QLabel("Payment Method:"))
        self.method_combo = QComboBox()
        self.method_combo.addItems(["Cash", "Bank Transfer", "Cheque", "Other"])
        form_layout.addWidget(self.method_combo)
        
        layout.addLayout(form_layout, 1)
        
        # Customer balance info
        self.balance_label = QLabel("Customer Balance: --")
        self.balance_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
        layout.addWidget(self.balance_label)
        
        # Connect customer selection change
        self.customer_combo.currentIndexChanged.connect(self._on_customer_changed)
        
        # Dialog buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self._on_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
        
        # Update balance for first customer
        if self.customer_combo.count() > 0:
            self._on_customer_changed(0)
    
    def _load_customers(self) -> None:
        """Load customers into combo box"""
        try:
            customers = self.customer_controller.get_all_customers(include_balance=True)
            for customer in customers:
                self.customer_combo.addItem(
                    f"{customer['name']} (Balance: {self.main_controller.format_currency(customer.get('balance', 0))})",
                    customer['id']
                )
        except Exception as e:
            logger.error(f"Error loading customers: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load customers: {e}")
    
    @Slot(int)
    def _on_customer_changed(self, index: int) -> None:
        """Handle customer selection change"""
        if index >= 0:
            customer_id = self.customer_combo.itemData(index)
            if customer_id:
                try:
                    balance = self.transaction_controller.get_customer_balance(customer_id)
                    self.balance_label.setText(
                        f"Customer Balance: {self.main_controller.format_currency(balance)}"
                    )
                    # Color code balance
                    if balance > 0:
                        self.balance_label.setStyleSheet("color: #e74c3c; font-weight: bold;")
                    elif balance < 0:
                        self.balance_label.setStyleSheet("color: #2ecc71; font-weight: bold;")
                    else:
                        self.balance_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
                except Exception as e:
                    logger.error(f"Error getting customer balance: {e}")
    
    def _validate_form(self) -> bool:
        """Validate form data"""
        if self.customer_combo.currentIndex() < 0:
            QMessageBox.warning(self, "Validation Error", "Please select a customer.")
            return False
        if self.amount_input.value() <= 0:
            QMessageBox.warning(self, "Validation Error", "Amount must be greater than 0.")
            self.amount_input.setFocus()
            return False
        return True
    
    def _on_accept(self) -> None:
        """Handle accept button - use controller method"""
        if not self._validate_form():
            return
        
        try:
            customer_id = self.customer_combo.currentData()
            amount = self.amount_input.value()
            description = self.description_input.toPlainText().strip()
            reference = self.reference_input.text().strip() or None
            payment_method = self.method_combo.currentText()
            
            # Use controller method to add transaction
            transaction_id = self.transaction_controller.add_payment_transaction(
                customer_id=customer_id,
                amount=amount,
                description=description,
                reference=reference,
                payment_method=payment_method
            )
            
            if transaction_id:
                self.accept()
            else:
                QMessageBox.warning(self, "Error", "Failed to add payment transaction.")
        except Exception as e:
            logger.error(f"Error adding payment transaction: {e}")
            QMessageBox.critical(self, "Error", f"Failed to add transaction: {e}")


class CorrectionTransactionDialog(QDialog):
    """Dialog for adding a correction transaction"""
    
    def __init__(self, transaction_controller: TransactionController,
                 main_controller: MainController,
                 original_transaction_id: int,
                 parent: QWidget = None):
        """Initialize correction transaction dialog"""
        super().__init__(parent)
        self.transaction_controller = transaction_controller
        self.main_controller = main_controller
        self.original_transaction_id = original_transaction_id
        self._setup_ui()
        self.setWindowTitle("Add Correction Transaction")
        self.resize(500, 350)
    
    def _setup_ui(self) -> None:
        """Setup the dialog UI"""
        layout = QVBoxLayout(self)
        
        # Load original transaction details
        original_transaction = self.transaction_controller.get_transaction(self.original_transaction_id)
        if not original_transaction:
            QMessageBox.critical(self, "Error", "Original transaction not found.")
            self.reject()
            return
        
        # Original transaction info
        info_group = QGroupBox("Original Transaction Details")
        info_group.setStyleSheet("""
        QGroupBox {
            font-weight: bold;
            font-size: 13px;
            color: #2c3e50;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
            color: #2c3e50;
        }
        """)
        info_layout = QFormLayout(info_group)
        info_layout.addRow("Customer:", QLabel(original_transaction.get('customer_name', 'Unknown')))
        info_layout.addRow("Type:", QLabel(original_transaction.get('type', '')))
        info_layout.addRow("Amount:", QLabel(self.main_controller.format_currency(original_transaction.get('amount', 0))))
        info_layout.addRow("Date:", QLabel(self.main_controller.format_date(original_transaction.get('transaction_date', datetime.now()))))
        info_layout.addRow("Description:", QLabel(original_transaction.get('description', '')))
        layout.addWidget(info_group)
        
        # Correction form
        form_layout = QFormLayout()
        form_layout.setVerticalSpacing(15)
        
        # Correction amount
        form_layout.addWidget(QLabel("Correction Amount (Rs.):"))
        self.amount_input = QDoubleSpinBox()
        self.amount_input.setRange(-1000000, 1000000)
        self.amount_input.setPrefix("Rs. ")
        self.amount_input.setDecimals(2)
        self.amount_input.setValue(0.00)
        # Add explanation about correction amount
        amount_explanation = QLabel("Positive amount increases the original, negative decreases it")
        amount_explanation.setStyleSheet("color: #7f8c8d; font-size: 11px; font-style: italic;")
        amount_layout = QVBoxLayout()
        amount_layout.addWidget(self.amount_input)
        amount_layout.addWidget(amount_explanation)
        form_layout.addRow(amount_layout)
        
        # Reason for correction
        form_layout.addWidget(QLabel("Reason for Correction:"))
        self.reason_input = QTextEdit()
        self.reason_input.setPlaceholderText("Explain why this correction is needed...")
        self.reason_input.setMaximumHeight(80)
        form_layout.addWidget(self.reason_input)
        
        layout.addLayout(form_layout, 1)
        
        # Dialog buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self._on_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _validate_form(self) -> bool:
        """Validate form data"""
        if self.amount_input.value() == 0:
            QMessageBox.warning(self, "Validation Error", "Correction amount cannot be 0.")
            self.amount_input.setFocus()
            return False
        reason = self.reason_input.toPlainText().strip()
        if not reason:
            QMessageBox.warning(self, "Validation Error", "Please provide a reason for the correction.")
            self.reason_input.setFocus()
            return False
        return True
    
    def _on_accept(self) -> None:
        """Handle accept button - use controller method"""
        if not self._validate_form():
            return
        
        try:
            correction_amount = self.amount_input.value()
            reason = self.reason_input.toPlainText().strip()
            
            # Use controller method to add correction
            correction_id = self.transaction_controller.add_correction_transaction(
                original_transaction_id=self.original_transaction_id,
                correction_amount=correction_amount,
                reason=reason
            )
            
            if correction_id:
                self.accept()
            else:
                QMessageBox.warning(self, "Error", "Failed to add correction transaction.")
        except Exception as e:
            logger.error(f"Error adding correction transaction: {e}")
            QMessageBox.critical(self, "Error", f"Failed to add correction: {e}")


class LedgerView(QWidget):
    """Ledger view showing running balances"""
    
    def __init__(self, transaction_controller: TransactionController,
                 customer_controller: CustomerController,
                 main_controller: MainController):
        """Initialize ledger view"""
        super().__init__()
        self.transaction_controller = transaction_controller
        self.customer_controller = customer_controller
        self.main_controller = main_controller
        self._setup_ui()
        logger.info("LedgerView initialized")
    
    def _setup_ui(self) -> None:
        """Setup the ledger UI"""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Header
        header_layout = QHBoxLayout()
        title_label = QLabel("Ledger View")
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #2c3e50;")
        header_layout.addWidget(title_label)
        header_layout.addStretch()
        
        # Customer filter
        header_layout.addWidget(QLabel("Customer:"))
        self.customer_filter = QComboBox()
        self.customer_filter.addItem("All Customers", None)
        self._load_customers_into_filter()
        self.customer_filter.currentIndexChanged.connect(self._refresh_ledger)
        header_layout.addWidget(self.customer_filter)
        
        # Refresh button
        refresh_btn = QPushButton("Refresh")
        refresh_btn.setStyleSheet("""
        QPushButton {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #2980b9;
        }
        """)
        refresh_btn.clicked.connect(self._refresh_ledger)
        header_layout.addWidget(refresh_btn)
        main_layout.addLayout(header_layout)
        
        # Ledger table
        self.ledger_table = QTableWidget()
        self.ledger_table.setColumnCount(7)
        self.ledger_table.setHorizontalHeaderLabels([
            "Date", "Customer", "Type", "Description", "Debit", "Credit", "Balance"
        ])
        self.ledger_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.ledger_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.ledger_table.setAlternatingRowColors(True)
        self.ledger_table.verticalHeader().setVisible(False)
        self.ledger_table.setMinimumHeight(400)
        
        # Set column widths
        header = self.ledger_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # Date
        header.setSectionResizeMode(1, QHeaderView.Stretch)           # Customer
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # Type
        header.setSectionResizeMode(3, QHeaderView.Stretch)           # Description
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # Debit
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # Credit
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)  # Balance
        main_layout.addWidget(self.ledger_table, 1)
        
        # Summary
        summary_layout = QHBoxLayout()
        self.summary_label = QLabel("Total Debit: Rs. 0.00 | Total Credit: Rs. 0.00 | Closing Balance: Rs. 0.00")
        self.summary_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
        summary_layout.addWidget(self.summary_label)
        summary_layout.addStretch()
        main_layout.addLayout(summary_layout)
    
    def _load_customers_into_filter(self) -> None:
        """Load customers into the customer filter dropdown"""
        try:
            customers = self.customer_controller.get_all_customers(include_balance=False)
            for customer in customers:
                self.customer_filter.addItem(customer['name'], customer['id'])
        except Exception as e:
            logger.error(f"Error loading customers for filter: {e}")
    
    @Slot()
    def _refresh_ledger(self) -> None:
        """Refresh ledger data using controller"""
        try:
            customer_id = self.customer_filter.currentData()
            # Use controller method to get ledger entries
            ledger_entries = self.transaction_controller.get_ledger_entries(customer_id)
            
            # Clear table efficiently
            self.ledger_table.setRowCount(0)
            
            total_debit = 0.0
            total_credit = 0.0
            
            for i, entry in enumerate(ledger_entries):
                self.ledger_table.insertRow(i)
                
                # Date
                date_val = entry.get('transaction_date')
                if date_val:
                    if isinstance(date_val, str):
                        date_text = date_val
                    else:
                        date_text = self.main_controller.format_date(date_val)
                else:
                    date_text = "--"
                date_item = QTableWidgetItem(date_text)
                self.ledger_table.setItem(i, 0, date_item)
                
                # Customer
                customer_item = QTableWidgetItem(entry.get('customer_name', 'Unknown'))
                self.ledger_table.setItem(i, 1, customer_item)
                
                # Type
                type_text = entry.get('type', '')
                type_item = QTableWidgetItem(type_text)
                # Color code type
                if type_text == 'CREDIT':
                    type_item.setForeground(QBrush(QColor('#e74c3c')))
                elif type_text == 'PAYMENT':
                    type_item.setForeground(QBrush(QColor('#2ecc71')))
                elif type_text == 'CORRECTION':
                    type_item.setForeground(QBrush(QColor('#f39c12')))
                self.ledger_table.setItem(i, 2, type_item)
                
                # Description
                desc = entry.get('description', '')
                desc_item = QTableWidgetItem(desc)
                self.ledger_table.setItem(i, 3, desc_item)
                
                # Debit (for CREDIT transactions)
                debit = 0.0
                if type_text == 'CREDIT':
                    debit = abs(entry.get('amount', 0))
                    total_debit += debit
                debit_item = QTableWidgetItem(self.main_controller.format_currency(debit))
                if debit > 0:
                    debit_item.setForeground(QBrush(QColor('#e74c3c')))
                self.ledger_table.setItem(i, 4, debit_item)
                
                # Credit (for PAYMENT transactions)
                credit = 0.0
                if type_text == 'PAYMENT':
                    credit = abs(entry.get('amount', 0))
                    total_credit += credit
                credit_item = QTableWidgetItem(self.main_controller.format_currency(credit))
                if credit > 0:
                    credit_item.setForeground(QBrush(QColor('#2ecc71')))
                self.ledger_table.setItem(i, 5, credit_item)
                
                # Balance (running balance)
                running_balance = entry.get('running_balance', 0.0)
                balance_item = QTableWidgetItem(self.main_controller.format_currency(running_balance))
                # Color balance
                if running_balance > 0:
                    balance_item.setForeground(QBrush(QColor('#e74c3c')))
                elif running_balance < 0:
                    balance_item.setForeground(QBrush(QColor('#2ecc71')))
                self.ledger_table.setItem(i, 6, balance_item)
            
            # Update summary
            closing_balance = ledger_entries[-1].get('running_balance', 0.0) if ledger_entries else 0.0
            self.summary_label.setText(
                f"Total Debit: {self.main_controller.format_currency(total_debit)} | "
                f"Total Credit: {self.main_controller.format_currency(total_credit)} | "
                f"Closing Balance: {self.main_controller.format_currency(closing_balance)}"
            )
        except Exception as e:
            logger.error(f"Error refreshing ledger: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load ledger: {e}")
    
    def showEvent(self, event) -> None:
        """Handle show event - refresh data when shown"""
        super().showEvent(event)
        self._refresh_ledger()


# Export the main view classes
__all__ = [
    'TransactionEntryView',
    'TransactionHistoryView',
    'TransactionListView',
    'LedgerView',
    'CreditTransactionDialog',
    'PaymentTransactionDialog',
    'CorrectionTransactionDialog'
]
