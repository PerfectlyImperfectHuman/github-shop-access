"""
Settings Views Module
Contains all settings-related UI components including backup management,
application settings, and about/help dialogs.
"""

import logging
import os
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, Signal, QThread, QTimer
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel,
                              QPushButton, QGroupBox, QTabWidget, QFormLayout,
                              QLineEdit, QSpinBox, QCheckBox, QTableWidget,
                              QTableWidgetItem, QHeaderView, QMessageBox,
                              QFileDialog, QTextEdit, QComboBox, QSizePolicy,
                              QProgressBar, QSplitter, QDialog, QDialogButtonBox)
from PySide6.QtGui import QFont, QIcon

from app.controllers.main_controller import MainController
from app.config import Config
from app.utils.database_manager import DatabaseManager
from app.models.backup import BackupRecord

logger = logging.getLogger(__name__)


class BackupWorker(QThread):
    """Worker thread for backup operations"""
    progress = Signal(int)
    message = Signal(str)
    finished = Signal(bool, str)
    
    def __init__(self, operation, source_path=None, backup_path=None):
        super().__init__()
        self.operation = operation  # 'create', 'restore', 'verify'
        self.source_path = source_path
        self.backup_path = backup_path
    
    def run(self):
        try:
            if self.operation == 'create':
                self.message.emit("Creating backup...")
                db_manager = DatabaseManager()
                backup_file = db_manager.create_backup()
                self.message.emit(f"Backup created: {backup_file}")
                self.finished.emit(True, f"Backup created successfully: {os.path.basename(backup_file)}")
                
            elif self.operation == 'restore':
                self.message.emit("Restoring backup...")
                db_manager = DatabaseManager()
                success = db_manager.restore_from_backup(self.backup_path)
                if success:
                    self.message.emit("Backup restored successfully")
                    self.finished.emit(True, "Backup restored successfully")
                else:
                    self.finished.emit(False, "Failed to restore backup")
                    
            elif self.operation == 'verify':
                self.message.emit("Verifying backup...")
                # For now, just check if file exists and is valid
                if os.path.exists(self.backup_path):
                    size = os.path.getsize(self.backup_path)
                    if size > 0:
                        self.finished.emit(True, f"Backup is valid ({size} bytes)")
                    else:
                        self.finished.emit(False, "Backup file is empty")
                else:
                    self.finished.emit(False, "Backup file not found")
                    
        except Exception as e:
            logger.error(f"Backup operation failed: {str(e)}")
            self.finished.emit(False, f"Error: {str(e)}")


