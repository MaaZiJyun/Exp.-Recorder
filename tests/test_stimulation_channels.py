import sqlite3
import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from src.api.server import StimulationChannelRequest
from src.database.db_manager import DatabaseManager


class TestStimulationChannels(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db = DatabaseManager(Path(self.tmp_dir.name) / "channels.db")
        self.species_id = self.db.create_species("CRICKET", "Gryllus bimaculatus")
        self.position_1 = self.db.create_stimulation_position("LF", species="CRICKET")
        self.position_2 = self.db.create_stimulation_position("RF", species="CRICKET")
        self.payload = {
            "species_id": self.species_id,
            "channel_name": "Forward",
            "channel_pin_1": 7,
            "channel_pin_2": 8,
            "channel_pin_1_position_id": self.position_1,
            "channel_pin_2_position_id": self.position_2,
            "channel_freq_hz": 50.0,
            "channel_stim_duration_ms": 500,
        }

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_crud_and_joined_labels(self):
        channel_id = self.db.create_stimulation_channel(self.payload)
        channel = self.db.get_stimulation_channel(channel_id)
        self.assertIsNotNone(channel)
        self.assertEqual(channel["species_code"], "CRICKET")
        self.assertEqual(channel["channel_pin_1_position_code"], "LF")
        self.assertEqual(channel["channel_pin_2_position_code"], "RF")
        self.assertEqual(self.db.get_stimulation_position(self.position_1)["channel_count"], 1)

        updated = {**self.payload, "channel_name": "Turn Left", "channel_freq_hz": 75.5}
        self.assertTrue(self.db.update_stimulation_channel(channel_id, updated))
        self.assertEqual(self.db.list_stimulation_channels()[0]["channel_name"], "Turn Left")
        self.assertEqual(self.db.list_stimulation_channels()[0]["channel_freq_hz"], 75.5)

        self.assertTrue(self.db.delete_stimulation_channel(channel_id))
        self.assertEqual(self.db.list_stimulation_channels(), [])

    def test_relations_and_unique_name_are_enforced(self):
        self.db.create_stimulation_channel(self.payload)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.create_stimulation_channel(self.payload)

        other_species_id = self.db.create_species("MOTH", "Bombyx mori")
        invalid = {**self.payload, "species_id": other_species_id, "channel_name": "Other"}
        with self.assertRaisesRegex(ValueError, "belong to the selected species"):
            self.db.create_stimulation_channel(invalid)

    def test_request_validates_pin_range_and_distinct_pairs(self):
        self.assertEqual(
            StimulationChannelRequest(**self.payload).channel_stim_duration_ms,
            500,
        )
        with self.assertRaises(ValidationError):
            StimulationChannelRequest(**{**self.payload, "channel_pin_2": 9})
        with self.assertRaises(ValidationError):
            StimulationChannelRequest(**{**self.payload, "channel_pin_2": 7})
        with self.assertRaises(ValidationError):
            StimulationChannelRequest(
                **{**self.payload, "channel_pin_2_position_id": self.position_1}
            )

    def test_position_options_exclude_large_image_fields(self):
        options = self.db.list_stimulation_position_options()
        self.assertEqual(
            options,
            [
                {"position_id": self.position_1, "code": "LF", "species": "CRICKET"},
                {"position_id": self.position_2, "code": "RF", "species": "CRICKET"},
            ],
        )
        self.assertNotIn("image", options[0])


if __name__ == "__main__":
    unittest.main()
