import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from app.views.main_window import MainWindow
    print("MainWindow imports successfully")
    
    # Check if MainWindow has initialize_controllers method
    import inspect
    methods = inspect.getmembers(MainWindow, predicate=inspect.isfunction)
    method_names = [name for name, _ in methods]
    print("Available methods:", method_names)
    
    if 'initialize_controllers' in method_names:
        print("✓ MainWindow has initialize_controllers method")
    else:
        print("✗ MainWindow does NOT have initialize_controllers method")
        
except Exception as e:
    print(f"Error: {e}")
