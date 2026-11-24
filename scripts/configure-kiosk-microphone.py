"""Pre-allow the real microphone for the two local kiosk origins only.

Called by run-all.ps1 before opening its dedicated Chrome profile. Chrome must
be closed when writing Preferences; --check is read-only and works while open.
No default/global microphone permission or camera setting is changed.
"""

import argparse
import json
import os
from pathlib import Path
import shutil
import tempfile
import time


KIOSK_PATTERNS = ("http://localhost:5173,*", "http://127.0.0.1:5173,*")
PREF_PATH = ("profile", "content_settings", "exceptions", "media_stream_mic")


def read_preferences(path: Path) -> dict:
    if not path.exists():
        return {}
    preferences = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(preferences, dict):
        raise ValueError("Chrome Preferences must be a JSON object")
    return preferences


def microphone_ready(preferences: dict) -> bool:
    node = preferences
    for key in PREF_PATH:
        node = node.get(key)
        if not isinstance(node, dict):
            return False
    for pattern in KIOSK_PATTERNS:
        rule = node.get(pattern)
        if not isinstance(rule, dict) or type(rule.get("setting")) is not int or rule["setting"] != 1:
            return False
        if rule.get("model", 0) != 0 or rule.get("expiration", "0") not in ("0", 0):
            return False
    return True


def configure_microphone(profile_directory: Path) -> bool:
    """Merge site-specific exceptions, preserving all unrelated preferences."""
    path = profile_directory / "Default" / "Preferences"
    preferences = read_preferences(path)
    if microphone_ready(preferences):
        return False
    node = preferences
    for key in PREF_PATH:
        if key not in node:
            node[key] = {}
        if not isinstance(node[key], dict):
            raise ValueError(f"Invalid Chrome Preferences object: {key}")
        node = node[key]
    # Chromium stores timestamps as microseconds since 1601, serialized as strings.
    modified = str(time.time_ns() // 1000 + 11644473600000000)
    for pattern in KIOSK_PATTERNS:
        # Replace any previous block or temporary grant, including expiry metadata.
        node[pattern] = {"setting": 1, "last_modified": modified}

    path.parent.mkdir(parents=True, exist_ok=True)
    backup = path.with_name("Preferences.before-kiosk-microphone.bak")
    if path.exists() and not backup.exists():
        shutil.copy2(path, backup)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".microphone-", suffix=".json", delete=False) as output:
            temporary = Path(output.name)
            json.dump(preferences, output, ensure_ascii=False)
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check permissions without changing the profile")
    args = parser.parse_args()
    # The CLI always targets this project profile, never the user's ordinary Chrome.
    profile = Path(__file__).resolve().parents[1] / ".runtime" / "kiosk-browser"
    if args.check:
        return 0 if microphone_ready(read_preferences(profile / "Default" / "Preferences")) else 1
    configure_microphone(profile)
    print("Kiosk microphone allowed for localhost:5173 and 127.0.0.1:5173.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
