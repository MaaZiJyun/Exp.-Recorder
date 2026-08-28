"""Interactive Command Line Interface for Experiment Automation."""

import sys
from typing import Optional

from src.core.models import Subject, StimulusConfig, TimingConfig, TrialConfig
from src.core.trial_runner import TrialRunner
from src.database.db_manager import DatabaseManager
from src.devices.sdg1022x import SDG1022XDriver
from src.devices.xiao_camera import XiaoCameraDriver
from src import config as cfg


def print_table(rows, headers):
    try:
        from tabulate import tabulate
        print("\n" + tabulate(rows, headers=headers, tablefmt="grid"))
    except ImportError:
        col_widths = [max(len(str(h)), max((len(str(r[i])) for r in rows), default=0)) + 2 for i, h in enumerate(headers)]
        header_line = " | ".join(str(h).ljust(col_widths[i]) for i, h in enumerate(headers))
        sep_line = "-+-".join("-" * col_widths[i] for i in range(len(headers)))
        print("\n" + header_line)
        print(sep_line)
        for r in rows:
            print(" | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(r)))


class ExperimentCLI:
    def __init__(self, mock: bool = False):
        self.mock = mock
        self.db = DatabaseManager()
        self.sdg = SDG1022XDriver(mock=mock)
        self.camera = XiaoCameraDriver(mock=mock)
        self.runner = TrialRunner(
            sdg_driver=self.sdg,
            camera_driver=self.camera,
            db_manager=self.db,
            status_callback=self._on_status
        )

    def _on_status(self, msg: str) -> None:
        print(f"[*] {msg}")

    def connect_devices(self) -> bool:
        print("\n--- Connecting to Hardware Devices ---")
        sdg_ok = self.sdg.connect()
        cam_ok = self.camera.connect()
        print(f"SDG1022X Status: {'CONNECTED' if sdg_ok else 'FAILED'}")
        print(f"XIAO Camera Status: {'CONNECTED' if cam_ok else 'FAILED'}")
        return sdg_ok and cam_ok

    def run_new_trial_interactive(self) -> None:
        print("\n=== CREATE & RUN NEW TRIAL ===")
        subject_id = input("Subject ID (e.g., B07): ").strip()
        if not subject_id:
            print("Subject ID cannot be empty.")
            return

        # Fetch existing subject info if available
        subj_info = self.db.get_subject(subject_id)
        default_len = subj_info["body_length_cm"] if subj_info and subj_info.get("body_length_cm") else ""
        default_wt = subj_info["body_weight_g"] if subj_info and subj_info.get("body_weight_g") else ""

        len_in = input(f"Subject Body Length in cm [{default_len}]: ").strip()
        body_length = float(len_in) if len_in else (float(default_len) if default_len else None)

        wt_in = input(f"Subject Body Weight in g [{default_wt}]: ").strip()
        body_weight = float(wt_in) if wt_in else (float(default_wt) if default_wt else None)

        subject = Subject(
            subject_id=subject_id,
            body_length_cm=body_length,
            body_weight_g=body_weight
        )

        next_trial_no = self.db.get_next_trial_no(subject_id)
        trial_no_in = input(f"Trial Number [{next_trial_no}]: ").strip()
        trial_no = int(trial_no_in) if trial_no_in else next_trial_no

        print("\n--- Stimulus Configuration ---")
        v_in = input(f"Voltage (V) [{cfg.DEFAULT_VOLTAGE_V}]: ").strip()
        voltage = float(v_in) if v_in else cfg.DEFAULT_VOLTAGE_V

        f_in = input(f"Frequency (Hz) [{cfg.DEFAULT_FREQUENCY_HZ}]: ").strip()
        freq = float(f_in) if f_in else cfg.DEFAULT_FREQUENCY_HZ

        d_in = input(f"Duration (s) [{cfg.DEFAULT_DURATION_S}]: ").strip()
        dur = float(d_in) if d_in else cfg.DEFAULT_DURATION_S

        c_in = input(f"Count [{cfg.DEFAULT_COUNT}]: ").strip()
        count = int(c_in) if c_in else cfg.DEFAULT_COUNT

        i_in = input(f"Interval (s) [{cfg.DEFAULT_INTERVAL_S}]: ").strip()
        interval = float(i_in) if i_in else cfg.DEFAULT_INTERVAL_S

        pos_in = input(f"Position [{cfg.DEFAULT_STIM_POSITION}]: ").strip()
        pos = pos_in if pos_in else cfg.DEFAULT_STIM_POSITION

        stimulus = StimulusConfig(
            voltage_v=voltage,
            frequency_hz=freq,
            duration_s=dur,
            count=count,
            interval_s=interval,
            position=pos
        )

        print("\n--- Timing Configuration ---")
        base_in = input(f"Baseline Duration (s) [{cfg.DEFAULT_BASELINE_DURATION_S}]: ").strip()
        baseline = float(base_in) if base_in else cfg.DEFAULT_BASELINE_DURATION_S

        post_in = input(f"Post-Stim Duration (s) [{cfg.DEFAULT_POST_STIM_DURATION_S}]: ").strip()
        post_stim = float(post_in) if post_in else cfg.DEFAULT_POST_STIM_DURATION_S

        timing = TimingConfig(
            baseline_duration_s=baseline,
            post_stim_duration_s=post_stim
        )

        trial_config = TrialConfig(
            subject=subject,
            trial_no=trial_no,
            stimulus=stimulus,
            timing=timing
        )
        try:
            trial_config.validate()
        except ValueError as e:
            print(f"Invalid trial configuration: {e}")
            return

        confirm = input(f"\nReady to execute Trial {trial_no} for Subject {subject_id}? [Y/n]: ").strip().lower()
        if confirm in ["", "y", "yes"]:
            print("\n>>> STARTING EXPERIMENT RUNNER >>>")
            result = self.runner.run_trial(trial_config)
            print("\n==========================================")
            print(f"Trial Completed with Status: {result.status}")
            print(f"Video File: {result.video_file}")
            print(f"Stimulation Time: {result.stimulation_time}")
            print("==========================================\n")
        else:
            print("Trial canceled.")

    def list_trials(self) -> None:
        subj_filter = input("Filter by Subject ID (leave blank for all): ").strip()
        subj_id = subj_filter if subj_filter else None
        trials = self.db.list_trials(subject_id=subj_id, limit=30)
        if not trials:
            print("No trial records found.")
            return

        headers = ["ID", "Subject", "Trial", "Video ID", "Stim Time", "Voltage", "Freq", "Status", "Latency(s)", "Action"]
        rows = []
        for t in trials:
            rows.append([
                t["trial_id"],
                t["subject_id"],
                t["trial_no"],
                t["video_id"],
                t["stimulation_time"] or "N/A",
                f"{t['stimulation_voltage_v']}V",
                f"{t['stimulation_frequency_hz']}Hz",
                t["status"],
                t["response_latency_s"] or "-",
                t["response_action"] or "-"
            ])
        print_table(rows, headers=headers)

    def annotate_trial_response(self) -> None:
        try:
            trial_id_in = input("Enter Trial ID to annotate: ").strip()
            if not trial_id_in:
                return
            trial_id = int(trial_id_in)
            latency_in = input("Response Latency (seconds): ").strip()
            latency = float(latency_in) if latency_in else None
            print("Response Action: 0=静止, 1=前进, 2=后退, 3=左转, 4=右转, "
                  "5=前左斜行, 6=前右斜行, 7=后左斜退, 8=后右斜退, 9=抬头")
            action = input("Action code (0-9, blank to clear): ").strip() or None
            if action is not None and action not in {str(i) for i in range(10)}:
                raise ValueError("Action code must be an integer from 0 to 9")
            print("Response Degree: 0=无反应, 1=轻微反应, 2=积极反应, 3=过激反应")
            degree_in = input("Degree score (0-3, blank to clear): ").strip()
            if degree_in and degree_in not in {str(i) for i in range(4)}:
                raise ValueError("Degree score must be an integer from 0 to 3")
            degree = float(degree_in) if degree_in else None

            success = self.db.update_trial_response(
                trial_id=trial_id,
                response_latency_s=latency,
                response_action=action,
                response_degree=degree
            )
            if success:
                print(f"Successfully updated response for Trial #{trial_id}")
            else:
                print(f"Trial ID {trial_id} not found.")
        except Exception as e:
            print(f"Error annotating trial: {e}")

    def main_menu(self) -> None:
        self.connect_devices()
        while True:
            print("\n==============================")
            print("  Experiment Automation System")
            print("==============================")
            print("1. Start New Trial (Auto Run)")
            print("2. List Historical Trials")
            print("3. Annotate Trial Response")
            print("4. Test Hardware Connections")
            print("5. Exit")
            choice = input("\nSelect an option [1-5]: ").strip()

            try:
                if choice == "1":
                    self.run_new_trial_interactive()
                elif choice == "2":
                    self.list_trials()
                elif choice == "3":
                    self.annotate_trial_response()
                elif choice == "4":
                    self.connect_devices()
                elif choice == "5":
                    print("Exiting...")
                    self.sdg.disconnect()
                    self.camera.disconnect()
                    break
                else:
                    print("Invalid choice.")
            except ValueError as e:
                print(f"Invalid numeric input: {e}")
            except EOFError:
                print("\nInput closed. Exiting...")
                self.sdg.disconnect()
                self.camera.disconnect()
                break
