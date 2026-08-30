"""Unit and integration tests for Exp.-Recorder using standard unittest."""

import tempfile
import unittest
import sqlite3
from pathlib import Path

from src.database.db_manager import DatabaseManager
from src.devices.sdg1022x import SDG1022XDriver
from src.devices.xiao_camera import XiaoCameraDriver
from src.core.models import Subject, StimulusConfig, TimingConfig, TrialConfig
from src.core.trial_runner import TrialRunner


class TestExpRecorder(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.tmp_dir.name) / "test_exp.db"
        self.db = DatabaseManager(db_path=db_path)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_db_manager_crud(self):
        # Upsert subject
        self.db.upsert_subject("B07", body_length_cm=5.2, body_weight_g=1.8, notes="Healthy")
        subj = self.db.get_subject("B07")
        self.assertIsNotNone(subj)
        self.assertEqual(subj["subject_id"], "B07")
        self.assertEqual(subj["body_length_cm"], 5.2)
        self.assertEqual(subj["body_weight_g"], 1.8)

        # Next trial number
        self.assertEqual(self.db.get_next_trial_no("B07"), 1)

        experiment_id = self.db.insert_experiment("Startle response", "Initial cohort")
        experiment = self.db.get_experiment(experiment_id)
        self.assertEqual(experiment["title"], "Startle response")
        self.assertTrue(self.db.update_experiment(experiment_id, "Startle response v2", "Updated"))
        self.assertEqual(self.db.get_experiment(experiment_id)["description"], "Updated")

        # Insert Trial
        trial_data = {
            "experiment_id": experiment_id,
            "subject_id": "B07",
            "trial_no": 1,
            "video_id": "B07_T001_20260828_120000",
            "experiment_timestamp": "2026-08-28 12:00:00",
            "video_file": "B07_T001_20260828_120000.webm",
            "stimulation_time": "2026-08-28 12:00:02.000",
            "stimulation_position": "Head",
            "stimulation_voltage_v": 2.5,
            "stimulation_frequency_hz": 100.0,
            "stimulation_duration_s": 0.2,
            "stimulation_count": 1,
            "stimulation_interval_s": 0.0,
            "baseline_duration_s": 2.0,
            "post_stim_duration_s": 3.0,
            "status": "COMPLETED"
        }
        trial_id = self.db.insert_trial(trial_data)
        self.assertEqual(trial_id, 1)
        self.assertEqual(self.db.get_next_trial_no("B07"), 2)

        # Update response annotation
        updated = self.db.update_trial_response(
            trial_id,
            response_latency_s=0.035,
            response_action="C-start",
            response_degree=45.0
        )
        self.assertTrue(updated)

        trials = self.db.list_trials(subject_id="B07")
        self.assertEqual(len(trials), 1)
        self.assertEqual(trials[0]["response_action"], "C-start")
        self.assertEqual(trials[0]["response_latency_s"], 0.035)
        self.assertEqual(trials[0]["experiment_id"], experiment_id)
        self.assertEqual(trials[0]["experiment_title"], "Startle response v2")
        self.assertEqual(len(self.db.list_trials(experiment_id=experiment_id)), 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.delete_experiment(experiment_id)

        cleared = self.db.clear_all_data()
        self.assertEqual(cleared, {
            "trials_deleted": 1,
            "subjects_deleted": 1,
            "experiments_deleted": 1,
        })
        self.assertEqual(self.db.list_trials(), [])
        self.assertEqual(self.db.list_experiments(), [])
        self.assertIsNone(self.db.get_subject("B07"))

    def test_full_mock_trial_execution(self):
        sdg = SDG1022XDriver(mock=True)
        camera = XiaoCameraDriver(mock=True)
        
        self.assertTrue(sdg.connect())
        self.assertTrue(camera.connect())

        status_logs = []
        runner = TrialRunner(
            sdg_driver=sdg,
            camera_driver=camera,
            db_manager=self.db,
            status_callback=lambda msg: status_logs.append(msg)
        )

        subject = Subject(subject_id="B07", body_length_cm=4.8, body_weight_g=1.5)
        stimulus = StimulusConfig(
            voltage_v=3.0,
            frequency_hz=50.0,
            duration_s=0.1,
            count=2,
            interval_s=0.1,
            position="Tail"
        )
        timing = TimingConfig(baseline_duration_s=0.1, post_stim_duration_s=0.1)
        config = TrialConfig(subject=subject, trial_no=1, stimulus=stimulus, timing=timing)

        result = runner.run_trial(config)

        self.assertEqual(result.status, "COMPLETED")
        self.assertEqual(result.subject_id, "B07")
        self.assertEqual(result.trial_no, 1)
        self.assertIn("B07_T001_", result.video_id)
        self.assertTrue(result.video_file.endswith(".webm"))
        self.assertIsNotNone(result.stimulation_time)
        self.assertIsNotNone(result.trial_id)

        trials = self.db.list_trials()
        self.assertEqual(len(trials), 1)
        self.assertEqual(trials[0]["video_id"], result.video_id)
        self.assertEqual(trials[0]["stimulation_waveform"], "SQUARE")
        self.assertEqual(trials[0]["stimulation_high_level_v"], 3.0)
        self.assertEqual(trials[0]["stimulation_low_level_v"], 0.0)
        self.assertEqual(trials[0]["stimulation_duty_cycle_pct"], 50.0)

    def test_existing_database_is_migrated_with_experiment_relation(self):
        legacy_db = Path(self.tmp_dir.name) / "legacy.db"
        with sqlite3.connect(legacy_db) as conn:
            conn.executescript("""
                CREATE TABLE subjects (subject_id TEXT PRIMARY KEY);
                CREATE TABLE trials (
                    trial_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id TEXT NOT NULL,
                    trial_no INTEGER NOT NULL,
                    video_id TEXT NOT NULL UNIQUE,
                    experiment_timestamp TEXT NOT NULL,
                    video_file TEXT NOT NULL,
                    stimulation_voltage_v REAL NOT NULL,
                    stimulation_frequency_hz REAL NOT NULL,
                    stimulation_duration_s REAL NOT NULL
                );
            """)

        migrated = DatabaseManager(db_path=legacy_db)
        with migrated.get_connection() as conn:
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(trials)")}
            foreign_keys = conn.execute("PRAGMA foreign_key_list(trials)").fetchall()

        self.assertIn("experiment_id", columns)
        self.assertTrue(any(row["table"] == "experiment" for row in foreign_keys))

    def test_trial_rejects_unknown_experiment(self):
        self.db.upsert_subject("B10")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.insert_trial({
                "experiment_id": 999,
                "subject_id": "B10",
                "trial_no": 1,
                "video_id": "B10_T001_UNKNOWN_EXP",
                "experiment_timestamp": "2026-08-30 12:00:00",
                "video_file": "B10_T001_UNKNOWN_EXP.webm",
                "stimulation_voltage_v": 2.0,
                "stimulation_frequency_hz": 50.0,
                "stimulation_duration_s": 0.5,
            })

    def test_trial_rejects_unsafe_subject_id(self):
        config = TrialConfig(subject=Subject(subject_id="../escape"), trial_no=1)
        with self.assertRaisesRegex(ValueError, "Subject ID"):
            config.validate()

    def test_disconnected_devices_fail_safely_and_are_recorded(self):
        sdg = SDG1022XDriver(mock=True)
        camera = XiaoCameraDriver(mock=True)
        runner = TrialRunner(sdg, camera, self.db)
        config = TrialConfig(
            subject=Subject(subject_id="B08"),
            trial_no=1,
            timing=TimingConfig(baseline_duration_s=0, post_stim_duration_s=0),
        )

        with self.assertLogs("src.core.trial_runner", level="ERROR"):
            result = runner.run_trial(config)

        self.assertEqual(result.status, "FAILED")
        self.assertIn("not connected", result.error_message)
        self.assertEqual(self.db.list_trials(subject_id="B08")[0]["status"], "FAILED")

    def test_sdg_repetitions_do_not_enable_hardware_burst(self):
        sdg = SDG1022XDriver(mock=True)
        commands = []
        sdg._write = commands.append
        config = StimulusConfig(
            waveform="PULSE",
            high_level_v=3.3,
            low_level_v=0.2,
            duty_cycle_pct=25,
            count=3,
            interval_s=0.2,
        )

        sdg.configure_stimulus(config)

        self.assertIn("C1:BTWV STATE,OFF", commands)
        self.assertIn("C1:BSWV WVTP,PULSE", commands)
        self.assertIn("C1:BSWV HLEV,3.3", commands)
        self.assertIn("C1:BSWV LLEV,0.2", commands)
        self.assertIn("C1:BSWV WIDTH,0.005", commands)
        self.assertFalse(any("STATE,ON" in command for command in commands))

    def test_stimulus_levels_and_duty_are_validated(self):
        config = TrialConfig(
            subject=Subject(subject_id="B09"),
            trial_no=1,
            stimulus=StimulusConfig(high_level_v=0, low_level_v=1, duty_cycle_pct=100),
        )
        with self.assertRaisesRegex(ValueError, "High level"):
            config.validate()


if __name__ == "__main__":
    unittest.main()
