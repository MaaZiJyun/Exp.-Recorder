import sqlite3
import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from src.api.server import BehaviorRequest
from src.database.db_manager import DatabaseManager


class TestBehaviors(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db = DatabaseManager(Path(self.tmp_dir.name) / "behaviors.db")
        self.species_id = self.db.create_species("CRICKET", "Gryllus bimaculatus")
        position_1 = self.db.create_stimulation_position("LF", species="CRICKET")
        position_2 = self.db.create_stimulation_position("RF", species="CRICKET")
        self.channel_id = self.db.create_stimulation_channel({
            "species_id": self.species_id,
            "channel_name": "Forward Channel",
            "channel_pin_1": 7,
            "channel_pin_2": 8,
            "channel_pin_1_position_id": position_1,
            "channel_pin_2_position_id": position_2,
            "channel_freq_hz": 50.0,
            "channel_stim_duration_ms": 500,
        })
        self.payload = {
            "species_id": self.species_id,
            "name": "forward",
            "channel_id": self.channel_id,
            "default_shortcut": "W",
            "status": "on",
        }

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_crud_and_joined_labels(self):
        behavior_id = self.db.create_behavior(self.payload)
        behavior = self.db.get_behavior(behavior_id)
        self.assertEqual(behavior["species_code"], "CRICKET")
        self.assertEqual(behavior["channel_name"], "Forward Channel")
        self.assertEqual(behavior["status"], "on")

        updated = {**self.payload, "default_shortcut": "ArrowUp", "status": "off"}
        self.assertTrue(self.db.update_behavior(behavior_id, updated))
        self.assertEqual(self.db.list_behaviors()[0]["default_shortcut"], "ArrowUp")
        self.assertEqual(self.db.list_behaviors()[0]["status"], "off")

        self.assertTrue(self.db.delete_behavior(behavior_id))
        self.assertEqual(self.db.list_behaviors(), [])

    def test_species_channel_match_and_unique_name_are_enforced(self):
        self.db.create_behavior(self.payload)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.create_behavior(self.payload)

        other_species_id = self.db.create_species("MOTH", "Bombyx mori")
        invalid = {**self.payload, "species_id": other_species_id, "name": "other"}
        with self.assertRaisesRegex(ValueError, "must belong to the selected species"):
            self.db.create_behavior(invalid)

    def test_request_only_accepts_on_or_off(self):
        self.assertEqual(BehaviorRequest(**self.payload).status, "on")
        with self.assertRaises(ValidationError):
            BehaviorRequest(**{**self.payload, "status": "enabled"})

    def test_channel_cannot_be_deleted_while_in_use(self):
        self.db.create_behavior(self.payload)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.delete_stimulation_channel(self.channel_id)

    def test_channel_species_cannot_change_while_in_use(self):
        self.db.create_behavior(self.payload)
        other_species_id = self.db.create_species("MOTH", "Bombyx mori")
        other_position_1 = self.db.create_stimulation_position("ML", species="MOTH")
        other_position_2 = self.db.create_stimulation_position("MR", species="MOTH")
        with self.assertRaisesRegex(ValueError, "cannot change"):
            self.db.update_stimulation_channel(self.channel_id, {
                "species_id": other_species_id,
                "channel_name": "Moth Channel",
                "channel_pin_1": 7,
                "channel_pin_2": 8,
                "channel_pin_1_position_id": other_position_1,
                "channel_pin_2_position_id": other_position_2,
                "channel_freq_hz": 50.0,
                "channel_stim_duration_ms": 500,
            })


if __name__ == "__main__":
    unittest.main()
