"""Global configuration and defaults for Exp.-Recorder."""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "experiment.db"
VIDEO_DIR = DATA_DIR / "videos"

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_DIR.mkdir(parents=True, exist_ok=True)

# Hardware Default Settings
DEFAULT_SERIAL_PORT = "/dev/cu.usbmodem1101"  # Common macOS USB serial port for ESP32-S3
DEFAULT_SERIAL_BAUD = 2_000_000
DEFAULT_SERIAL_TIMEOUT = 2.0

# SIGLENT SDG1022X SCPI Visa Resource or IP
DEFAULT_SDG_RESOURCE = "USB0::0xF4EC::0x1103::SDG1X...::INSTR"  # Or TCPIP0::192.168.1.100::inst0::INSTR

# Experiment Timing Defaults (seconds)
DEFAULT_BASELINE_DURATION_S = 2.0   # Pre-stimulus recording
DEFAULT_POST_STIM_DURATION_S = 3.0  # Post-stimulus recording

# Stimulus Defaults
DEFAULT_VOLTAGE_V = 3.3
DEFAULT_WAVEFORM = "PULSE"
DEFAULT_HIGH_LEVEL_V = 8
DEFAULT_LOW_LEVEL_V = -8
DEFAULT_DUTY_CYCLE_PCT = 50.0
DEFAULT_FREQUENCY_HZ = 200.0
DEFAULT_DURATION_S = 0.5
DEFAULT_COUNT = 1
DEFAULT_INTERVAL_S = 1.0
DEFAULT_STIM_POSITION = "Head"
