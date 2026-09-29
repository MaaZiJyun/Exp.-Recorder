import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError

from src.api.server import SoftwareRequest
from src.database.db_manager import DatabaseManager
from src.devices.software_flasher import SoftwareFlasher


class TestSoftwareLibrary(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp_dir.name)
        self.db = DatabaseManager(self.root / "software.db")

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_software_crud(self):
        payload = SoftwareRequest(
            name="Insect Controller",
            version="1.0.0",
            description="XIAO controller firmware",
            source_code_addr=str(self.root / "controller"),
            supported_device="XIAO ESP32S3",
        ).model_dump()
        software_id = self.db.create_software(payload)
        record = self.db.get_software(software_id)
        self.assertEqual(record["name"], "Insect Controller")
        self.assertEqual(record["version"], "1.0.0")
        self.assertEqual(record["supported_device"], "XIAO ESP32S3")
        self.assertEqual(len(self.db.list_software()), 3)

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.create_software(payload)

        payload["version"] = "1.1.0"
        payload["description"] = None
        self.assertTrue(self.db.update_software(software_id, payload))
        self.assertEqual(self.db.get_software(software_id)["version"], "1.1.0")
        self.assertTrue(self.db.delete_software(software_id))
        self.assertIsNone(self.db.get_software(software_id))

    def test_builtin_healthcheck_is_registered_idempotently(self):
        records = self.db.list_software()
        healthcheck = next(
            record
            for record in records
            if record["name"] == "XIAO ESP32S3 Inventory Health Check"
        )
        self.assertEqual(healthcheck["version"], "4.0.0")
        self.assertEqual(healthcheck["supported_device"], "XIAO ESP32S3")
        source = Path(healthcheck["source_code_addr"])
        self.assertEqual(source.parent, Path(__file__).resolve().parents[1] / "data" / "software")
        self.assertTrue((source / "xiao_esp32s3_healthcheck.ino").is_file())

        DatabaseManager(self.root / "software.db")
        matching = [
            record
            for record in self.db.list_software()
            if record["name"] == "XIAO ESP32S3 Inventory Health Check"
        ]
        self.assertEqual(len(matching), 1)

        recorder = next(
            record
            for record in records
            if record["name"] == "XIAO ESP32S3 Recorder"
        )
        self.assertEqual(recorder["supported_device"], "XIAO ESP32S3 Sense")
        self.assertTrue(
            (Path(recorder["source_code_addr"]) / "xiao_esp32s3_recorder.ino").is_file()
        )

    def test_request_rejects_empty_required_fields(self):
        with self.assertRaises(ValidationError):
            SoftwareRequest(name="", version="", source_code_addr="", supported_device="")

    def test_resolve_sketch_accepts_directory_and_ino_file(self):
        sketch = self.root / "controller"
        sketch.mkdir()
        ino = sketch / "controller.ino"
        ino.write_text("void setup() {}\nvoid loop() {}\n", encoding="utf-8")
        self.assertEqual(SoftwareFlasher.resolve_sketch(str(sketch)), sketch.resolve())
        self.assertEqual(SoftwareFlasher.resolve_sketch(ino.as_uri()), sketch.resolve())

    def test_flash_uses_argument_list_without_shell(self):
        sketch = self.root / "controller"
        sketch.mkdir()
        (sketch / "controller.ino").write_text("void setup() {}", encoding="utf-8")

        class FakeStdout:
            def __iter__(self):
                return iter(["Compile complete\n", "Upload complete\n"])

        class FakeProcess:
            stdout = FakeStdout()

            def wait(self, timeout=None):
                return 0

            def kill(self):
                return None

        with patch("src.devices.software_flasher.subprocess.Popen", return_value=FakeProcess()) as popen:
            result = SoftwareFlasher(arduino_cli="arduino-cli").flash(
                str(sketch), "/dev/cu.usbmodem1"
            )

        self.assertTrue(result["passed"])
        command = popen.call_args.args[0]
        self.assertEqual(command[:4], ["arduino-cli", "compile", "--fqbn", "esp32:esp32:XIAO_ESP32S3"])
        self.assertIn("--upload", command)
        self.assertNotIn("shell", popen.call_args.kwargs)


if __name__ == "__main__":
    unittest.main()
