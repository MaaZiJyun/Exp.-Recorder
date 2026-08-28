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

        task = self.controller.start_trial(
            TrialRequest(
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
        self.assertEqual(state["result"]["subject_id"], "WEB01")
        self.assertEqual(state["result"]["stimulation_waveform"], "PULSE")
        self.assertEqual(state["result"]["stimulation_high_level_v"], 4.0)
        self.assertEqual(state["result"]["stimulation_low_level_v"], 1.0)
        self.assertEqual(state["result"]["stimulation_duty_cycle_pct"], 30.0)
        self.assertTrue(state["logs"])

        cleared = self.controller.clear_data()
        self.assertEqual(cleared["trials_deleted"], 1)
        self.assertEqual(cleared["subjects_deleted"], 1)
        self.assertEqual(self.controller.db.list_trials(), [])
        self.assertEqual(self.controller.current_task()["status"], "IDLE")


if __name__ == "__main__":
    unittest.main()
