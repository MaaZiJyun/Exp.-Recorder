"""SIGLENT SDG1022X Function/Arbitrary Waveform Generator Controller."""

import logging
import time
from typing import Optional, List
from src.core.models import StimulusConfig

logger = logging.getLogger(__name__)


class SDG1022XDriver:
    """Controls SIGLENT SDG1022X using SCPI commands via PyVISA or simulated mode."""

    def __init__(self, resource_name: Optional[str] = None, mock: bool = False):
        self.resource_name = resource_name
        self.mock = mock
        self._rm = None
        self._inst = None
        self._is_connected = False
        self.last_error: Optional[str] = None

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    @staticmethod
    def list_resources() -> List[str]:
        """Lists available VISA resources (USB-TMC, LAN, Serial)."""
        try:
            import pyvisa
            rm = pyvisa.ResourceManager("@py")
            return list(rm.list_resources())
        except Exception as e:
            logger.warning(f"Failed to list VISA resources: {e}")
            return []

    def connect(self) -> bool:
        self.last_error = None
        if self.mock:
            logger.info("SDG1022X running in MOCK mode.")
            self._is_connected = True
            return True

        try:
            import pyvisa
            self._rm = pyvisa.ResourceManager("@py")
            if self.resource_name:
                candidates = [self.resource_name]
            else:
                resources = list(self._rm.list_resources())
                # Never fall back to ASRL: that is normally the XIAO serial port.
                # Prefer the known SIGLENT VID, then probe other USB/LAN instruments.
                candidates = sorted(
                    (r for r in resources if not r.upper().startswith("ASRL")),
                    key=lambda r: (
                        "F4EC" not in r.upper() and "62700" not in r,
                        not r.upper().startswith("USB"),
                        r,
                    ),
                )
            if not candidates:
                raise ConnectionError("No USB or LAN VISA instruments found.")

            failures = []
            for candidate in candidates:
                inst = None
                try:
                    logger.info(f"Probing SDG1022X at {candidate}...")
                    inst = self._rm.open_resource(candidate)
                    inst.timeout = 3000
                    inst.write_termination = "\n"
                    idn = inst.query("*IDN?").strip()
                    normalized_idn = idn.upper()
                    if "SIGLENT" not in normalized_idn or "SDG" not in normalized_idn:
                        raise ConnectionError(f"unexpected *IDN? response: {idn!r}")
                    self._inst = inst
                    self.resource_name = candidate
                    self._is_connected = True
                    logger.info(f"Connected to SDG1022X: {idn}")
                    return True
                except Exception as exc:
                    failures.append(f"{candidate}: {exc}")
                    if inst is not None:
                        try:
                            inst.close()
                        except Exception:
                            pass
            raise ConnectionError("; ".join(failures))
        except Exception as e:
            logger.error(f"Failed to connect to SDG1022X: {e}")
            self.last_error = str(e)
            self._is_connected = False
            self._inst = None
            if self._rm:
                try:
                    self._rm.close()
                except Exception:
                    pass
                self._rm = None
            return False

    def disconnect(self) -> None:
        if self.mock:
            self._is_connected = False
            return

        if self._inst:
            try:
                self.output_off(channel=1)
                self._inst.close()
            except Exception:
                pass
            self._inst = None
        if self._rm:
            try:
                self._rm.close()
            except Exception:
                pass
            self._rm = None
        self._is_connected = False

    def _write(self, cmd: str) -> None:
        if self.mock:
            logger.debug(f"[MOCK SDG WRITE] {cmd}")
            return
        if not self._inst:
            raise ConnectionError("SDG1022X is not connected.")
        self._inst.write(cmd)

    def _query(self, cmd: str) -> str:
        if self.mock:
            logger.debug(f"[MOCK SDG QUERY] {cmd}")
            return "Siglent Technologies,SDG1022X,MOCK_SERIAL,1.0.0"
        if not self._inst:
            raise ConnectionError("SDG1022X is not connected.")
        return self._inst.query(cmd).strip()

    def configure_stimulus(self, config: StimulusConfig, channel: int = 1) -> None:
        """Configures waveform generator channel with voltage, frequency, and waveform settings."""
        logger.info(
            f"Configuring SDG1022X CH{channel}: "
            f"Wave={config.waveform}, High={config.high_level_v}V, "
            f"Low={config.low_level_v}V, Duty={config.duty_cycle_pct}%, "
            f"Freq={config.frequency_hz}Hz, "
            f"Duration={config.duration_s}s, Count={config.count}, Interval={config.interval_s}s"
        )
        
        # Turn output off before configuration
        self.output_off(channel=channel)
        
        self._write(f"C{channel}:BSWV WVTP,{config.waveform}")
        self._write(f"C{channel}:BSWV FRQ,{config.frequency_hz}")
        self._write(f"C{channel}:BSWV HLEV,{config.high_level_v}")
        self._write(f"C{channel}:BSWV LLEV,{config.low_level_v}")
        if config.waveform == "SQUARE":
            self._write(f"C{channel}:BSWV DUTY,{config.duty_cycle_pct}")
        elif config.waveform == "PULSE":
            pulse_width_s = config.duty_cycle_pct / 100.0 / config.frequency_hz
            self._write(f"C{channel}:BSWV WIDTH,{pulse_width_s}")

        # Repetitions are gated explicitly in trigger_stimulus(). Leaving the
        # instrument burst generator enabled here would multiply the requested
        # count and produce a different stimulus train.
        self._write(f"C{channel}:BTWV STATE,OFF")

    def output_on(self, channel: int = 1) -> None:
        logger.info(f"SDG1022X CH{channel} Output ON")
        self._write(f"C{channel}:OUTP ON")

    def output_off(self, channel: int = 1) -> None:
        logger.info(f"SDG1022X CH{channel} Output OFF")
        self._write(f"C{channel}:OUTP OFF")

    def trigger_stimulus(self, config: StimulusConfig, channel: int = 1) -> None:
        """Executes stimulus output for the exact configured duration / pulse train."""
        logger.info(f"Executing stimulus on CH{channel}...")
        self.output_on(channel=channel)
        
        # Run stimulus for the specified count and intervals
        for i in range(config.count):
            if self.mock:
                time.sleep(min(0.1, config.duration_s))
            else:
                time.sleep(config.duration_s)
                
            if i < config.count - 1 and config.interval_s > 0:
                self.output_off(channel=channel)
                if self.mock:
                    time.sleep(min(0.1, config.interval_s))
                else:
                    time.sleep(config.interval_s)
                self.output_on(channel=channel)
                
        self.output_off(channel=channel)
        logger.info(f"Stimulus output finished on CH{channel}.")
