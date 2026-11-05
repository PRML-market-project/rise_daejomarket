"""Collect this PC's assets, snapshot MySQL, and initialize the portable database."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / "deployment"
RUNTIME = ROOT / ".runtime"
DB_NAME = "prml_market_db"
DB_PORT = 13306


def mysql_path(path):
    """MySQL's Windows CLI still needs short paths for Korean directory names."""
    path = str(path)
    if os.name == 'nt':
        import ctypes
        buffer = ctypes.create_unicode_buffer(32768)
        if ctypes.windll.kernel32.GetShortPathNameW(path, buffer, len(buffer)):
            return buffer.value.replace('\\', '/')
    return path.replace('\\', '/')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def copy_tree(source, target, ignore=None):
    if not source.is_dir():
        raise FileNotFoundError(source)
    print(f"Copying {source.name} -> {target.relative_to(ROOT)}", flush=True)
    def copy_changed(src, dst):
        if Path(dst).is_file():
            before, after = Path(src).stat(), Path(dst).stat()
            if before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns:
                return dst
        return shutil.copy2(src, dst)
    shutil.copytree(source, target, dirs_exist_ok=True, ignore=ignore, copy_function=copy_changed)


def mysql_arguments(settings):
    # Credentials are supplied only in the child environment, never argv/logs.
    return ["--no-defaults", f"--host={settings['host']}", f"--port={settings['port']}",
            f"--user={settings['user']}"]


def mysql_environment(settings):
    return dict(os.environ, MYSQL_PWD=str(settings['password']))


def snapshot(bin_dir, settings):
    DEPLOY.mkdir(exist_ok=True)
    pending = DEPLOY / "database.pending.sql"
    try:
        subprocess.run([str(bin_dir / "mysqldump.exe"), *mysql_arguments(settings),
                        "--single-transaction", "--skip-lock-tables", "--routines", "--events",
                        "--triggers", "--hex-blob", "--no-tablespaces", "--set-gtid-purged=OFF",
                        "--default-character-set=utf8mb4", f"--result-file={pending}",
                        "--databases", DB_NAME], check=True, env=mysql_environment(settings))
        pending.replace(DEPLOY / "database.sql")
        return database_counts(bin_dir, settings)
    finally:
        pending.unlink(missing_ok=True)


def mysql(bin_dir, settings, sql=None, source=None):
    command = [str(bin_dir / "mysql.exe"), *mysql_arguments(settings),
               "--default-character-set=utf8mb4", "--batch", "--skip-column-names"]
    if source:
        with source.open("rb") as stream:
            subprocess.run(command, stdin=stream, check=True, env=mysql_environment(settings))
        return ""
    result = subprocess.run(command, input=sql + ';\n', encoding="utf-8", check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env=mysql_environment(settings))
    return result.stdout.strip()


def database_counts(bin_dir, settings):
    tables = mysql(bin_dir, settings,
                   f"SELECT table_name FROM information_schema.tables WHERE table_schema='{DB_NAME}'")
    counts = {}
    for table in tables.splitlines():
        quoted = table.replace('`', '``')
        counts[table] = int(mysql(bin_dir, settings, f"SELECT COUNT(*) FROM `{DB_NAME}`.`{quoted}`"))
    return counts


def collect():
    import yaml  # Available in the source PC's AI environment; not needed for restore.
    config_path = ROOT / "backend/src/main/resources/application.yml"
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    DEPLOY.mkdir(exist_ok=True)
    RUNTIME.mkdir(exist_ok=True)
    copy_tree(Path(config["file"].get("uploadDir") or config["file"]["upload-dir"]), ROOT / "data/uploads")
    cache = Path.home() / ".cache/huggingface/hub/models--openai--whisper-tiny"
    revision = (cache / "refs/main").read_text().strip()
    copy_tree(cache / "snapshots" / revision, ROOT / "data/models/whisper-tiny")

    # Preserve the tested Windows x64 versions and their original licenses.
    copy_tree(Path(shutil.which("node.exe")).parent, RUNTIME / "node")
    copy_tree(Path(shutil.which("java.exe")).resolve().parents[1], RUNTIME / "java")
    copy_tree(Path(shutil.which("dotnet.exe")).parent, RUNTIME / "dotnet")
    python_home = Path(sys.base_prefix)
    def python_ignore(folder, names):
        return [name for name in names if name in {"site-packages", "Scripts", "__pycache__"}]
    copy_tree(python_home, RUNTIME / "python", ignore=python_ignore)
    mysql_home = Path("C:/Program Files/MySQL/MySQL Server 8.0")
    copy_tree(mysql_home, RUNTIME / "mysql")
    datasource = config["spring"]["datasource"]
    counts = snapshot(mysql_home / "bin", {"host": "127.0.0.1", "port": 3306,
                                           "user": datasource["username"],
                                           "password": datasource["password"]})
    write_json(DEPLOY / "database-counts.json", counts)
    write_json(DEPLOY / "source-info.json", {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "database": DB_NAME, "database_version": "8.0.36", "whisper_revision": revision,
        "python": "3.10.11", "node": "24.12.0", "java": "20.0.2", "dotnet_sdk": "8.0.423",
        "upload_files": sum(1 for item in (ROOT / 'data/uploads').rglob('*') if item.is_file()),
        "database_rows": counts,
    })
    print("Collected assets and consistent SQL snapshot:", json.dumps(counts), flush=True)


