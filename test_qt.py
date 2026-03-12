import sys
from PySide6.QtWidgets import QApplication, QLabel
from PySide6.QtCore import Qt

if __name__ == "__main__":
    app = QApplication(sys.argv)
    label = QLabel("Hello PySide6!")
    label.setAlignment(Qt.AlignmentFlag.AlignCenter)
    label.resize(400, 300)
    label.show()
    sys.exit(app.exec())
