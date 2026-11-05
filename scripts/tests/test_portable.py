import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import portable


class PortableDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.deploy = self.root / 'deployment'
        self.deploy.mkdir()
        self.settings = {'host': '127.0.0.1', 'port': 13306, 'user': 'root', 'password': 'a' * 48}
        (self.deploy / 'portable-db.json').write_text(json.dumps(self.settings))
        (self.deploy / 'database-counts.json').write_text('{"admin":2}')
        for name, value in [('ROOT', self.root), ('DEPLOY', self.deploy)]:
            patcher = patch.object(portable, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_other_mysql_instance_is_never_modified(self):
        with patch.object(portable, 'mysql', return_value=str(self.root / 'unrelated/mysql')):
            with self.assertRaisesRegex(RuntimeError, 'outside this project'):
                portable.verify_database_owner(self.root / 'bin', self.settings)

    def test_existing_verified_database_skips_import(self):
        (self.deploy / 'database-restored.json').write_text('{}')
        execute = Mock(return_value='1')
        with patch.object(portable, 'verify_database_owner'), patch.object(portable, 'mysql', execute), \
                patch.object(portable, 'database_counts', return_value={'admin': 3}):
            portable.restore_database()
        self.assertTrue(all('source' not in call.kwargs for call in execute.call_args_list))

    def test_partial_import_cannot_be_reported_as_success(self):
        with patch.object(portable, 'verify_database_owner'), patch.object(portable, 'mysql', return_value='1'), \
                patch.object(portable, 'database_counts', return_value={'admin': 1}):
            with self.assertRaisesRegex(RuntimeError, 'unverified'):
                portable.restore_database()
        self.assertFalse((self.deploy / 'database-restored.json').exists())

    def test_failed_dump_preserves_previous_snapshot(self):
        original = self.deploy / 'database.sql'
        original.write_text('previous complete snapshot')
        with patch.object(portable.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'mysqldump')):
            with self.assertRaises(subprocess.CalledProcessError):
                portable.snapshot(self.root / 'bin', self.settings)
        self.assertEqual(original.read_text(), 'previous complete snapshot')

    def test_password_is_not_in_command_arguments(self):
        self.assertNotIn(self.settings['password'], ' '.join(portable.mysql_arguments(self.settings)))
        self.assertEqual(portable.mysql_environment(self.settings)['MYSQL_PWD'], self.settings['password'])

    def test_corrupted_file_with_unchanged_size_fails_verification(self):
        payload = self.root / 'model.bin'
        payload.write_bytes(b'original')
        with payload.open('rb') as stream:
            expected = portable.hash_stream(stream)
        (self.deploy / 'manifest.json').write_text(json.dumps({
            'model.bin': {'bytes': 8, 'sha256': expected},
        }))
        payload.write_bytes(b'corrupt!')
        with self.assertRaisesRegex(RuntimeError, 'SHA256 mismatch'):
            portable.manifest()


if __name__ == '__main__':
    unittest.main()