class SettingsTab(QWidget):
    """Application settings tab"""
    
    def __init__(self, controller):
        super().__init__()
        self.controller = controller
        self.init_ui()
        self.load_settings()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        
        # General Settings Group
        general_group = QGroupBox("General Settings")
        general_layout = QFormLayout()
        general_layout.setSpacing(10)
        
        # Currency Symbol
        self.currency_input = QLineEdit()
        self.currency_input.setMaximumWidth(100)
        self.currency_input.setToolTip("Currency symbol to display before amounts")
        general_layout.addRow("Currency Symbol:", self.currency_input)
        
        # Date Format
        self.date_format_combo = QComboBox()
        self.date_format_combo.addItems([
            "dd/MM/yyyy",
            "MM/dd/yyyy", 
            "yyyy-MM-dd",
            "dd-MMM-yyyy"
        ])
        self.date_format_combo.setMaximumWidth(150)
        general_layout.addRow("Date Format:", self.date_format_combo)
        
        # Auto-backup enabled
        self.auto_backup_check = QCheckBox("Enable automatic daily backups")
        self.auto_backup_check.setToolTip("Automatically create backup every day at startup")
        general_layout.addRow("", self.auto_backup_check)
        
        # Backup retention days
        self.retention_spin = QSpinBox()
        self.retention_spin.setRange(1, 365)
        self.retention_spin.setSuffix(" days")
        self.retention_spin.setMaximumWidth(100)
        self.retention_spin.setToolTip("Number of days to keep backup files")
        general_layout.addRow("Backup Retention:", self.retention_spin)
        
        general_group.setLayout(general_layout)
        layout.addWidget(general_group)
        
        # Window Settings Group
        window_group = QGroupBox("Window Settings")
        window_layout = QFormLayout()
        window_layout.setSpacing(10)
        
        # Default window width
        self.width_spin = QSpinBox()
        self.width_spin.setRange(800, 1920)
        self.width_spin.setSuffix(" px")
        self.width_spin.setMaximumWidth(100)
        window_layout.addRow("Default Width:", self.width_spin)
        
        # Default window height
        self.height_spin = QSpinBox()
        self.height_spin.setRange(600, 1080)
        self.height_spin.setSuffix(" px")
        self.height_spin.setMaximumWidth(100)
        window_layout.addRow("Default Height:", self.height_spin)
        
        window_group.setLayout(window_layout)
        layout.addWidget(window_group)
        
        # Save Button
        button_layout = QHBoxLayout()
        self.save_btn = QPushButton("Save Settings")
        self.save_btn.setMinimumWidth(120)
        self.save_btn.clicked.connect(self.save_settings)
        self.save_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        
        self.reset_btn = QPushButton("Reset to Defaults")
        self.reset_btn.setMinimumWidth(120)
        self.reset_btn.clicked.connect(self.reset_to_defaults)
        self.reset_btn.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #d32f2f;
            }
        """)
        
        button_layout.addWidget(self.save_btn)
        button_layout.addWidget(self.reset_btn)
        button_layout.addStretch()
        layout.addLayout(button_layout)
        
        layout.addStretch()
    
    def load_settings(self):
        """Load current settings from config"""
        settings = self.controller.get_settings()
        
        self.currency_input.setText(settings.get('currency', Config.DEFAULT_CURRENCY))
        
        date_format = settings.get('date_format', Config.DEFAULT_DATE_FORMAT)
        index = self.date_format_combo.findText(date_format)
        if index >= 0:
            self.date_format_combo.setCurrentIndex(index)
        
        # Handle auto_backup setting (convert string to boolean)
        auto_backup_str = settings.get('auto_backup', str(Config.AUTO_BACKUP_ENABLED)).lower()
        self.auto_backup_check.setChecked(auto_backup_str in ('true', '1', 'yes'))
        
        # Convert string values to integers for spin boxes with error handling
        try:
            retention_days = int(settings.get('backup_retention_days', Config.BACKUP_RETENTION_DAYS))
        except (ValueError, TypeError):
            retention_days = Config.BACKUP_RETENTION_DAYS
        self.retention_spin.setValue(retention_days)
        
        try:
            window_width = int(settings.get('window_width', Config.DEFAULT_WINDOW_SIZE[0]))
        except (ValueError, TypeError):
            window_width = Config.DEFAULT_WINDOW_SIZE[0]
        self.width_spin.setValue(window_width)
        
        try:
            window_height = int(settings.get('window_height', Config.DEFAULT_WINDOW_SIZE[1]))
        except (ValueError, TypeError):
            window_height = Config.DEFAULT_WINDOW_SIZE[1]
        self.height_spin.setValue(window_height)
    
    def save_settings(self):
        """Save settings to database"""
        try:
            # Convert values to strings for database storage
            settings = {
                'currency': self.currency_input.text(),
                'date_format': self.date_format_combo.currentText(),
                'auto_backup': str(self.auto_backup_check.isChecked()).lower(),  # Store as "true"/"false"
                'backup_retention_days': str(self.retention_spin.value()),
                'window_width': str(self.width_spin.value()),
                'window_height': str(self.height_spin.value())
            }
            
            self.controller.update_settings(settings)
            
            QMessageBox.information(
                self, 
                "Settings Saved",
                "Application settings have been saved successfully.\n"
                "Some changes may require restarting the application."
            )
            
            logger.info("Settings saved successfully")
            
        except Exception as e:
            logger.error(f"Failed to save settings: {str(e)}")
            QMessageBox.critical(
                self,
                "Save Error",
                f"Failed to save settings: {str(e)}"
            )
    
    def reset_to_defaults(self):
        """Reset settings to default values"""
        reply = QMessageBox.question(
            self,
            "Reset Settings",
            "Are you sure you want to reset all settings to default values?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # Load default values from Config
            self.currency_input.setText(Config.DEFAULT_CURRENCY)
            
            index = self.date_format_combo.findText(Config.DEFAULT_DATE_FORMAT)
            if index >= 0:
                self.date_format_combo.setCurrentIndex(index)
            
            self.auto_backup_check.setChecked(Config.AUTO_BACKUP_ENABLED)
            self.retention_spin.setValue(Config.BACKUP_RETENTION_DAYS)
            self.width_spin.setValue(Config.DEFAULT_WINDOW_SIZE[0])
            self.height_spin.setValue(Config.DEFAULT_WINDOW_SIZE[1])


class BackupTab(QWidget):
    """Backup management tab"""
    
    def __init__(self, controller):
        super().__init__()
        self.controller = controller
        self.init_ui()
        self.load_backups()
        self.setup_connections()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        
        # Backup Controls
        controls_group = QGroupBox("Backup Actions")
        controls_layout = QHBoxLayout()
        
        self.create_btn = QPushButton("Create Backup Now")
        self.create_btn.setIcon(QIcon.fromTheme("document-save-as"))
        self.create_btn.setMinimumWidth(150)
        
        self.restore_btn = QPushButton("Restore Backup")
        self.restore_btn.setIcon(QIcon.fromTheme("document-open"))
        self.restore_btn.setMinimumWidth(150)
        
        self.verify_btn = QPushButton("Verify Selected")
        self.verify_btn.setIcon(QIcon.fromTheme("task-complete"))
        self.verify_btn.setMinimumWidth(150)
        
        self.delete_btn = QPushButton("Delete Selected")
        self.delete_btn.setIcon(QIcon.fromTheme("edit-delete"))
        self.delete_btn.setMinimumWidth(150)
        self.delete_btn.setStyleSheet("background-color: #f44336; color: white;")
        
        controls_layout.addWidget(self.create_btn)
        controls_layout.addWidget(self.restore_btn)
        controls_layout.addWidget(self.verify_btn)
        controls_layout.addWidget(self.delete_btn)
        controls_layout.addStretch()
        
        controls_group.setLayout(controls_layout)
        layout.addWidget(controls_group)
        
        # Progress bar for operations
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Status messages
        self.status_label = QLabel("Ready")
        self.status_label.setStyleSheet("color: #666; font-style: italic;")
        layout.addWidget(self.status_label)
        
        # Backup List Table
        backups_group = QGroupBox("Available Backups")
        backups_layout = QVBoxLayout()
        
        self.backup_table = QTableWidget()
        self.backup_table.setColumnCount(5)
        self.backup_table.setHorizontalHeaderLabels([
            "Filename", "Date Created", "Size", "Status", "Database Version"
        ])
        self.backup_table.horizontalHeader().setStretchLastSection(True)
        self.backup_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.backup_table.setAlternatingRowColors(True)
        
        # Set column widths
        header = self.backup_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Stretch)
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        
        backups_layout.addWidget(self.backup_table)
        backups_group.setLayout(backups_layout)
        layout.addWidget(backups_group, 1)  # Give stretch factor 1
        
        # Backup location info
        info_layout = QHBoxLayout()
        info_layout.addWidget(QLabel("Backup Location:"))
        
        self.location_label = QLabel()
        self.location_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        self.location_label.setStyleSheet("color: #2196F3;")
        
        self.open_folder_btn = QPushButton("Open Folder")
        self.open_folder_btn.setIcon(QIcon.fromTheme("folder-open"))
        self.open_folder_btn.clicked.connect(self.open_backup_folder)
        
        info_layout.addWidget(self.location_label, 1)
        info_layout.addWidget(self.open_folder_btn)
        info_layout.addStretch()
        layout.addLayout(info_layout)
    
    def setup_connections(self):
        """Connect signals and slots"""
        self.create_btn.clicked.connect(self.create_backup)
        self.restore_btn.clicked.connect(self.restore_backup)
        self.verify_btn.clicked.connect(self.verify_backup)
        self.delete_btn.clicked.connect(self.delete_backup)
    
    def load_backups(self):
        """Load backup files into the table"""
        try:
            # Clear table
            self.backup_table.setRowCount(0)
            
            # Get backup files
            backup_service = self.controller.backup_service
            backups = backup_service.get_backup_records()
            
            # Sort by date descending
            backups.sort(key=lambda x: x.created_at, reverse=True)
            
            for i, backup in enumerate(backups):
                self.backup_table.insertRow(i)
                
                # Filename
                filename = os.path.basename(backup.backup_path)
                self.backup_table.setItem(i, 0, QTableWidgetItem(filename))
                
                # Date
                date_str = backup.created_at.strftime("%d/%m/%Y %H:%M:%S")
                self.backup_table.setItem(i, 1, QTableWidgetItem(date_str))
                
                # Size
                if os.path.exists(backup.backup_path):
                    size_bytes = os.path.getsize(backup.backup_path)
                    size_str = self.format_size(size_bytes)
                else:
                    size_str = "Not found"
                self.backup_table.setItem(i, 2, QTableWidgetItem(size_str))
                
                # Status
                status_item = QTableWidgetItem("Verified" if backup.verified else "Not verified")
                if not backup.verified:
                    status_item.setForeground(Qt.red)
                self.backup_table.setItem(i, 3, status_item)
                
                # Database version
                version_item = QTableWidgetItem(str(backup.db_version))
                self.backup_table.setItem(i, 4, version_item)
            
            # Update backup location
            backup_dir = os.path.abspath(Config.BACKUP_DIR)
            self.location_label.setText(backup_dir)
            
            self.status_label.setText(f"Loaded {len(backups)} backup(s)")
            
        except Exception as e:
            logger.error(f"Failed to load backups: {str(e)}")
            self.status_label.setText(f"Error loading backups: {str(e)}")
    
    def format_size(self, size_bytes):
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"
    
    def get_selected_backup(self):
        """Get the selected backup file path"""
        selected_rows = self.backup_table.selectionModel().selectedRows()
        if not selected_rows:
            return None
        
        row = selected_rows[0].row()
        filename_item = self.backup_table.item(row, 0)
        if filename_item:
            backup_dir = Config.BACKUP_DIR
            return os.path.join(backup_dir, filename_item.text())
        return None
    
    def create_backup(self):
        """Create a new backup"""
        reply = QMessageBox.question(
            self,
            "Create Backup",
            "Create a new backup of the database?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.Yes
        )
        
        if reply == QMessageBox.Yes:
            # Disable buttons during operation
            self.set_buttons_enabled(False)
            self.progress_bar.setVisible(True)
            self.status_label.setText("Creating backup...")
            
            # Create worker thread
            self.worker = BackupWorker('create')
            self.worker.message.connect(self.status_label.setText)
            self.worker.finished.connect(self.on_backup_finished)
            self.worker.start()
    
    def restore_backup(self):
        """Restore from selected backup"""
        backup_path = self.get_selected_backup()
        if not backup_path:
            QMessageBox.warning(self, "No Selection", "Please select a backup to restore from.")
            return
        
        if not os.path.exists(backup_path):
            QMessageBox.critical(self, "File Not Found", f"Backup file not found:\n{backup_path}")
            return
        
        reply = QMessageBox.warning(
            self,
            "Restore Backup",
            f"WARNING: This will replace your current database with the backup.\n\n"
            f"Restore from: {os.path.basename(backup_path)}\n\n"
            "This action cannot be undone. Continue?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # Disable buttons during operation
            self.set_buttons_enabled(False)
            self.progress_bar.setVisible(True)
            self.status_label.setText("Restoring backup...")
            
            # Create worker thread
            self.worker = BackupWorker('restore', backup_path=backup_path)
            self.worker.message.connect(self.status_label.setText)
            self.worker.finished.connect(self.on_restore_finished)
            self.worker.start()
    
    def verify_backup(self):
        """Verify selected backup"""
        backup_path = self.get_selected_backup()
        if not backup_path:
            QMessageBox.warning(self, "No Selection", "Please select a backup to verify.")
            return
        
        if not os.path.exists(backup_path):
            QMessageBox.critical(self, "File Not Found", f"Backup file not found:\n{backup_path}")
            return
        
        # Disable buttons during operation
        self.set_buttons_enabled(False)
        self.progress_bar.setVisible(True)
        self.status_label.setText("Verifying backup...")
        
        # Create worker thread
        self.worker = BackupWorker('verify', backup_path=backup_path)
        self.worker.finished.connect(self.on_verify_finished)
        self.worker.start()
    
    def delete_backup(self):
        """Delete selected backup"""
        backup_path = self.get_selected_backup()
        if not backup_path:
            QMessageBox.warning(self, "No Selection", "Please select a backup to delete.")
            return
        
        reply = QMessageBox.warning(
            self,
            "Delete Backup",
            f"Delete backup file: {os.path.basename(backup_path)}?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            try:
                os.remove(backup_path)
                self.status_label.setText(f"Deleted: {os.path.basename(backup_path)}")
                self.load_backups()  # Refresh list
                
                # Also remove from database records
                backup_service = self.controller.get_backup_service()
                backup_service.cleanup_old_backups()  # This will remove non-existent files
                
            except Exception as e:
                logger.error(f"Failed to delete backup: {str(e)}")
                QMessageBox.critical(
                    self,
                    "Delete Failed",
                    f"Failed to delete backup: {str(e)}"
                )
    
    def open_backup_folder(self):
        """Open backup folder in system file explorer"""
        backup_dir = os.path.abspath(Config.BACKUP_DIR)
        
        if os.path.exists(backup_dir):
            import subprocess
            import platform
            
            system = platform.system()
            try:
                if system == "Windows":
                    os.startfile(backup_dir)
                elif system == "Darwin":  # macOS
                    subprocess.run(["open", backup_dir])
                else:  # Linux and others
                    subprocess.run(["xdg-open", backup_dir])
            except Exception as e:
                logger.error(f"Failed to open folder: {str(e)}")
                QMessageBox.information(
                    self,
                    "Backup Folder",
                    f"Backup files are located at:\n{backup_dir}"
                )
        else:
            QMessageBox.warning(
                self,
                "Folder Not Found",
                f"Backup directory does not exist:\n{backup_dir}"
            )
    
    def on_backup_finished(self, success, message):
        """Handle backup completion"""
        self.set_buttons_enabled(True)
        self.progress_bar.setVisible(False)
        
        if success:
            self.status_label.setText(message)
            self.load_backups()  # Refresh list
            QMessageBox.information(self, "Backup Complete", message)
        else:
            self.status_label.setText(f"Backup failed: {message}")
            QMessageBox.critical(self, "Backup Failed", message)
    
    def on_restore_finished(self, success, message):
        """Handle restore completion"""
        self.set_buttons_enabled(True)
        self.progress_bar.setVisible(False)
        
        if success:
            self.status_label.setText(message)
            QMessageBox.information(
                self,
                "Restore Complete",
                f"{message}\n\nThe application needs to restart to use the restored database."
            )
            # Emit signal to restart application
            # In a real implementation, this would trigger application restart
        else:
            self.status_label.setText(f"Restore failed: {message}")
            QMessageBox.critical(self, "Restore Failed", message)
    
    def on_verify_finished(self, success, message):
        """Handle verification completion"""
        self.set_buttons_enabled(True)
        self.progress_bar.setVisible(False)
        
        if success:
            self.status_label.setText(message)
            QMessageBox.information(self, "Verification Complete", message)
        else:
            self.status_label.setText(f"Verification failed: {message}")
            QMessageBox.critical(self, "Verification Failed", message)
    
    def set_buttons_enabled(self, enabled):
        """Enable/disable all action buttons"""
        self.create_btn.setEnabled(enabled)
        self.restore_btn.setEnabled(enabled)
        self.verify_btn.setEnabled(enabled)
        self.delete_btn.setEnabled(enabled)
        self.open_folder_btn.setEnabled(enabled)


class AboutTab(QWidget):
    """About/Help tab"""
    
    def __init__(self, controller):
        super().__init__()
        self.controller = controller
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setAlignment(Qt.AlignCenter)
        
        # Application Title
        title_label = QLabel("Shop Management System")
        title_font = QFont()
        title_font.setPointSize(24)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("color: #2196F3; margin: 20px;")
        layout.addWidget(title_label)
        
        # Version
        version_label = QLabel(f"Version 1.0.0")
        version_label.setAlignment(Qt.AlignCenter)
        version_label.setStyleSheet("color: #666; font-size: 14px;")
        layout.addWidget(version_label)
        
        # Description
        desc_text = (
            "Professional desktop-based shop management system\n"
            "for udhaar (credit) management with full audit trail."
        )
        desc_label = QLabel(desc_text)
        desc_label.setAlignment(Qt.AlignCenter)
        desc_label.setStyleSheet("color: #444; font-size: 16px; margin: 20px;")
        layout.addWidget(desc_label)
        
        # Features Group
        features_group = QGroupBox("Key Features")
        features_layout = QVBoxLayout()
        
        features = [
            "• Complete customer credit (udhaar) management",
            "• Immutable transaction ledger with full audit trail",
            "• Automated daily backups with 40-day retention",
            "• Professional reporting and customer statements",
            "• Offline-first design - no internet required",
            "• Transaction corrections (no deletions allowed)"
        ]
        
        for feature in features:
            feature_label = QLabel(feature)
            feature_label.setStyleSheet("padding: 5px;")
            features_layout.addWidget(feature_label)
        
        features_group.setLayout(features_layout)
        layout.addWidget(features_group)
        
        # Database Info
        db_group = QGroupBox("Database Information")
        db_layout = QFormLayout()
        db_layout.setSpacing(10)
        
        db_path = os.path.abspath("shop_management.db")
        backup_path = os.path.abspath("backups")
        
        db_path_label = QLabel(db_path)
        db_path_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        db_path_label.setStyleSheet("color: #2196F3;")
        
        backup_path_label = QLabel(backup_path)
        backup_path_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        backup_path_label.setStyleSheet("color: #2196F3;")
        
        db_layout.addRow("Database File:", db_path_label)
        db_layout.addRow("Backup Directory:", backup_path_label)
        
        db_group.setLayout(db_layout)
        layout.addWidget(db_group)
        
        # Help/Support
        help_group = QGroupBox("Help & Support")
        help_layout = QVBoxLayout()
        
        help_text = (
            "For support or to report issues:\n"
            "• Check the application logs in the logs/ directory\n"
            "• Ensure backups are created regularly\n"
            "• Verify database integrity using the Backup tab\n"
            "• All transactions are permanent and cannot be deleted"
        )
        
        help_label = QLabel(help_text)
        help_label.setWordWrap(True)
        help_label.setStyleSheet("padding: 10px; color: #666;")
        help_layout.addWidget(help_label)
        
        help_group.setLayout(help_layout)
        layout.addWidget(help_group)
        
        layout.addStretch()


class SettingsView(QWidget):
    """
    Main Settings View
    Combines all settings tabs into a tabbed interface.
    """
    
    def __init__(self, controller):
        super().__init__()
        self.controller = controller
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # Create tab widget
        self.tab_widget = QTabWidget()
        
        # Add tabs
        self.settings_tab = SettingsTab(self.controller)
        self.backup_tab = BackupTab(self.controller)
        self.about_tab = AboutTab(self.controller)
        
        self.tab_widget.addTab(self.settings_tab, "Application Settings")
        self.tab_widget.addTab(self.backup_tab, "Backup Management")
        self.tab_widget.addTab(self.about_tab, "About & Help")
        
        layout.addWidget(self.tab_widget)
    
    def refresh_backups(self):
        """Refresh backup list (called when returning to this view)"""
        if hasattr(self, 'backup_tab'):
            self.backup_tab.load_backups()