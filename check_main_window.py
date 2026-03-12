import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

try:
    with open('app/views/main_window.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Look for MainController initialization
    import re
    matches = re.findall(r'MainController\([^)]*\)', content)
    for match in matches:
        print(f"Found: {match}")
        
    # Also check for the class definition
    if 'class MainWindow' in content:
        print("\nMainWindow class found")
        
except Exception as e:
    print(f"Error reading file: {e}")
