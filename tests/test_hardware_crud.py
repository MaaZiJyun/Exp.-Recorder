import sqlite3
import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from src.api.server import BoardRequest, PeripheralRequest
from src.database.db_manager import DatabaseManager


class TestHardwareCrud(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db = DatabaseManager(Path(self.tmp_dir.name) / "hardware.db")

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_board_and_peripheral_crud(self):
        board_payload = BoardRequest(
            name="Controller A",
            model="ESP32-S3",
            serial_number="BOARD-001",
            wifi=True,
            bluetooth=True,
            usb=True,
            gpio_count=45,
            working_voltage=3.3,
            status="online",
        ).model_dump()
        board_id = self.db.create_board(board_payload)
        board = self.db.get_board(board_id)
        self.assertIsNotNone(board)
        self.assertTrue(board["wifi"])
        self.assertEqual(board["peripheral_count"], 0)

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.create_board(board_payload)

        peripheral_payload = PeripheralRequest(
            name="Tracking Camera",
            type="camera",
            model="OV2640",
            board_id=board_id,
            interface_type="SPI",
            voltage=3.3,
            status="offline",
        ).model_dump()
        peripheral_id = self.db.create_peripheral(peripheral_payload)
        peripheral = self.db.get_peripheral(peripheral_id)
        self.assertEqual(peripheral["board_name"], "Controller A")
        self.assertEqual(self.db.get_board(board_id)["peripheral_count"], 1)

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.delete_board(board_id)

        peripheral_payload["status"] = "online"
        self.assertTrue(self.db.update_peripheral(peripheral_id, peripheral_payload))
        self.assertEqual(self.db.get_peripheral(peripheral_id)["status"], "online")

        board_payload["name"] = "Controller B"
        self.assertTrue(self.db.update_board(board_id, board_payload))
        self.assertEqual(self.db.get_board(board_id)["name"], "Controller B")

        self.assertTrue(self.db.delete_peripheral(peripheral_id))
        self.assertTrue(self.db.delete_board(board_id))
        self.assertEqual(self.db.list_boards(), [])
        self.assertEqual(self.db.list_peripherals(), [])

    def test_request_enums_and_foreign_key_are_validated(self):
        with self.assertRaises(ValidationError):
            BoardRequest(
                name="Bad board",
                model="X",
                serial_number="BAD-1",
                gpio_count=1,
                working_voltage=3.3,
                status="retired",
            )

        orphan = PeripheralRequest(
            name="Orphan",
            type="sensor",
            model="X",
            board_id=999,
            interface_type="I2C",
            voltage=3.3,
            status="offline",
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.create_peripheral(orphan.model_dump())


if __name__ == "__main__":
    unittest.main()
