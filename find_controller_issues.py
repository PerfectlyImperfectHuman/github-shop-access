import os
import re

def find_controller_instantiations():
    """Find all places where MainController is instantiated"""
    for root, dirs, files in os.walk('.'):
        # Skip virtual environments and cache
        if any(x in root for x in ['.git', '__pycache__', 'venv', '.venv']):
            continue
            
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    # Look for MainController instantiation
                    lines = content.split('\n')
                    for i, line in enumerate(lines, 1):
                        if 'MainController(' in line and 'def' not in line:
                            print(f"{filepath}:{i}: {line.strip()}")
                            
                except Exception as e:
                    pass

if __name__ == "__main__":
    find_controller_instantiations()
