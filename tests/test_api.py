"""Tests for the local web API controller."""

import tempfile
import time
import unittest
from pathlib import Path

from src.api.server import ExperimentController, TrialRequest


class TestExperimentController(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.controller = ExperimentController(
            mock=True,
            db_path=Path(self.tmp_dir.name) / "api-test.db",
        )

    def tearDown(self):
        self.controller.close()
        self.tmp_dir.cleanup()

    def test_connect_and_run_trial(self):
        devices = self.controller.connect_devices()
        self.assertTrue(devices["sdg_connected"])
        self.assertTrue(devices["camera_connected"])
        experiment_id = self.controller.db.insert_experiment("Web API experiment")

        task = self.controller.start_trial(
            TrialRequest(
                experiment_id=experiment_id,
                subject_id="WEB01",
                waveform="PULSE",
                high_level_v=4.0,
                low_level_v=1.0,
                duty_cycle_pct=30.0,
                duration_s=0.01,
                baseline_duration_s=0,
                post_stim_duration_s=0,
            )
        )
        self.assertEqual(task["status"], "RUNNING")

        deadline = time.monotonic() + 2
        state = self.controller.current_task()
        while state["status"] == "RUNNING" and time.monotonic() < deadline:
            time.sleep(0.02)
            state = self.controller.current_task()

        self.assertEqual(state["status"], "COMPLETED")
        self.assertEqual(state["result"]["experiment_id"], experiment_id)
        self.assertEqual(state["result"]["subject_id"], "WEB01")
        self.assertEqual(state["result"]["stimulation_waveform"], "PULSE")
        self.assertEqual(state["result"]["stimulation_high_level_v"], 4.0)
        self.assertEqual(state["result"]["stimulation_low_level_v"], 1.0)
        self.assertEqual(state["result"]["stimulation_duty_cycle_pct"], 30.0)
        self.assertTrue(state["logs"])

        cleared = self.controller.clear_data()
        self.assertEqual(cleared["trials_deleted"], 1)
        self.assertEqual(cleared["subjects_deleted"], 1)
        self.assertEqual(cleared["experiments_deleted"], 1)
        self.assertEqual(self.controller.db.list_trials(), [])
        self.assertEqual(self.controller.current_task()["status"], "IDLE")

    def test_update_and_delete_single_trial(self):
        self.controller.db.upsert_subject("EDIT01")
        trial_id = self.controller.db.insert_trial({
            "subject_id": "EDIT01",
            "trial_no": 1,
            "video_id": "EDIT01_T001_TEST",
            "experiment_timestamp": "2026-08-28 12:00:00",
            "video_file": "EDIT01_T001_TEST.webm",
            "stimulation_position": "Head",
            "stimulation_voltage_v": 2.0,
            "stimulation_waveform": "SQUARE",
            "stimulation_high_level_v": 2.0,
            "stimulation_low_level_v": 0.0,
            "stimulation_duty_cycle_pct": 50.0,
            "stimulation_frequency_hz": 50.0,
            "stimulation_duration_s": 0.5,
            "stimulation_count": 1,
            "stimulation_interval_s": 1.0,
            "status": "COMPLETED",
        })

        updated = self.controller.db.update_trial(trial_id, {
            "stimulation_position": "Tail",
            "stimulation_frequency_hz": 200.0,
            "response_action": "2",
        })
        self.assertTrue(updated)
        row = self.controller.db.list_trials()[0]
        self.assertEqual(row["stimulation_position"], "Tail")
        self.assertEqual(row["stimulation_frequency_hz"], 200.0)
        self.assertEqual(row["response_action"], "2")

        self.assertTrue(self.controller.db.delete_trial(trial_id))
        self.assertEqual(self.controller.db.list_trials(), [])
        self.assertIsNotNone(self.controller.db.get_subject("EDIT01"))

    def test_subject_crud_and_rename(self):
        self.controller.db.upsert_subject(
            "S01", 4.2, 1.1, "first batch",
            body_width_cm=1.8,
            mandibular_length_cm=0.7,
            gender="Female",
            species="Test species",
            time_since_last_experiment_h=24,
        )
        subjects = self.controller.db.list_subjects()
        self.assertEqual(len(subjects), 1)
        self.assertEqual(subjects[0]["trial_count"], 0)
        self.assertEqual(subjects[0]["body_width_cm"], 1.8)
        self.assertEqual(subjects[0]["mandibular_length_cm"], 0.7)
        self.assertEqual(subjects[0]["gender"], "Female")
        self.assertEqual(subjects[0]["species"], "Test species")
        self.assertEqual(subjects[0]["time_since_last_experiment_h"], 24)

        self.assertTrue(
            self.controller.db.update_subject("S01", "S02", 4.5, 1.2, "updated")
        )
        self.assertIsNone(self.controller.db.get_subject("S01"))
        renamed = self.controller.db.get_subject("S02")
        self.assertEqual(renamed["body_length_cm"], 4.5)
        self.assertEqual(renamed["notes"], "updated")

        self.assertTrue(self.controller.db.delete_subject("S02"))
        self.assertEqual(self.controller.db.list_subjects(), [])

if __name__ == "__main__":
    unittest.main()
