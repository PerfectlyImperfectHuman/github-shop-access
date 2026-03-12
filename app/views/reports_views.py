"""
Reports and Statements Views
Includes customer statements, financial reports, and export functionality.
"""

import logging
import os
import csv
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, date, timedelta
from pathlib import Path
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QPushButton,
    QLineEdit, QTextEdit, QTableWidget, QTableWidgetItem, QHeaderView,
    QFrame, QSplitter, QGroupBox, QFormLayout, QMessageBox, QDialog,
    QDialogButtonBox, QComboBox, QDateEdit, QTabWidget, QScrollArea,
    QAbstractItemView, QCheckBox, QToolBar, QStatusBar, QApplication,
    QSizePolicy, QSpacerItem, QDoubleSpinBox, QRadioButton, QButtonGroup,
    QDialog, QListWidget, QListWidgetItem, QProgressBar, QFileDialog,
    QTextBrowser, QTextEdit, QProgressDialog, QSpinBox
)
from PySide6.QtCore import Qt, Signal, Slot, QDate, QTimer, QSize, QDateTime, QThread
from PySide6.QtGui import QFont, QColor, QBrush, QAction, QIcon, QPalette, QTextDocument, QTextCursor

from app.controllers.transaction_controller import TransactionController
from app.controllers.customer_controller import CustomerController
from app.controllers.main_controller import MainController

logger = logging.getLogger(__name__)