def configure_database():
    DEPLOY.mkdir(exist_ok=True)
    settings_path = DEPLOY / "portable-db.json"
    if not settings_path.exists():
        write_json(settings_path, {"host": "127.0.0.1", "port": DB_PORT,
                                  "user": "root", "password": secrets.token_hex(24)})
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    base = RUNTIME / "mysql"
    data = ROOT / "data/mysql"
    data.mkdir(parents=True, exist_ok=True)
    # Regenerate absolute paths whenever the project changes location.
    (DEPLOY / "mysql.ini").write_text(
        "[mysqld]\n" + f'basedir="{mysql_path(base)}"\ndatadir="{mysql_path(data)}"\n'
        + f"port={settings['port']}\nbind-address=127.0.0.1\nmysqlx=0\n"
        + "character-set-server=utf8mb4\ncollation-server=utf8mb4_unicode_ci\n"
        + "innodb-buffer-pool-size=128M\nmax-allowed-packet=128M\n", encoding="utf-8")
    initialized = data / "mysql"
    if not initialized.exists():
        subprocess.run([str(base / "bin/mysqld.exe"),
                        f"--defaults-file={mysql_path(DEPLOY / 'mysql.ini')}", "--initialize-insecure", "--console"],
                       check=True)
    print("Portable MySQL configured on loopback port", settings["port"])


def restore_database():
    settings = json.loads((DEPLOY / "portable-db.json").read_text(encoding="utf-8"))
    bin_dir = RUNTIME / "mysql/bin"
    try:
        verify_database_owner(bin_dir, settings)
    except subprocess.CalledProcessError:
        initial = dict(settings, password="")
        verify_database_owner(bin_dir, initial)
        # Only an explicitly initialized local portable instance is used here.
        password = settings["password"]
        if not all(char in "0123456789abcdef" for char in password):
            raise ValueError("Invalid generated database password")
        mysql(bin_dir, initial, f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{password}'")
    exists = mysql(bin_dir, settings,
                   f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='{DB_NAME}'")
    if int(exists):
        marker = DEPLOY / 'database-restored.json'
        if not marker.exists():
            expected = json.loads((DEPLOY / "database-counts.json").read_text(encoding="utf-8"))
            if database_counts(bin_dir, settings) != expected:
                raise RuntimeError("Existing unverified database differs from the snapshot; not overwriting it")
            write_json(marker, {"verified_at": time.strftime('%Y-%m-%dT%H:%M:%S%z')})
        print("Existing portable database preserved; SQL import skipped.", flush=True)
    else:
        mysql(bin_dir, settings, source=DEPLOY / "database.sql")
        expected = json.loads((DEPLOY / "database-counts.json").read_text(encoding="utf-8"))
        actual = database_counts(bin_dir, settings)
        if actual != expected:
            raise RuntimeError("Restored database row counts do not match the snapshot")
        write_json(DEPLOY / 'database-restored.json', {"verified_at": time.strftime('%Y-%m-%dT%H:%M:%S%z')})
        print("Database restored and all table row counts verified.", flush=True)
    print(json.dumps(database_counts(bin_dir, settings)), flush=True)


def verify_database_owner(bin_dir, settings):
    directory = mysql(bin_dir, settings, "SELECT @@datadir")
    if Path(directory).resolve() != (ROOT / "data/mysql").resolve():
        raise RuntimeError("Refusing to modify a MySQL instance outside this project")


def stop_database():
    settings = json.loads((DEPLOY / "portable-db.json").read_text(encoding="utf-8"))
    bin_dir = RUNTIME / "mysql/bin"
    verify_database_owner(bin_dir, settings)
    subprocess.run([str(bin_dir / "mysqladmin.exe"), *mysql_arguments(settings),
                    "shutdown"], check=True, env=mysql_environment(settings))


def manifest(create=False):
    path = DEPLOY / "manifest.json"
    if create:
        files = []
        for folder in ("data/uploads", "data/models", "ai-server/models",
                       "ai-server/qwen-tts-server/models", "ai-server/qwen-tts-server/voices",
                       "ai-server/.llama-cpp", "ai-server/qwen-tts-server/runtime",
                       "ai-server/argos-translate-server/data/packages",
                       "ai-server/argos-translate-server/data/share"):
            files.extend(item for item in (ROOT / folder).rglob('*') if item.is_file())
        files += [DEPLOY / "database.sql", DEPLOY / "database-counts.json",
                  ROOT / "ai-server/.llama-cpp/llama-server.exe",
                  ROOT / "ai-server/qwen-tts-server/runtime/tts-server.exe"]
        files += list(DEPLOY.glob('requirements-*.lock.txt'))
        entries = {}
        for item in sorted(set(files)):
            relative = item.relative_to(ROOT).as_posix()
            print("Hashing", relative, flush=True)
            with item.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else hash_stream(stream)
            entries[relative] = {"bytes": item.stat().st_size, "sha256": digest}
        write_json(path, entries)
    entries = json.loads(path.read_text(encoding="utf-8"))
    for relative, expected in entries.items():
        item = ROOT / relative
        if not item.is_file() or item.stat().st_size != expected['bytes']:
            raise RuntimeError(f"Missing or incomplete transfer file: {relative}")
        if not create:
            with item.open('rb') as stream:
                if hash_stream(stream) != expected['sha256']:
                    raise RuntimeError(f"SHA256 mismatch: {relative}")
    print(f"Verified {len(entries)} transfer files.", flush=True)


def hash_stream(stream):
    digest = hashlib.sha256()
    for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
        digest.update(block)
    return digest.hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['collect', 'configure-db', 'restore-db', 'stop-db', 'manifest', 'verify'])
    command = parser.parse_args().command
    {'collect': collect, 'configure-db': configure_database, 'restore-db': restore_database,
     'stop-db': stop_database, 'manifest': lambda: manifest(create=True), 'verify': manifest}[command]()
