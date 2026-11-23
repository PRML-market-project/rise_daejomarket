"""Validate the real Windows detachment flow against a harmless fake stop script."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(os.name == "nt", "Windows shutdown launcher")
class AdminShutdownTest(unittest.TestCase):
    def test_detached_worker_calls_shared_stop_after_launcher_exits(self):
        with tempfile.TemporaryDirectory(prefix=".tmp-shutdown-한글 ", dir=ROOT) as folder:
            root = Path(folder)
            scripts = root / "scripts"
            scripts.mkdir()
            shutil.copyfile(ROOT / "scripts/request-stop-windows.ps1", scripts / "request-stop-windows.ps1")
            # Never run the real stop script in a test or enumerate unrelated processes.
            (scripts / "stop-windows.ps1").write_text("""
@{ worker = $PID; stopped = $true } | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'called.json') -Encoding UTF8
""", encoding="utf-8")
            started = time.monotonic()
            launcher = subprocess.Popen([
                "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                "-File", str(scripts / "request-stop-windows.ps1"),
            ], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, error = launcher.communicate(timeout=12)
            self.assertEqual(launcher.returncode, 0, (out, error))
            marker = scripts / "called.json"
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline and not marker.exists():
                time.sleep(0.1)
            logs = "\n".join(path.read_text(encoding="utf-8-sig", errors="replace") for path in (root / ".local-service-logs").glob("*.log"))
            self.assertTrue(marker.exists(), "Detached worker never called the stop script\n" + logs)
            result = json.loads(marker.read_text(encoding="utf-8-sig"))
            self.assertTrue(result["stopped"])
            self.assertNotEqual(launcher.pid, result["worker"])
            self.assertNotEqual(os.getpid(), result["worker"])
            self.assertGreaterEqual(time.monotonic() - started, 2)
            # Let the harmless child close its redirected log handles before cleanup.
            time.sleep(0.5)


if __name__ == "__main__":
    unittest.main()
