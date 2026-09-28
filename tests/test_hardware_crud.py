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
            model="ESP32-S3",
            mac="BOARD-001",
            status="online",
        ).model_dump()
        board_id = self.db.create_board(board_payload)
        board = self.db.get_board(board_id)
        self.assertIsNotNone(board)
        self.assertEqual(board["mac"], "BOARD-001")
        self.assertIsNone(board["health_usb_detected"])
        self.assertEqual(board["peripheral_count"], 0)

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.create_board(board_payload)

        health_result = {
            "usb_detected": True,
            "model": "XIAO ESP32S3",
            "mac": "CCD90B697090",
            "wifi": True,
            "bluetooth": True,
            "hello": True,
            "gpio": True,
            "pwm": False,
            "uart": True,
            "spi": True,
        }
        self.assertTrue(self.db.update_board_health(board_id, health_result))
        board = self.db.get_board(board_id)
        self.assertTrue(board["health_usb_detected"])
        self.assertEqual(board["model"], "XIAO ESP32S3")
        self.assertEqual(board["mac"], "CCD90B697090")
        self.assertTrue(board["health_wifi"])
        self.assertTrue(board["health_bluetooth"])
        self.assertTrue(board["health_hello"])
        self.assertTrue(board["health_gpio"])
        self.assertFalse(board["health_pwm"])
        self.assertTrue(board["health_uart"])
        self.assertTrue(board["health_spi"])
        self.assertIsNotNone(board["health_checked_at"])

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
        self.assertEqual(peripheral["board_name"], "XIAO ESP32S3 · CCD90B697090")
        self.assertEqual(self.db.get_board(board_id)["peripheral_count"], 1)

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.delete_board(board_id)

        peripheral_payload["status"] = "online"
        self.assertTrue(self.db.update_peripheral(peripheral_id, peripheral_payload))
        self.assertEqual(self.db.get_peripheral(peripheral_id)["status"], "online")

        board_payload["model"] = "Controller B"
        self.assertTrue(self.db.update_board(board_id, board_payload))
        self.assertEqual(self.db.get_board(board_id)["model"], "Controller B")

        self.assertTrue(self.db.delete_peripheral(peripheral_id))
        self.assertTrue(self.db.delete_board(board_id))
        self.assertEqual(self.db.list_boards(), [])
        self.assertEqual(self.db.list_peripherals(), [])

    def test_request_enums_and_foreign_key_are_validated(self):
        with self.assertRaises(ValidationError):
            BoardRequest(
                model="X",
                mac="BAD-1",
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

    def test_refresh_board_statuses(self):
        online_id = self.db.create_board(BoardRequest(model="ESP32-S3", mac="CCD90B697090", status="offline").model_dump())
        offline_id = self.db.create_board(BoardRequest(model="ESP32-S3", mac="AABBCCDDEEFF", status="online").model_dump())
        broken_id = self.db.create_board(BoardRequest(model="ESP32-S3", mac="102030405060", status="broken").model_dump())

        records = self.db.refresh_board_statuses({"CCD90B697090"})
        by_id = {record["board_id"]: record for record in records}
        self.assertEqual(by_id[online_id]["status"], "online")
        self.assertEqual(by_id[offline_id]["status"], "offline")
        self.assertEqual(by_id[broken_id]["status"], "broken")

    def test_legacy_board_columns_are_migrated(self):
        legacy_path = Path(self.tmp_dir.name) / "legacy.db"
        with sqlite3.connect(legacy_path) as conn:
            conn.execute(
                """CREATE TABLE boards (
                board_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL, model TEXT NOT NULL,
                serial_number TEXT NOT NULL UNIQUE,
                wifi INTEGER NOT NULL DEFAULT 0,
                bluetooth INTEGER NOT NULL DEFAULT 0,
                usb INTEGER NOT NULL DEFAULT 0,
                gpio_count INTEGER NOT NULL DEFAULT 0,
                working_voltage REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'offline',
                health_product TEXT, health_mac TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )"""
            )
            conn.execute(
                """INSERT INTO boards
                (name, model, serial_number, wifi, bluetooth, usb, gpio_count, working_voltage)
                VALUES ('Inventory board', 'ESP32-S3', 'LEGACY-MAC', 1, 1, 1, 11, 3.3)"""
            )
        migrated = DatabaseManager(legacy_path)
        columns = {
            row["name"]
            for row in migrated.get_connection().execute("PRAGMA table_info(boards)").fetchall()
        }
        self.assertIn("mac", columns)
        self.assertNotIn("serial_number", columns)
        self.assertNotIn("health_product", columns)
        self.assertNotIn("health_mac", columns)
        self.assertNotIn("wifi", columns)
        self.assertNotIn("bluetooth", columns)
        self.assertNotIn("usb", columns)
        self.assertNotIn("name", columns)
        self.assertNotIn("gpio_count", columns)
        self.assertNotIn("working_voltage", columns)
        self.assertEqual(migrated.get_board(1)["mac"], "LEGACY-MAC")

    def test_create_board_from_health_upserts_detected_parameters(self):
        result = {
            "model": "XIAO ESP32S3",
            "mac": "CCD90B697090",
            "usb_detected": True,
            "wifi": True,
            "bluetooth": True,
            "hello": True,
            "gpio": True,
            "pwm": True,
            "uart": False,
            "spi": True,
        }
        board_id = self.db.create_board_from_health(result)
        self.assertEqual(self.db.get_board(board_id)["status"], "online")
        result["model"] = "XIAO ESP32S3 (detected)"
        self.assertEqual(self.db.create_board_from_health(result), board_id)
        self.assertEqual(self.db.get_board(board_id)["model"], "XIAO ESP32S3 (detected)")

    def test_reversed_healthcheck_macs_are_migrated_once(self):
        db_path = Path(self.tmp_dir.name) / "network-order.db"
        initial = DatabaseManager(db_path)
        with initial.get_connection() as conn:
            conn.execute(
                "DELETE FROM app_metadata WHERE key=?",
                (DatabaseManager.NETWORK_MAC_MIGRATION_KEY,),
            )
            conn.execute(
                "INSERT INTO boards (model, mac) VALUES (?, ?)",
                ("XIAO ESP32S3", "0C63FBA172E0"),
            )

        migrated = DatabaseManager(db_path)
        self.assertEqual(migrated.get_board(1)["mac"], "E072A1FB630C")
        self.assertEqual(DatabaseManager(db_path).get_board(1)["mac"], "E072A1FB630C")


if __name__ == "__main__":
    unittest.main()
