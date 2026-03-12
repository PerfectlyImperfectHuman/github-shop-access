import sys
from PySide6.QtWidgets import QApplication, QLabel, QMainWindow

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Shop Management System")
        self.setFixedSize(900, 600)

        label = QLabel("Shop Management System", self)
        label.setGeometry(250, 250, 400, 50)
        label.setStyleSheet("font-size: 24px;")

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