class ReportsView(QWidget):
    """Main reports view with different report types and export options"""
    
    # Signals
    report_generated = Signal(str, str)  # report_type, file_path
    export_completed = Signal(str)  # file_path
    
    def __init__(self, transaction_controller: TransactionController,
                 customer_controller: CustomerController,
                 main_controller: MainController):
        """Initialize reports view"""
        super().__init__()
        
        self.transaction_controller = transaction_controller
        self.customer_controller = customer_controller
        self.main_controller = main_controller
        
        self._setup_ui()
        self._connect_signals()
        
        logger.info("ReportsView initialized")
    
    def _setup_ui(self) -> None:
        """Setup the reports UI"""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Header with title
        self._create_header(main_layout)
        
        # Create tab widget for different report types
        self.tab_widget = QTabWidget()
        
        # Customer Statements tab
        self._create_customer_statements_tab()
        
        # Financial Reports tab
        self._create_financial_reports_tab()
        
        # Export tab
        self._create_export_tab()
        
        main_layout.addWidget(self.tab_widget, 1)
    
    def _create_header(self, parent_layout: QVBoxLayout) -> None:
        """Create header with title"""
        header_layout = QHBoxLayout()
        
        # Title
        title_label = QLabel("Reports & Statements")
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Last generated label
        self.last_generated_label = QLabel("Last generated: --")
        self.last_generated_label.setStyleSheet("color: #7f8c8d;")
        header_layout.addWidget(self.last_generated_label)
        
        parent_layout.addLayout(header_layout)
    
    def _create_customer_statements_tab(self) -> None:
        """Create customer statements tab"""
        statements_tab = QWidget()
        statements_layout = QVBoxLayout(statements_tab)
        statements_layout.setContentsMargins(10, 10, 10, 10)
        statements_layout.setSpacing(15)
        
        # Customer selection section
        selection_group = QGroupBox("Customer Statement")
        selection_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
                color: #2c3e50;
            }
        """)
        
        selection_layout = QGridLayout(selection_group)
        selection_layout.setVerticalSpacing(10)
        selection_layout.setHorizontalSpacing(15)
        
        # Customer selection
        selection_layout.addWidget(QLabel("Customer:"), 0, 0)
        self.statement_customer_combo = QComboBox()
        self._load_customers_into_combo(self.statement_customer_combo)
        selection_layout.addWidget(self.statement_customer_combo, 0, 1, 1, 3)
        
        # Date range
        selection_layout.addWidget(QLabel("From Date:"), 1, 0)
        self.statement_from_date = QDateEdit()
        self.statement_from_date.setCalendarPopup(True)
        self.statement_from_date.setDate(QDate.currentDate().addMonths(-1))
        selection_layout.addWidget(self.statement_from_date, 1, 1)
        
        selection_layout.addWidget(QLabel("To Date:"), 1, 2)
        self.statement_to_date = QDateEdit()
        self.statement_to_date.setCalendarPopup(True)
        self.statement_to_date.setDate(QDate.currentDate())
        selection_layout.addWidget(self.statement_to_date, 1, 3)
        
        # Buttons
        buttons_layout = QHBoxLayout()
        
        preview_btn = QPushButton("Preview Statement")
        preview_btn.setStyleSheet("""
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
        preview_btn.clicked.connect(self._preview_statement)
        buttons_layout.addWidget(preview_btn)
        
        generate_btn = QPushButton("Generate PDF")
        generate_btn.setStyleSheet("""
            QPushButton {
                background-color: #e74c3c;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #c0392b;
            }
        """)
        generate_btn.clicked.connect(self._generate_pdf_statement)
        buttons_layout.addWidget(generate_btn)
        
        export_btn = QPushButton("Export CSV")
        export_btn.setStyleSheet("""
            QPushButton {
                background-color: #2ecc71;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #27ae60;
            }
        """)
        export_btn.clicked.connect(self._export_csv_statement)
        buttons_layout.addWidget(export_btn)
        
        selection_layout.addLayout(buttons_layout, 2, 0, 1, 4)
        
        statements_layout.addWidget(selection_group)
        
        # Preview area
        preview_group = QGroupBox("Statement Preview")
        preview_group.setStyleSheet(selection_group.styleSheet())
        
        preview_layout = QVBoxLayout(preview_group)
        
        self.statement_preview = QTextBrowser()
        self.statement_preview.setMinimumHeight(300)
        self.statement_preview.setStyleSheet("""
            QTextBrowser {
                background-color: white;
                border: 1px solid #bdc3c7;
                border-radius: 4px;
                padding: 10px;
                font-family: monospace;
            }
        """)
        preview_layout.addWidget(self.statement_preview)
        
        statements_layout.addWidget(preview_group, 1)
        
        self.tab_widget.addTab(statements_tab, "Customer Statements")
    
    def _create_financial_reports_tab(self) -> None:
        """Create financial reports tab"""
        financial_tab = QWidget()
        financial_layout = QVBoxLayout(financial_tab)
        financial_layout.setContentsMargins(10, 10, 10, 10)
        financial_layout.setSpacing(15)
        
        # Report type selection
        report_type_group = QGroupBox("Report Type")
        report_type_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
                color: #2c3e50;
            }
        """)
        
        report_type_layout = QGridLayout(report_type_group)
        
        # Report type selection
        self.report_type_combo = QComboBox()
        self.report_type_combo.addItems([
            "Daily Summary",
            "Weekly Summary", 
            "Monthly Summary",
            "Yearly Summary",
            "Customer Balance Summary",
            "Transaction Analysis"
        ])
        report_type_layout.addWidget(QLabel("Report Type:"), 0, 0)
        report_type_layout.addWidget(self.report_type_combo, 0, 1)
        
        # Date selection (for time-based reports)
        report_type_layout.addWidget(QLabel("Date:"), 1, 0)
        self.report_date = QDateEdit()
        self.report_date.setCalendarPopup(True)
        self.report_date.setDate(QDate.currentDate())
        report_type_layout.addWidget(self.report_date, 1, 1)
        
        # Month selection (for monthly reports)
        report_type_layout.addWidget(QLabel("Month:"), 2, 0)
        self.report_month = QComboBox()
        months = ["January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"]
        self.report_month.addItems(months)
        self.report_month.setCurrentIndex(QDate.currentDate().month() - 1)
        report_type_layout.addWidget(self.report_month, 2, 1)
        
        # Year selection
        report_type_layout.addWidget(QLabel("Year:"), 3, 0)
        self.report_year = QSpinBox()
        self.report_year.setRange(2000, 2100)
        self.report_year.setValue(QDate.currentDate().year())
        report_type_layout.addWidget(self.report_year, 3, 1)
        
        # Generate button
        generate_report_btn = QPushButton("Generate Report")
        generate_report_btn.setStyleSheet("""
            QPushButton {
                background-color: #9b59b6;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #8e44ad;
            }
        """)
        generate_report_btn.clicked.connect(self._generate_financial_report)
        report_type_layout.addWidget(generate_report_btn, 4, 0, 1, 2)
        
        financial_layout.addWidget(report_type_group)
        
        # Report results area
        results_group = QGroupBox("Report Results")
        results_group.setStyleSheet(report_type_group.styleSheet())
        
        results_layout = QVBoxLayout(results_group)
        
        # Report table
        self.report_table = QTableWidget()
        self.report_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.report_table.setAlternatingRowColors(True)
        self.report_table.verticalHeader().setVisible(False)
        results_layout.addWidget(self.report_table, 1)
        
        # Summary labels
        summary_layout = QHBoxLayout()
        
        self.report_summary_label = QLabel("Summary: --")
        self.report_summary_label.setStyleSheet("color: #2c3e50; font-weight: bold;")
        summary_layout.addWidget(self.report_summary_label)
        
        summary_layout.addStretch()
        
        export_report_btn = QPushButton("Export Report")
        export_report_btn.setStyleSheet("""
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
        export_report_btn.clicked.connect(self._export_report)
        summary_layout.addWidget(export_report_btn)
        
        results_layout.addLayout(summary_layout)
        
        financial_layout.addWidget(results_group, 1)
        
        self.tab_widget.addTab(financial_tab, "Financial Reports")
    
    def _create_export_tab(self) -> None:
        """Create export tab for bulk data export"""
        export_tab = QWidget()
        export_layout = QVBoxLayout(export_tab)
        export_layout.setContentsMargins(10, 10, 10, 10)
        export_layout.setSpacing(15)
        
        # Export options
        options_group = QGroupBox("Export Options")
        options_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
                color: #2c3e50;
            }
        """)
        
        options_layout = QGridLayout(options_group)
        options_layout.setVerticalSpacing(10)
        
        # Export type
        options_layout.addWidget(QLabel("Export Type:"), 0, 0)
        self.export_type_combo = QComboBox()
        self.export_type_combo.addItems([
            "All Customers",
            "All Transactions",
            "Customer Balances",
            "Monthly Report",
            "Database Backup"
        ])
        options_layout.addWidget(self.export_type_combo, 0, 1)
        
        # Date range
        options_layout.addWidget(QLabel("From Date:"), 1, 0)
        self.export_from_date = QDateEdit()
        self.export_from_date.setCalendarPopup(True)
        self.export_from_date.setDate(QDate.currentDate().addMonths(-1))
        options_layout.addWidget(self.export_from_date, 1, 1)
        
        options_layout.addWidget(QLabel("To Date:"), 1, 2)
        self.export_to_date = QDateEdit()
        self.export_to_date.setCalendarPopup(True)
        self.export_to_date.setDate(QDate.currentDate())
        options_layout.addWidget(self.export_to_date, 1, 3)
        
        # Format selection
        options_layout.addWidget(QLabel("Format:"), 2, 0)
        self.export_format_combo = QComboBox()
        self.export_format_combo.addItems(["CSV", "JSON", "Excel (XLSX)", "PDF"])
        options_layout.addWidget(self.export_format_combo, 2, 1)
        
        # Include options
        self.include_transactions_check = QCheckBox("Include transaction history")
        self.include_transactions_check.setChecked(True)
        options_layout.addWidget(self.include_transactions_check, 3, 0, 1, 2)
        
        self.include_summary_check = QCheckBox("Include summary statistics")
        self.include_summary_check.setChecked(True)
        options_layout.addWidget(self.include_summary_check, 3, 2, 1, 2)
        
        # Export button
        export_btn = QPushButton("Export Data")
        export_btn.setStyleSheet("""
            QPushButton {
                background-color: #2ecc71;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #27ae60;
            }
        """)
        export_btn.clicked.connect(self._perform_bulk_export)
        options_layout.addWidget(export_btn, 4, 0, 1, 4)
        
        export_layout.addWidget(options_group)
        
        # Export status area
        status_group = QGroupBox("Export Status")
        status_group.setStyleSheet(options_group.styleSheet())
        
        status_layout = QVBoxLayout(status_group)
        
        self.export_status_label = QLabel("Ready to export")
        self.export_status_label.setStyleSheet("color: #2c3e50;")
        status_layout.addWidget(self.export_status_label)
        
        self.export_progress = QProgressBar()
        self.export_progress.setRange(0, 100)
        self.export_progress.setValue(0)
        status_layout.addWidget(self.export_progress)
        
        self.export_details = QTextBrowser()
        self.export_details.setMaximumHeight(150)
        self.export_details.setStyleSheet("""
            QTextBrowser {
                background-color: white;
                border: 1px solid #bdc3c7;
                border-radius: 4px;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
            }
        """)
        status_layout.addWidget(self.export_details)
        
        export_layout.addWidget(status_group, 1)
        
        self.tab_widget.addTab(export_tab, "Bulk Export")
    
    def _load_customers_into_combo(self, combo: QComboBox) -> None:
        """Load customers into a combo box"""
        try:
            combo.clear()
            customers = self.customer_controller.get_all_customers(include_balance=True)
            for customer in customers:
                combo.addItem(
                    f"{customer['name']} (Balance: {self.main_controller.format_currency(customer.get('balance', 0))})",
                    customer['id']
                )
        except Exception as e:
            logger.error(f"Error loading customers: {e}")
    
    def _connect_signals(self) -> None:
        """Connect signals"""
        self.report_generated.connect(self._on_report_generated)
        self.export_completed.connect(self._on_export_completed)
    
    @Slot()
    def _preview_statement(self) -> None:
        """Preview customer statement"""
        try:
            customer_index = self.statement_customer_combo.currentIndex()
            if customer_index < 0:
                QMessageBox.warning(self, "Warning", "Please select a customer.")
                return
            
            customer_id = self.statement_customer_combo.currentData()
            from_date = self.statement_from_date.date().toPython()
            to_date = self.statement_to_date.date().toPython()
            
            # Get customer statement
            statement = self.transaction_controller.get_customer_statement(
                customer_id, from_date, to_date
            )
            
            # Format statement for preview
            preview_text = self._format_statement_for_preview(statement)
            self.statement_preview.setHtml(preview_text)
            
            logger.debug(f"Previewed statement for customer {customer_id}")
            
        except Exception as e:
            logger.error(f"Error previewing statement: {e}")
            QMessageBox.critical(self, "Error", f"Failed to preview statement: {e}")
    
    def _format_statement_for_preview(self, statement: Dict[str, Any]) -> str:
        """Format statement data as HTML for preview"""
        try:
            customer_name = statement.get('customer_name', 'Unknown Customer')
            from_date = statement.get('from_date', 'Beginning')
            to_date = statement.get('to_date', 'Current')
            
            html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; color: #333; }}
                    h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
                    h2 {{ color: #34495e; }}
                    table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                    th {{ background-color: #3498db; color: white; text-align: left; padding: 10px; }}
                    td {{ padding: 8px; border-bottom: 1px solid #ddd; }}
                    tr:nth-child(even) {{ background-color: #f2f2f2; }}
                    .summary {{ background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                    .positive {{ color: #e74c3c; font-weight: bold; }}
                    .negative {{ color: #2ecc71; font-weight: bold; }}
                    .total {{ font-weight: bold; font-size: 14px; }}
                </style>
            </head>
            <body>
                <h1>Customer Statement</h1>
                <h2>{customer_name}</h2>
                <p><strong>Period:</strong> {from_date} to {to_date}</p>
                
                <div class="summary">
                    <h3>Summary</h3>
                    <p><strong>Opening Balance:</strong> {self.main_controller.format_currency(statement.get('opening_balance', 0))}</p>
                    <p><strong>Total Credit:</strong> {self.main_controller.format_currency(statement.get('total_credit', 0))}</p>
                    <p><strong>Total Payment:</strong> {self.main_controller.format_currency(statement.get('total_payment', 0))}</p>
                    <p><strong>Closing Balance:</strong> {self.main_controller.format_currency(statement.get('closing_balance', 0))}</p>
                </div>
                
                <h3>Transaction History</h3>
            """
            
            transactions = statement.get('transactions', [])
            if transactions:
                html += """
                <table>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Balance</th>
                    </tr>
                """
                
                for tx in transactions:
                    tx_date = tx.get('transaction_date', '')
                    if isinstance(tx_date, datetime):
                        tx_date = tx_date.strftime("%d/%m/%Y")
                    
                    tx_type = tx.get('type', '')
                    amount = tx.get('amount', 0)
                    balance = tx.get('running_balance', 0)
                    
                    amount_class = "positive" if tx_type == 'CREDIT' else "negative" if tx_type == 'PAYMENT' else ""
                    balance_class = "positive" if balance > 0 else "negative" if balance < 0 else ""
                    
                    html += f"""
                    <tr>
                        <td>{tx_date}</td>
                        <td>{tx_type}</td>
                        <td>{tx.get('description', '')}</td>
                        <td class="{amount_class}">{self.main_controller.format_currency(amount)}</td>
                        <td class="{balance_class}">{self.main_controller.format_currency(balance)}</td>
                    </tr>
                    """
                
                html += "</table>"
            else:
                html += "<p>No transactions in this period.</p>"
            
            html += """
                <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #bdc3c7;">
                    <p><strong>Generated on:</strong> """ + datetime.now().strftime("%d/%m/%Y %H:%M") + """</p>
                    <p><strong>Software:</strong> Shop Management System - Udhaar Management</p>
                </div>
            </body>
            </html>
            """
            
            return html
            
        except Exception as e:
            logger.error(f"Error formatting statement preview: {e}")
            return f"<h3>Error formatting statement: {e}</h3>"
    
    @Slot()
    def _generate_pdf_statement(self) -> None:
        """Generate PDF statement"""
        # TODO: Implement PDF generation
        QMessageBox.information(self, "PDF Generation", 
                               "PDF generation will be implemented in a future update.")
    
    @Slot()
    def _export_csv_statement(self) -> None:
        """Export statement as CSV"""
        try:
            customer_index = self.statement_customer_combo.currentIndex()
            if customer_index < 0:
                QMessageBox.warning(self, "Warning", "Please select a customer.")
                return
            
            customer_id = self.statement_customer_combo.currentData()
            customer_name = self.statement_customer_combo.currentText().split(' (')[0]
            from_date = self.statement_from_date.date().toPython()
            to_date = self.statement_to_date.date().toPython()
            
            # Get file path
            default_name = f"statement_{customer_name}_{from_date.strftime('%Y%m%d')}_{to_date.strftime('%Y%m%d')}.csv"
            file_path, _ = QFileDialog.getSaveFileName(
                self, "Export Statement as CSV", default_name, "CSV Files (*.csv)"
            )
            
            if not file_path:
                return
            
            # Export statement
            success = self.transaction_controller.export_statement(
                customer_id, file_path, from_date, to_date
            )
            
            if success:
                QMessageBox.information(self, "Success", f"Statement exported to:\n{file_path}")
                self.last_generated_label.setText(f"Last generated: {datetime.now().strftime('%H:%M:%S')}")
                self.report_generated.emit("statement", file_path)
            else:
                QMessageBox.warning(self, "Error", "Failed to export statement.")
                
        except Exception as e:
            logger.error(f"Error exporting statement: {e}")
            QMessageBox.critical(self, "Error", f"Failed to export statement: {e}")
    
    @Slot()
    def _generate_financial_report(self) -> None:
        """Generate financial report"""
        try:
            report_type = self.report_type_combo.currentText()
            
            if report_type == "Daily Summary":
                self._generate_daily_summary()
            elif report_type == "Weekly Summary":
                self._generate_weekly_summary()
            elif report_type == "Monthly Summary":
                self._generate_monthly_summary()
            elif report_type == "Yearly Summary":
                self._generate_yearly_summary()
            elif report_type == "Customer Balance Summary":
                self._generate_customer_balance_summary()
            elif report_type == "Transaction Analysis":
                self._generate_transaction_analysis()
                
        except Exception as e:
            logger.error(f"Error generating financial report: {e}")
            QMessageBox.critical(self, "Error", f"Failed to generate report: {e}")
    
    def _generate_daily_summary(self) -> None:
        """Generate daily summary report"""
        try:
            report_date = self.report_date.date().toPython()
            summary = self.transaction_controller.get_daily_summary(report_date)
            
            self.report_table.setRowCount(0)
            self.report_table.setColumnCount(2)
            self.report_table.setHorizontalHeaderLabels(["Metric", "Value"])
            
            metrics = [
                ("Date", report_date.strftime("%d/%m/%Y")),
                ("Total Credit", self.main_controller.format_currency(summary.get('total_credit', 0))),
                ("Total Payment", self.main_controller.format_currency(summary.get('total_payment', 0))),
                ("Net Change", self.main_controller.format_currency(summary.get('net_change', 0))),
                ("Transaction Count", str(summary.get('transaction_count', 0))),
                ("Credit Transactions", str(summary.get('credit_count', 0))),
                ("Payment Transactions", str(summary.get('payment_count', 0))),
                ("Correction Transactions", str(summary.get('correction_count', 0)))
            ]
            
            for i, (metric, value) in enumerate(metrics):
                self.report_table.insertRow(i)
                self.report_table.setItem(i, 0, QTableWidgetItem(metric))
                self.report_table.setItem(i, 1, QTableWidgetItem(value))
            
            self.report_table.resizeColumnsToContents()
            
            net_change = summary.get('net_change', 0)
            summary_text = f"Net Change: {self.main_controller.format_currency(net_change)}"
            self.report_summary_label.setText(summary_text)
            
        except Exception as e:
            logger.error(f"Error generating daily summary: {e}")
            raise
    
    def _generate_weekly_summary(self) -> None:
        """Generate weekly summary report"""
        # TODO: Implement weekly summary
        QMessageBox.information(self, "Weekly Summary", 
                               "Weekly summary report will be implemented soon.")
    
    def _generate_monthly_summary(self) -> None:
        """Generate monthly summary report"""
        try:
            month = self.report_month.currentIndex() + 1
            year = self.report_year.value()
            
            # Calculate date range for the month
            from_date = datetime(year, month, 1)
            if month == 12:
                to_date = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                to_date = datetime(year, month + 1, 1) - timedelta(days=1)
            
            # Get transaction statistics for the month
            stats = self.transaction_controller.get_transaction_statistics(from_date, to_date)
            
            self.report_table.setRowCount(0)
            self.report_table.setColumnCount(2)
            self.report_table.setHorizontalHeaderLabels(["Metric", "Value"])
            
            metrics = [
                ("Month", f"{self.report_month.currentText()} {year}"),
                ("Total Credit", self.main_controller.format_currency(stats.get('total_credit', 0))),
                ("Total Payment", self.main_controller.format_currency(stats.get('total_payment', 0))),
                ("Net Balance Change", self.main_controller.format_currency(stats.get('net_balance_change', 0))),
                ("Total Transactions", str(stats.get('total_transactions', 0))),
                ("Active Customers", str(stats.get('active_customers', 0))),
                ("New Customers", str(stats.get('new_customers', 0))),
                ("Average Transaction Amount", self.main_controller.format_currency(stats.get('average_transaction_amount', 0)))
            ]
            
            for i, (metric, value) in enumerate(metrics):
                self.report_table.insertRow(i)
                self.report_table.setItem(i, 0, QTableWidgetItem(metric))
                self.report_table.setItem(i, 1, QTableWidgetItem(value))
            
            self.report_table.resizeColumnsToContents()
            
            net_change = stats.get('net_balance_change', 0)
            summary_text = f"Monthly Net Change: {self.main_controller.format_currency(net_change)}"
            self.report_summary_label.setText(summary_text)
            
        except Exception as e:
            logger.error(f"Error generating monthly summary: {e}")
            QMessageBox.critical(self, "Error", f"Failed to generate monthly summary: {e}")
    
    def _generate_yearly_summary(self) -> None:
        """Generate yearly summary report"""
        # TODO: Implement yearly summary
        QMessageBox.information(self, "Yearly Summary", 
                               "Yearly summary report will be implemented soon.")
    
    def _generate_customer_balance_summary(self) -> None:
        """Generate customer balance summary report"""
        try:
            customers = self.customer_controller.get_all_customers(include_balance=True)
            
            # Sort by balance (highest to lowest)
            customers.sort(key=lambda x: x.get('balance', 0), reverse=True)
            
            self.report_table.setRowCount(0)
            self.report_table.setColumnCount(4)
            self.report_table.setHorizontalHeaderLabels(["Customer", "Phone", "Balance", "Status"])
            
            total_balance = 0.0
            active_count = 0
            
            for i, customer in enumerate(customers):
                self.report_table.insertRow(i)
                
                # Customer name
                name_item = QTableWidgetItem(customer.get('name', ''))
                self.report_table.setItem(i, 0, name_item)
                
                # Phone
                phone_item = QTableWidgetItem(customer.get('phone', ''))
                self.report_table.setItem(i, 1, phone_item)
                
                # Balance
                balance = customer.get('balance', 0.0)
                balance_item = QTableWidgetItem(self.main_controller.format_currency(balance))
                
                # Color code balance
                if balance > 0:
                    balance_item.setForeground(QBrush(QColor('#e74c3c')))
                elif balance < 0:
                    balance_item.setForeground(QBrush(QColor('#2ecc71')))
                
                self.report_table.setItem(i, 2, balance_item)
                
                # Status
                status = "Active" if customer.get('is_active', True) else "Inactive"
                status_item = QTableWidgetItem(status)
                if status == "Active":
                    status_item.setForeground(QBrush(QColor('#2ecc71')))
                    active_count += 1
                else:
                    status_item.setForeground(QBrush(QColor('#e74c3c')))
                
                self.report_table.setItem(i, 3, status_item)
                
                total_balance += balance
            
            self.report_table.resizeColumnsToContents()
            
            summary_text = (
                f"Total Customers: {len(customers)} | "
                f"Active: {active_count} | "
                f"Total Balance: {self.main_controller.format_currency(total_balance)}"
            )
            self.report_summary_label.setText(summary_text)
            
        except Exception as e:
            logger.error(f"Error generating customer balance summary: {e}")
            QMessageBox.critical(self, "Error", f"Failed to generate customer summary: {e}")
    
    def _generate_transaction_analysis(self) -> None:
        """Generate transaction analysis report"""
        # TODO: Implement transaction analysis
        QMessageBox.information(self, "Transaction Analysis", 
                               "Transaction analysis report will be implemented soon.")
    
    @Slot()
    def _export_report(self) -> None:
        """Export current report"""
        try:
            report_type = self.report_type_combo.currentText()
            default_name = f"{report_type.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            file_path, _ = QFileDialog.getSaveFileName(
                self, "Export Report", default_name, "CSV Files (*.csv)"
            )
            
            if not file_path:
                return
            
            # Export report data
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # Write header
                writer.writerow([f"{report_type} Report"])
                writer.writerow([f"Generated on: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"])
                writer.writerow([])
                
                # Write table data
                row_count = self.report_table.rowCount()
                col_count = self.report_table.columnCount()
                
                # Write column headers
                headers = []
                for col in range(col_count):
                    headers.append(self.report_table.horizontalHeaderItem(col).text())
                writer.writerow(headers)
                
                # Write rows
                for row in range(row_count):
                    row_data = []
                    for col in range(col_count):
                        item = self.report_table.item(row, col)
                        row_data.append(item.text() if item else "")
                    writer.writerow(row_data)
                
                # Write summary
                writer.writerow([])
                writer.writerow(["Summary:", self.report_summary_label.text()])
            
            QMessageBox.information(self, "Success", f"Report exported to:\n{file_path}")
            self.last_generated_label.setText(f"Last generated: {datetime.now().strftime('%H:%M:%S')}")
            self.report_generated.emit(report_type.lower().replace(' ', '_'), file_path)
            
        except Exception as e:
            logger.error(f"Error exporting report: {e}")
            QMessageBox.critical(self, "Error", f"Failed to export report: {e}")
    
    @Slot()
    def _perform_bulk_export(self) -> None:
        """Perform bulk data export"""
        try:
            export_type = self.export_type_combo.currentText()
            export_format = self.export_format_combo.currentText()
            
            # Get file path
            default_name = f"{export_type.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            if export_format == "CSV":
                file_filter = "CSV Files (*.csv)"
                default_name += ".csv"
            elif export_format == "JSON":
                file_filter = "JSON Files (*.json)"
                default_name += ".json"
            elif export_format == "Excel (XLSX)":
                file_filter = "Excel Files (*.xlsx)"
                default_name += ".xlsx"
            elif export_format == "PDF":
                file_filter = "PDF Files (*.pdf)"
                default_name += ".pdf"
            else:
                file_filter = "All Files (*)"
            
            file_path, _ = QFileDialog.getSaveFileName(
                self, f"Export {export_type}", default_name, file_filter
            )
            
            if not file_path:
                return
            
            # Update status
            self.export_status_label.setText(f"Exporting {export_type}...")
            self.export_progress.setValue(10)
            self.export_details.append(f"Starting export: {export_type}")
            
            # Simulate export process (would be replaced with actual export logic)
            QTimer.singleShot(500, lambda: self._simulate_export_progress(file_path, export_type))
            
        except Exception as e:
            logger.error(f"Error performing bulk export: {e}")
            self.export_status_label.setText(f"Export failed: {e}")
            self.export_details.append(f"ERROR: {e}")
    
    def _simulate_export_progress(self, file_path: str, export_type: str) -> None:
        """Simulate export progress (to be replaced with actual export)"""
        try:
            # Simulate progress steps
            steps = ["Collecting data...", "Processing records...", 
                    "Formatting data...", "Writing to file...", "Finalizing..."]
            
            for i, step in enumerate(steps):
                self.export_progress.setValue(10 + (i * 20))
                self.export_details.append(step)
                QApplication.processEvents()
                import time
                time.sleep(0.3)
            
            self.export_progress.setValue(100)
            self.export_status_label.setText(f"Export completed: {file_path}")
            self.export_details.append(f"Successfully exported to: {file_path}")
            
            # Update last generated timestamp
            self.last_generated_label.setText(f"Last generated: {datetime.now().strftime('%H:%M:%S')}")
            
            # Emit signal
            self.export_completed.emit(file_path)
            
            QMessageBox.information(self, "Export Complete", 
                                  f"{export_type} exported successfully to:\n{file_path}")
            
        except Exception as e:
            logger.error(f"Error in export simulation: {e}")
            self.export_status_label.setText(f"Export failed: {e}")
    
    @Slot(str, str)
    def _on_report_generated(self, report_type: str, file_path: str) -> None:
        """Handle report generated signal"""
        logger.info(f"Report generated: {report_type} at {file_path}")
    
    @Slot(str)
    def _on_export_completed(self, file_path: str) -> None:
        """Handle export completed signal"""
        logger.info(f"Export completed: {file_path}")
    
    def showEvent(self, event) -> None:
        """Handle show event - refresh customer list when shown"""
        super().showEvent(event)
        self._load_customers_into_combo(self.statement_customer_combo)


# Helper class for threaded export operations
class ExportWorker(QThread):
    """Worker thread for export operations"""
    
    progress = Signal(int, str)
    finished = Signal(str, bool, str)  # file_path, success, message
    
    def __init__(self, export_type: str, file_path: str, controller):
        """Initialize export worker"""
        super().__init__()
        self.export_type = export_type
        self.file_path = file_path
        self.controller = controller
    
    def run(self) -> None:
        """Run export operation"""
        try:
            # Simulate export (replace with actual export logic)
            self.progress.emit(10, "Starting export...")
            
            # TODO: Implement actual export logic based on export_type
            # For now, simulate success
            import time
            for i in range(5):
                time.sleep(0.5)
                progress = 10 + (i * 20)
                self.progress.emit(progress, f"Step {i+1}/5 completed...")
            
            self.progress.emit(100, "Export completed!")
            self.finished.emit(self.file_path, True, "Export successful")
            
        except Exception as e:
            logger.error(f"Export error: {e}")
            self.finished.emit(self.file_path, False, str(e))
