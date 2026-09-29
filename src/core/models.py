"""Core data models for Experiment Automation System."""

from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime
import math
import re


_SUBJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


@dataclass
class Subject:
    subject_id: str
    body_length_cm: Optional[float] = None
    body_weight_g: Optional[float] = None
    notes: Optional[str] = None


@dataclass
class StimulusConfig:
    voltage_v: float = 2.0
    waveform: str = "SQUARE"
    high_level_v: Optional[float] = None
    low_level_v: float = 0.0
    duty_cycle_pct: float = 50.0
    frequency_hz: float = 50.0
    duration_s: float = 0.5
    count: int = 1
    interval_s: float = 0.0
    position: str = "Head"
    position_id: Optional[int] = None
    position_2_id: Optional[int] = None

    def __post_init__(self) -> None:
        self.waveform = self.waveform.upper()
        if self.high_level_v is None:
            self.high_level_v = self.low_level_v + self.voltage_v
        self.voltage_v = self.high_level_v - self.low_level_v


@dataclass
class TimingConfig:
    baseline_duration_s: float = 2.0
    post_stim_duration_s: float = 3.0


@dataclass
class TrialConfig:
    subject: Subject
    trial_no: int
    experiment_id: Optional[int] = None
    stimulus: StimulusConfig = field(default_factory=StimulusConfig)
    timing: TimingConfig = field(default_factory=TimingConfig)

    def validate(self) -> None:
        """Reject values that are unsafe for hardware or video filenames."""
        if not _SUBJECT_ID_PATTERN.fullmatch(self.subject.subject_id):
            raise ValueError(
                "Subject ID must be 1–64 characters and contain only letters, numbers, underscores, and hyphens."
            )
        if self.trial_no < 1:
            raise ValueError("Trial Number must be greater than or equal to 1.")

        self.stimulus.waveform = self.stimulus.waveform.upper()
        if self.stimulus.high_level_v is None:
            self.stimulus.high_level_v = self.stimulus.low_level_v + self.stimulus.voltage_v
        self.stimulus.voltage_v = self.stimulus.high_level_v - self.stimulus.low_level_v
        numeric_values = {
            "High level": self.stimulus.high_level_v,
            "Low level": self.stimulus.low_level_v,
            "Duty cycle": self.stimulus.duty_cycle_pct,
            "Frequency": self.stimulus.frequency_hz,
            "Duration": self.stimulus.duration_s,
            "Interval": self.stimulus.interval_s,
            "Baseline": self.timing.baseline_duration_s,
            "Post-stim": self.timing.post_stim_duration_s,
        }
        for name, value in numeric_values.items():
            if not math.isfinite(value):
                raise ValueError(f"{name} must be a finite number.")

        if self.stimulus.waveform not in {"SQUARE", "PULSE", "SINE", "RAMP"}:
            raise ValueError("Waveform must be SQUARE, PULSE, SINE, or RAMP.")
        if self.stimulus.high_level_v <= self.stimulus.low_level_v:
            raise ValueError("High level must be greater than Low level.")
        if not 0 < self.stimulus.duty_cycle_pct < 100:
            raise ValueError("Duty cycle must be greater than 0 and less than 100%.")
        if self.stimulus.frequency_hz <= 0:
            raise ValueError("Frequency must be greater than 0.")
        if self.stimulus.duration_s <= 0:
            raise ValueError("Duration must be greater than 0.")
        if self.stimulus.count < 1:
            raise ValueError("Count must be greater than or equal to 1.")
        if self.stimulus.interval_s < 0:
            raise ValueError("Interval cannot be less than 0.")
        if self.timing.baseline_duration_s < 0 or self.timing.post_stim_duration_s < 0:
            raise ValueError("Baseline and Post-stim cannot be less than 0.")

    def generate_video_id(self, dt: Optional[datetime] = None) -> str:
        """Format: {SubjectID}_T{TrialNo}_{Timestamp} (e.g. B07_T003_20260828_143216)"""
        if dt is None:
            dt = datetime.now()
        timestamp_str = dt.strftime("%Y%m%d_%H%M%S")
        return f"{self.subject.subject_id}_T{self.trial_no:03d}_{timestamp_str}"

    def generate_video_filename(self, video_id: str) -> str:
        return f"{video_id}.webm"


@dataclass
class TrialResult:
    trial_id: Optional[int] = None
    experiment_id: Optional[int] = None
    subject_id: str = ""
    trial_no: int = 1
    video_id: str = ""
    video_file: str = ""
    experiment_timestamp: str = ""
    stimulation_time: Optional[str] = None
    
    # Stimulus params
    stimulation_position: str = ""
    stimulation_position_id: Optional[int] = None
    stimulation_position_2_id: Optional[int] = None
    stimulation_voltage_v: float = 0.0
    stimulation_waveform: str = "SQUARE"
    stimulation_high_level_v: float = 0.0
    stimulation_low_level_v: float = 0.0
    stimulation_duty_cycle_pct: float = 50.0
    stimulation_frequency_hz: float = 0.0
    stimulation_duration_s: float = 0.0
    stimulation_count: int = 1
    stimulation_interval_s: float = 0.0
    
    # Timings
    baseline_duration_s: float = 2.0
    post_stim_duration_s: float = 3.0
    
    # Status
    status: str = "COMPLETED"  # 'COMPLETED', 'FAILED', 'ABORTED'
    error_message: Optional[str] = None
    
    # Post annotations
    response_latency_s: Optional[float] = None
    response_action: Optional[str] = None
    response_degree: Optional[float] = None

    def to_dict(self):
        return asdict(self)
