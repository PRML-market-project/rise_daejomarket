"""Make runtime modules importable when unittest discovers this test directory."""
from pathlib import Path
import sys

CODE = Path(__file__).resolve().parents[1] / 'code'
sys.path.insert(0, str(CODE))
