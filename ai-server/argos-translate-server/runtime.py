"""All model/cache files stay in this service's local data directory."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("ARGOS_DATA_DIR", ROOT / "data")).resolve()
os.environ.setdefault("XDG_DATA_HOME", str(DATA / "share"))
os.environ.setdefault("XDG_CONFIG_HOME", str(DATA / "config"))
os.environ.setdefault("XDG_CACHE_HOME", str(DATA / "cache"))
os.environ.setdefault("ARGOS_PACKAGES_DIR", str(DATA / "packages"))
os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")
os.environ.setdefault("ARGOS_INTRA_THREADS", "2")
# Never route requests through an external translation provider.
os.environ["ARGOS_MODEL_PROVIDER"] = "OPENNMT"
os.environ["ARGOS_CHUNK_TYPE"] = "STANZA"

REQUIRED_PAIRS = (("ko", "en"), ("en", "vi"))
