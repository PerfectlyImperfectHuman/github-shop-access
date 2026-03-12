"""
Customer views module for the shop management system.
Provides UI components for customer management.
"""

import logging
from datetime import datetime
from PySide6.QtCore import Qt, Signal, QDate
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QLineEdit, QTextEdit,
    QFormLayout, QDialog, QDialogButtonBox, QMessageBox,
    QHeaderView, QComboBox, QGroupBox, QCheckBox, QSizePolicy
)
from PySide6.QtGui import QFont

logger = logging.getLogger(__name__)


class CustomerListView(QWidget):
    """View for listing and managing customers."""
    
    # Removed refresh_requested signal to prevent circular calls
    view_customer_signal = Signal(int)  # customer_id
    
    def __init__(self, parent=None, main_controller=None):
        """
        Initialize the customer list view.
        
        Args:
            parent: Parent widget
            main_controller: Main controller instance
        """
        super().__init__(parent)
        self.main_controller = main_controller
        self.customer_controller = main_controller.customer_controller
        self.transaction_controller = main_controller.transaction_controller
        
        self.setup_ui()
        self.refresh_customers()
        
    def setup_ui(self):
        """Setup the user interface."""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Header
        header_layout = QHBoxLayout()
        
        title_label = QLabel("Customers")
        title_font = QFont()
        title_font.setPointSize(18)  # Increased font size
        title_font.setBold(True)
        title_label.setFont(title_font)
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Add customer button
        self.add_btn = QPushButton("+ Add Customer")
        self.add_btn.setStyleSheet("""
            QPushButton {
                background-color: #2E7D32;  /* Darker green */
                color: white;
                padding: 10px 16px;  /* Increased padding */
                border-radius: 6px;
                font-weight: bold;
                font-size: 14px;  /* Increased font size */
            }
            QPushButton:hover {
                background-color: #1B5E20;  /* Even darker on hover */
            }
        """)
        self.add_btn.clicked.connect(self.add_customer)
        header_layout.addWidget(self.add_btn)
        
        # Refresh button
        refresh_btn = QPushButton("⟳ Refresh")
        refresh_btn.setStyleSheet("""
            QPushButton {
                background-color: #1976D2;  /* Darker blue */
                color: white;
                padding: 10px 16px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #0D47A1;  /* Even darker on hover */
            }
        """)
        refresh_btn.clicked.connect(self.refresh_customers)
        header_layout.addWidget(refresh_btn)
        
        main_layout.addLayout(header_layout)
        
        # Search bar
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("Search:"))
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by name or phone...")
        self.search_input.textChanged.connect(self.filter_customers)
        search_layout.addWidget(self.search_input)
        
        # Active filter
        self.active_filter = QComboBox()
        self.active_filter.addItems(["All Customers", "Active Only", "Inactive Only"])
        self.active_filter.currentTextChanged.connect(self.filter_customers)
        search_layout.addWidget(QLabel("Filter:"))
        search_layout.addWidget(self.active_filter)
        
        main_layout.addLayout(search_layout)
        
        # Customer table
        self.customer_table = QTableWidget()
        self.customer_table.setColumnCount(6)  # Removed separate Delete column
        self.customer_table.setHorizontalHeaderLabels([
            "Name", "Phone", "Current Balance", "Status", "Last Transaction", "Actions"
        ])
        
        # Set size policy to expand and fill available space
        self.customer_table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        
        # Configure horizontal header for proper resizing
        header = self.customer_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Stretch)  # Name takes remaining space
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)  # Phone
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # Balance
        header.setSectionResizeMode(3, QHeaderView.Fixed)  # Status
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # Last Transaction
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # Actions
        
        # Set fixed width for Status column
        self.customer_table.setColumnWidth(3, 80)
        
        self.customer_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.customer_table.setEditTriggers(QTableWidget.NoEditTriggers)
        
        # Increase row height for better visibility
        self.customer_table.verticalHeader().setDefaultSectionSize(50)
        
        # Ensure table expands to fill available space
        main_layout.addWidget(self.customer_table, 1)  # Stretch factor of 1
        
    def refresh_customers(self):
        """Refresh the customer list."""
        try:
            # Get customers with balance included
            customers = self.customer_controller.get_all_customers(include_balance=True, active_only=False)
            self.all_customers = customers
            self.filter_customers()
            
            # Removed: self.refresh_requested.emit() to prevent circular calls
            
        except Exception as e:
            logger.error(f"Error refreshing customers: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load customers: {str(e)}")
            
    def filter_customers(self):
        """Filter customers based on search criteria."""
        try:
            search_text = self.search_input.text().lower()
            filter_type = self.active_filter.currentText()
            
            filtered_customers = []
            for customer in self.all_customers:
                # Apply search filter
                matches_search = (
                    search_text in customer['name'].lower() or
                    (customer['phone'] and search_text in customer['phone'].lower())
                )
                
                # Apply status filter
                matches_status = True
                if filter_type == "Active Only":
                    matches_status = customer['is_active']
                elif filter_type == "Inactive Only":
                    matches_status = not customer['is_active']
                
                if matches_search and matches_status:
                    filtered_customers.append(customer)
            
            self.display_customers(filtered_customers)
            
        except Exception as e:
            logger.error(f"Error filtering customers: {e}")
            # Don't crash the UI - just clear the table
            self.customer_table.setRowCount(0)
            QMessageBox.critical(self, "Error", f"Failed to filter customers: {str(e)}")
            
    def display_customers(self, customers):
        """Display customers in the table."""
        self.customer_table.setRowCount(0)
        
        for row, customer in enumerate(customers):
            self.customer_table.insertRow(row)
            
            # Name - increased font size
            name_item = QTableWidgetItem(customer['name'])
            name_font = QFont()
            name_font.setPointSize(12)  # Increased font size
            name_font.setBold(True)
            name_item.setFont(name_font)
            if not customer['is_active']:
                name_item.setForeground(Qt.gray)
            self.customer_table.setItem(row, 0, name_item)
            
            # Phone
            phone_item = QTableWidgetItem(customer['phone'] or "")
            phone_font = QFont()
            phone_font.setPointSize(11)
            phone_item.setFont(phone_font)
            self.customer_table.setItem(row, 1, phone_item)
            
            # Balance
            balance = customer.get('balance', 0.0)
            balance_item = QTableWidgetItem(self.main_controller.format_currency(balance))
            balance_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            balance_font = QFont()
            balance_font.setPointSize(11)
            balance_item.setFont(balance_font)
            if balance > 0:
                balance_item.setForeground(Qt.red)
            elif balance < 0:
                balance_item.setForeground(Qt.darkGreen)
            self.customer_table.setItem(row, 2, balance_item)
            
            # Status
            status_item = QTableWidgetItem("Active" if customer['is_active'] else "Inactive")
            status_font = QFont()
            status_font.setPointSize(11)
            status_item.setFont(status_font)
            status_item.setTextAlignment(Qt.AlignCenter)
            if customer['is_active']:
                status_item.setForeground(Qt.darkGreen)
            else:
                status_item.setForeground(Qt.gray)
            self.customer_table.setItem(row, 3, status_item)
            
            # Last transaction
            last_trans_date = customer.get('updated_at')
            if last_trans_date:
                try:
                    if isinstance(last_trans_date, datetime):
                        last_trans_str = last_trans_date.strftime("%d/%m/%Y")
                    elif isinstance(last_trans_date, str):
                        # Try to parse string date
                        try:
                            dt = datetime.fromisoformat(last_trans_date.replace('Z', '+00:00'))
                            last_trans_str = dt.strftime("%d/%m/%Y")
                        except:
                            last_trans_str = last_trans_date.split('T')[0] if 'T' in last_trans_date else last_trans_date
                    else:
                        last_trans_str = str(last_trans_date)
                except Exception as e:
                    logger.warning(f"Error formatting date: {e}")
                    last_trans_str = str(last_trans_date)
            else:
                last_trans_str = "N/A"
            
            last_trans_item = QTableWidgetItem(last_trans_str)
            last_trans_font = QFont()
            last_trans_font.setPointSize(11)
            last_trans_item.setFont(last_trans_font)
            self.customer_table.setItem(row, 4, last_trans_item)
            
            # Actions - All buttons in one widget with improved styling
            actions_widget = QWidget()
            actions_layout = QHBoxLayout(actions_widget)
            actions_layout.setContentsMargins(8, 8, 8, 8)  # Increased margins
            actions_layout.setSpacing(15)  # Slightly increased spacing
            
            # View button - Blue background
            view_btn = QPushButton("View")
            view_btn.setStyleSheet("""
                QPushButton {
                    background-color: #1976D2;  /* Dark blue */
                    color: white;
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                }
                QPushButton:hover {
                    background-color: #0D47A1;  /* Darker blue on hover */
                }
            """)
            view_btn.clicked.connect(lambda checked, cid=customer['id']: self.view_customer(cid))
            actions_layout.addWidget(view_btn)
            
            # Edit button - Purple background
            edit_btn = QPushButton("Edit")
            edit_btn.setStyleSheet("""
                QPushButton {
                    background-color: #7B1FA2;  /* Dark purple */
                    color: white;
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                }
                QPushButton:hover {
                    background-color: #4A148C;  /* Darker purple on hover */
                }
            """)
            edit_btn.clicked.connect(lambda checked, cid=customer['id']: self.edit_customer(cid))
            actions_layout.addWidget(edit_btn)
            
            # Toggle status button - Orange/Red/Green based on action
            status_btn_text = "Deactivate" if customer['is_active'] else "Activate"
            if customer['is_active']:
                status_btn_color = "#D3AD2F"  # Dark red for deactivate
                status_btn_hover = "#9A7E23"   # Darker red on hover
            else:
                status_btn_color = "#388E3C"  # Dark green for activate
                status_btn_hover = "#1B5E20"  # Darker green on hover
                
            status_btn = QPushButton(status_btn_text)
            status_btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {status_btn_color};
                    color: white;
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                }}
                QPushButton:hover {{
                    background-color: {status_btn_hover};
                }}
            """)
            status_btn.clicked.connect(lambda checked, cid=customer['id']: self.toggle_customer_status(cid))
            actions_layout.addWidget(status_btn)
            
            # Delete button - Red background (only for customers with no transactions)
            delete_btn = QPushButton("Delete")
            delete_btn.setStyleSheet("""
                QPushButton {
                    background-color: #D32F2F;  /* Dark red */
                    color: white;
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                }
                QPushButton:hover {
                    background-color: #B71C1C;  /* Darker red on hover */
                }
                QPushButton:disabled {
                    background-color: #9E9E9E;  /* Gray when disabled */
                    color: white;
                }
            """)
            delete_btn.setEnabled(False)  # Disabled by default
            
            # Check if customer can be deleted (no transactions)
            try:
                transactions = self.transaction_controller.get_customer_transactions(customer['id'], limit=1)
                if len(transactions) == 0:
                    delete_btn.setEnabled(True)
                    delete_btn.clicked.connect(lambda checked, cid=customer['id']: self.delete_customer(cid))
            except Exception as e:
                logger.warning(f"Error checking transactions for customer {customer['id']}: {e}")
            
            actions_layout.addWidget(delete_btn)
            
            actions_layout.addStretch()
            self.customer_table.setCellWidget(row, 5, actions_widget)
        
        # REMOVED: self.customer_table.resizeColumnsToContents() - this was causing the width issues
        
    def add_customer(self):
        """Open dialog to add a new customer."""
        dialog = CustomerFormDialog(self, self.customer_controller, self.main_controller)
        if dialog.exec() == QDialog.Accepted:
            self.refresh_customers()
            
    def view_customer(self, customer_id):
        """Open dialog to view customer details."""
        dialog = CustomerDetailView(customer_id, self.customer_controller, 
                                  self.transaction_controller, self.main_controller, self)
        dialog.exec()
        
    def edit_customer(self, customer_id):
        """Open dialog to edit customer."""
        dialog = CustomerFormDialog(self, self.customer_controller, 
                                  self.main_controller, customer_id)
        if dialog.exec() == QDialog.Accepted:
            self.refresh_customers()
            
    def toggle_customer_status(self, customer_id):
        """Toggle customer active/inactive status."""
        try:
            customer = self.customer_controller.get_customer(customer_id)
            if not customer:
                QMessageBox.warning(self, "Error", "Customer not found.")
                return
                
            new_status = not customer['is_active']
            
            # Confirm action
            action = "deactivate" if not new_status else "activate"
            reply = QMessageBox.question(
                self, f"Confirm {action}",
                f"Are you sure you want to {action} {customer['name']}?",
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                success = self.customer_controller.update_customer(customer_id, is_active=new_status)
                if success:
                    self.refresh_customers()
                else:
                    QMessageBox.critical(self, "Error", "Failed to update customer status.")
                
        except Exception as e:
            logger.error(f"Error toggling customer status: {e}")
            QMessageBox.critical(self, "Error", f"Failed to update customer: {str(e)}")
            
    def delete_customer(self, customer_id):
        """Delete customer (only if they have no transactions)."""
        try:
            customer = self.customer_controller.get_customer(customer_id)
            if not customer:
                QMessageBox.warning(self, "Error", "Customer not found.")
                return
                
            # Confirm deletion
            reply = QMessageBox.warning(
                self,
                "Confirm Delete",
                f"Are you sure you want to delete customer '{customer['name']}'?\n\n"
                "This action cannot be undone and is only allowed for customers with no transactions.",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                success = self.customer_controller.delete_customer(customer_id)
                if success:
                    self.refresh_customers()
                    QMessageBox.information(self, "Success", "Customer deleted successfully.")
                else:
                    QMessageBox.critical(self, "Error", "Failed to delete customer.\nCustomer may have transactions.")
                
        except Exception as e:
            logger.error(f"Error deleting customer: {e}")
            QMessageBox.critical(self, "Error", f"Failed to delete customer: {str(e)}")


class CustomerFormDialog(QDialog):
    """Dialog for adding/editing customers."""
    
    def __init__(self, parent=None, customer_controller=None, main_controller=None, customer_id=None):
        """
        Initialize the customer form dialog.
        
        Args:
            parent: Parent widget
            customer_controller: Customer controller instance
            main_controller: Main controller instance (for formatting)
            customer_id: Customer ID for editing (None for new customer)
        """
        super().__init__(parent)
        self.customer_controller = customer_controller
        self.main_controller = main_controller
        self.customer_id = customer_id
        self.is_edit_mode = customer_id is not None
        
        self.setup_ui()
        if self.is_edit_mode:
            self.load_customer_data()
            
    def setup_ui(self):
        """Setup the dialog UI."""
        self.setWindowTitle("Edit Customer" if self.is_edit_mode else "Add Customer")
        self.setMinimumWidth(450)  # Slightly wider
        
        layout = QVBoxLayout(self)
        
        # Form layout
        form_layout = QFormLayout()
        
        # Name field
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Enter customer name")
        form_layout.addRow("Name:", self.name_input)
        
        # Phone field
        self.phone_input = QLineEdit()
        self.phone_input.setPlaceholderText("Enter phone number")
        form_layout.addRow("Phone:", self.phone_input)
        
        # Notes field
        self.notes_input = QTextEdit()
        self.notes_input.setMaximumHeight(120)  # Slightly taller
        self.notes_input.setPlaceholderText("Enter any notes...")
        form_layout.addRow("Notes:", self.notes_input)
        
        # Status checkbox (only for edit mode)
        if self.is_edit_mode:
            self.active_checkbox = QCheckBox("Active")
            self.active_checkbox.setChecked(True)
            form_layout.addRow("Status:", self.active_checkbox)
        
        layout.addLayout(form_layout)
        
        # Buttons
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        button_box.accepted.connect(self.save_customer)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
        
    def load_customer_data(self):
        """Load customer data for editing."""
        try:
            customer = self.customer_controller.get_customer(self.customer_id)
            if not customer:
                QMessageBox.critical(self, "Error", "Customer not found.")
                self.reject()
                return
                
            self.name_input.setText(customer['name'])
            self.phone_input.setText(customer['phone'] or "")
            self.notes_input.setPlainText(customer['notes'] or "")
            if self.is_edit_mode:
                self.active_checkbox.setChecked(customer['is_active'])
        except Exception as e:
            logger.error(f"Error loading customer data: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load customer: {str(e)}")
            self.reject()
            
    def save_customer(self):
        """Save customer data."""
        try:
            name = self.name_input.text().strip()
            phone = self.phone_input.text().strip() or None
            notes = self.notes_input.toPlainText().strip() or None
            
            if not name:
                QMessageBox.warning(self, "Validation Error", "Name is required.")
                return
            
            if self.is_edit_mode:
                # Update existing customer
                is_active = self.active_checkbox.isChecked()
                success = self.customer_controller.update_customer(
                    self.customer_id, name=name, phone=phone, notes=notes, is_active=is_active
                )
                if success:
                    self.accept()
                else:
                    QMessageBox.critical(self, "Error", "Failed to update customer.")
            else:
                # Create new customer
                customer_id = self.customer_controller.add_customer(name, phone, notes)
                if customer_id:
                    self.accept()
                else:
                    QMessageBox.critical(self, "Error", "Failed to add customer.")
            
        except Exception as e:
            logger.error(f"Error saving customer: {e}")
            QMessageBox.critical(self, "Error", f"Failed to save customer: {str(e)}")


class CustomerDetailView(QDialog):
    """Dialog for viewing customer details and transaction history."""
    
    def __init__(self, customer_id, customer_controller, transaction_controller, main_controller, parent=None):
        """
        Initialize the customer detail view.
        
        Args:
            customer_id: Customer ID
            customer_controller: Customer controller instance
            transaction_controller: Transaction controller instance
            main_controller: Main controller instance
            parent: Parent widget
        """
        super().__init__(parent)
        self.customer_id = customer_id
        self.customer_controller = customer_controller
        self.transaction_controller = transaction_controller
        self.main_controller = main_controller
        
        self.setup_ui()
        self.load_customer_details()
        
    def setup_ui(self):
        """Setup the dialog UI."""
        self.setWindowTitle("Customer Details")
        self.setMinimumSize(850, 650)  # Slightly larger
        
        layout = QVBoxLayout(self)
        
        # Customer info section
        info_group = QGroupBox("Customer Information")
        info_layout = QFormLayout()
        
        self.name_label = QLabel()
        name_font = QFont()
        name_font.setPointSize(14)
        name_font.setBold(True)
        self.name_label.setFont(name_font)
        self.phone_label = QLabel()
        self.status_label = QLabel()
        self.balance_label = QLabel()
        balance_font = QFont()
        balance_font.setPointSize(13)
        balance_font.setBold(True)
        self.balance_label.setFont(balance_font)
        self.notes_label = QLabel()
        self.notes_label.setWordWrap(True)
        self.notes_label.setMinimumHeight(60)
        
        info_layout.addRow("Name:", self.name_label)
        info_layout.addRow("Phone:", self.phone_label)
        info_layout.addRow("Status:", self.status_label)
        info_layout.addRow("Current Balance:", self.balance_label)
        info_layout.addRow("Notes:", self.notes_label)
        
        info_group.setLayout(info_layout)
        layout.addWidget(info_group)
        
        # Transaction history
        history_label = QLabel("Transaction History")
        history_font = QFont()
        history_font.setPointSize(14)
        history_font.setBold(True)
        history_label.setFont(history_font)
        layout.addWidget(history_label)
        
        self.transaction_table = QTableWidget()
        self.transaction_table.setColumnCount(5)
        self.transaction_table.setHorizontalHeaderLabels([
            "Date", "Type", "Amount", "Description", "Balance"
        ])
        self.transaction_table.horizontalHeader().setStretchLastSection(False)
        self.transaction_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        
        # Increase row height
        self.transaction_table.verticalHeader().setDefaultSectionSize(40)
        
        layout.addWidget(self.transaction_table)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        add_credit_btn = QPushButton("Add Credit")
        add_credit_btn.setStyleSheet("""
            QPushButton {
                background-color: #D32F2F;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #B71C1C;
            }
        """)
        add_credit_btn.clicked.connect(self.add_credit)
        button_layout.addWidget(add_credit_btn)
        
        add_payment_btn = QPushButton("Add Payment")
        add_payment_btn.setStyleSheet("""
            QPushButton {
                background-color: #388E3C;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #1B5E20;
            }
        """)
        add_payment_btn.clicked.connect(self.add_payment)
        button_layout.addWidget(add_payment_btn)
        
        add_correction_btn = QPushButton("Add Correction")
        add_correction_btn.setStyleSheet("""
            QPushButton {
                background-color: #1976D2;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #0D47A1;
            }
        """)
        add_correction_btn.clicked.connect(self.add_correction)
        button_layout.addWidget(add_correction_btn)
        
        button_layout.addStretch()
        
        close_btn = QPushButton("Close")
        close_btn.setStyleSheet("""
            QPushButton {
                background-color: #757575;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #616161;
            }
        """)
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
        
    def load_customer_details(self):
        """Load customer details and transaction history."""
        try:
            customer = self.customer_controller.get_customer(self.customer_id)
            if not customer:
                QMessageBox.critical(self, "Error", "Customer not found.")
                return
                
            # Update info labels
            self.name_label.setText(customer['name'])
            self.phone_label.setText(customer['phone'] or "N/A")
            self.status_label.setText("Active" if customer['is_active'] else "Inactive")
            
            # Balance with color coding
            balance = customer.get('balance', 0.0)
            balance_text = self.main_controller.format_currency(balance)
            self.balance_label.setText(balance_text)
            if balance > 0:
                self.balance_label.setStyleSheet("color: red; font-weight: bold;")
            elif balance < 0:
                self.balance_label.setStyleSheet("color: darkgreen; font-weight: bold;")
            else:
                self.balance_label.setStyleSheet("font-weight: bold;")
            
            self.notes_label.setText(customer['notes'] or "No notes")
            
            # Load transactions
            if self.transaction_controller:
                transactions = self.transaction_controller.get_customer_transactions(
                    customer_id=self.customer_id
                )
                self.display_transactions(transactions, balance)
                
        except Exception as e:
            logger.error(f"Error loading customer details: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load customer details: {str(e)}")
            
    def display_transactions(self, transactions, current_balance):
        """Display transactions in the table."""
        self.transaction_table.setRowCount(0)
        
        # Calculate running balance backwards
        running_balance = current_balance
        
        for row, transaction in enumerate(reversed(transactions)):
            self.transaction_table.insertRow(row)
            
            # Adjust running balance based on transaction type
            if transaction['type'] == "CREDIT":
                running_balance -= transaction['amount']
            elif transaction['type'] == "PAYMENT":
                running_balance += transaction['amount']
            else:  # CORRECTION
                running_balance -= transaction['amount']
            
            # Date
            transaction_date = transaction['transaction_date']
            if isinstance(transaction_date, datetime):
                date_str = self.main_controller.format_date(transaction_date)
            else:
                try:
                    if isinstance(transaction_date, str):
                        # Try to parse string date
                        dt = datetime.fromisoformat(transaction_date.replace('Z', '+00:00'))
                        date_str = self.main_controller.format_date(dt)
                    else:
                        date_str = str(transaction_date) if transaction_date else ""
                except:
                    date_str = str(transaction_date) if transaction_date else ""
            
            date_item = QTableWidgetItem(date_str)
            date_font = QFont()
            date_font.setPointSize(11)
            date_item.setFont(date_font)
            
            # Type with color coding
            type_item = QTableWidgetItem(transaction['type'])
            type_font = QFont()
            type_font.setPointSize(11)
            type_font.setBold(True)
            type_item.setFont(type_font)
            if transaction['type'] == "CREDIT":
                type_item.setForeground(Qt.red)
            elif transaction['type'] == "PAYMENT":
                type_item.setForeground(Qt.darkGreen)
            else:
                type_item.setForeground(Qt.blue)
            
            # Amount
            amount_item = QTableWidgetItem(self.main_controller.format_currency(transaction['amount']))
            amount_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            amount_font = QFont()
            amount_font.setPointSize(11)
            amount_item.setFont(amount_font)
            
            # Description
            desc_item = QTableWidgetItem(transaction.get('description', ''))
            desc_font = QFont()
            desc_font.setPointSize(11)
            desc_item.setFont(desc_font)
            
            # Running balance
            balance_item = QTableWidgetItem(self.main_controller.format_currency(running_balance))
            balance_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            balance_font = QFont()
            balance_font.setPointSize(11)
            balance_font.setBold(True)
            balance_item.setFont(balance_font)
            
            # Color code balance
            if running_balance > 0:
                balance_item.setForeground(Qt.red)
            elif running_balance < 0:
                balance_item.setForeground(Qt.darkGreen)
            
            # Set items
            self.transaction_table.setItem(row, 0, date_item)
            self.transaction_table.setItem(row, 1, type_item)
            self.transaction_table.setItem(row, 2, amount_item)
            self.transaction_table.setItem(row, 3, desc_item)
            self.transaction_table.setItem(row, 4, balance_item)
        
        # Resize columns
        self.transaction_table.resizeColumnsToContents()
        
    def add_credit(self):
        """Open dialog to add credit."""
        try:
            from app.views.transaction_views import CreditTransactionDialog
            dialog = CreditTransactionDialog(
                self.transaction_controller,
                self.customer_controller,
                self.main_controller,
                self
            )
            dialog.customer_combo.setCurrentText(self.name_label.text())
            if dialog.exec() == QDialog.Accepted:
                self.load_customer_details()
        except ImportError:
            QMessageBox.warning(self, "Feature Not Available", "Transaction dialogs not available.")
            
    def add_payment(self):
        """Open dialog to add payment."""
        try:
            from app.views.transaction_views import PaymentTransactionDialog
            dialog = PaymentTransactionDialog(
                self.transaction_controller,
                self.customer_controller,
                self.main_controller,
                self
            )
            dialog.customer_combo.setCurrentText(self.name_label.text())
            if dialog.exec() == QDialog.Accepted:
                self.load_customer_details()
        except ImportError:
            QMessageBox.warning(self, "Feature Not Available", "Transaction dialogs not available.")
            
    def add_correction(self):
        """Open dialog to add correction."""
        try:
            from app.views.transaction_views import CorrectionTransactionDialog
            QMessageBox.information(self, "Correction", "Please select a transaction to correct from the Transaction History tab.")
        except ImportError:
            QMessageBox.warning(self, "Feature Not Available", "Correction dialogs not available.")
