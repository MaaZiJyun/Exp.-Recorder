"""Trial Runner: Orchestrates Camera, Stimulator, and Database recording."""

import logging
import time
from datetime import datetime
from typing import Optional, Callable

from src.core.models import TrialConfig, TrialResult
from src.devices.sdg1022x import SDG1022XDriver
from src.devices.xiao_camera import XiaoCameraDriver
from src.database.db_manager import DatabaseManager

logger = logging.getLogger(__name__)


class TrialRunner:
    """Automates single trial execution pipeline."""

    def __init__(
        self,
        sdg_driver: SDG1022XDriver,
        camera_driver: XiaoCameraDriver,
        db_manager: DatabaseManager,
        status_callback: Optional[Callable[[str], None]] = None,
        persist_results: bool = True,
    ):
        self.sdg = sdg_driver
        self.camera = camera_driver
        self.db = db_manager
        self.persist_results = persist_results
        self.status_callback = status_callback

    def _notify_status(self, message: str) -> None:
        logger.info(message)
        if self.status_callback:
            try:
                self.status_callback(message)
            except Exception:
                pass

    def run_trial(self, config: TrialConfig) -> TrialResult:
        """Executes full automated experimental trial sequence:
        1. Ensure Subject exists in Database
        2. Generate Video ID & filename
        3. Configure SDG1022X
        4. Start XIAO Camera Recording
        5. Baseline delay
        6. Stimulus Mark & Trigger SDG1022X
        7. Post-stimulus delay
        8. Stop XIAO Camera Recording & verify SAVED
        9. Return the completed result for annotation before persistence
        """
        config.validate()
        now = datetime.now()
        video_id = config.generate_video_id(now)
        video_file = config.generate_video_filename(video_id)
        exp_timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

        result = TrialResult(
            experiment_id=config.experiment_id,
            subject_id=config.subject.subject_id,
            trial_no=config.trial_no,
            video_id=video_id,
            video_file=video_file,
            experiment_timestamp=exp_timestamp,
            stimulation_position=config.stimulus.position,
            stimulation_position_id=config.stimulus.position_id,
            stimulation_position_2_id=config.stimulus.position_2_id,
            stimulation_voltage_v=config.stimulus.voltage_v,
            stimulation_waveform=config.stimulus.waveform,
            stimulation_high_level_v=config.stimulus.high_level_v or 0.0,
            stimulation_low_level_v=config.stimulus.low_level_v,
            stimulation_duty_cycle_pct=config.stimulus.duty_cycle_pct,
            stimulation_frequency_hz=config.stimulus.frequency_hz,
            stimulation_duration_s=config.stimulus.duration_s,
            stimulation_count=config.stimulus.count,
            stimulation_interval_s=config.stimulus.interval_s,
            baseline_duration_s=config.timing.baseline_duration_s,
            post_stim_duration_s=config.timing.post_stim_duration_s,
            status="RUNNING"
        )

        try:
            # Persist subject metadata even when a later hardware preflight fails.
            self._notify_status(f"Saving subject info: {config.subject.subject_id}")
            self.db.upsert_subject(
                subject_id=config.subject.subject_id,
                body_length_cm=config.subject.body_length_cm,
                body_weight_g=config.subject.body_weight_g,
                notes=config.subject.notes
            )

            if not self.sdg.is_connected:
                raise ConnectionError("SDG1022X is not connected.")
            if not self.camera.is_connected:
                raise ConnectionError("XIAO ESP32S3 camera is not connected.")

            # 2. Configure SDG1022X
            self._notify_status("Configuring SDG1022X stimulus parameters...")
            self.sdg.configure_stimulus(config.stimulus)

            # 3. Start XIAO Camera Recording
            self._notify_status(f"Starting camera recording for {video_id}...")
            if not self.camera.start_record(video_id):
                raise RuntimeError(
                    self.camera.last_error
                    or "Failed to start camera recording on XIAO ESP32S3."
                )

            # 4. Baseline Recording
            self._notify_status(f"Recording baseline ({config.timing.baseline_duration_s}s)...")
            time.sleep(config.timing.baseline_duration_s)

            # 5. Timestamp & STIM_MARK
            stim_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            result.stimulation_time = stim_time
            self.camera.send_stim_mark()

            # 6. Trigger SDG1022X Output
            self._notify_status(
                f"Triggering {config.stimulus.waveform} stimulation "
                f"({config.stimulus.low_level_v}–{config.stimulus.high_level_v}V, "
                f"{config.stimulus.frequency_hz}Hz, {config.stimulus.duty_cycle_pct}% duty)..."
            )
            self.sdg.trigger_stimulus(config.stimulus)

            # 7. Post-stimulation Recording
            self._notify_status(f"Recording post-stimulus ({config.timing.post_stim_duration_s}s)...")
            time.sleep(config.timing.post_stim_duration_s)

            # 8. Stop Camera Recording
            self._notify_status("Stopping camera recording...")
            if not self.camera.stop_record():
                raise RuntimeError(
                    self.camera.last_error
                    or "Failed to save the XIAO USB video stream on the Mac."
                )
            if self.camera.last_video_file:
                result.video_file = str(self.camera.last_video_file)

            result.status = "COMPLETED"
            self._notify_status(f"Trial {config.trial_no} completed successfully!")

        except Exception as e:
            logger.exception("Trial execution error")
            result.status = "FAILED"
            result.error_message = str(e)
            self._notify_status(f"Trial failed: {e}")
            # Ensure safety: turn off stimulus output
            try:
                self.sdg.output_off()
            except Exception:
                pass
            # Attempt to stop recording if open
            if self.camera.is_recording:
                try:
                    self.camera.stop_record()
                except Exception:
                    pass

        if self.persist_results:
            try:
                result.trial_id = self.db.insert_trial(result.to_dict())
            except Exception as e:
                logger.error("Failed to record trial in SQLite: %s", e)
                result.status = "FAILED"
                result.error_message = result.error_message or f"Database save failed: {e}"
        return result
