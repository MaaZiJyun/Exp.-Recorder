"""XIAO ESP32S3 Sense Camera Controller via USB Serial."""

import logging
from pathlib import Path
import struct
import threading
import time
from typing import Optional, List

from src.config import DEFAULT_SERIAL_BAUD, VIDEO_DIR
from src.core.webm_writer import WebmVideoWriter

logger = logging.getLogger(__name__)


class XiaoCameraDriver:
    """Controls XIAO and saves its USB MJPEG stream as silent WebM on the Mac."""

    STREAM_MAGIC = b"EXPREC01"
    MAX_JPEG_SIZE = 2_000_000

    def __init__(
        self,
        port: Optional[str] = None,
        baudrate: int = DEFAULT_SERIAL_BAUD,
        timeout: float = 2.0,
        mock: bool = False,
        output_dir: Optional[Path] = None,
    ):
        self._requested_port = port
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.mock = mock
        self._serial = None
        self._is_recording = False
        self._is_connected = False
        self.last_error: Optional[str] = None
        self.output_dir = Path(output_dir) if output_dir else VIDEO_DIR
        self.last_video_file: Optional[Path] = None
        self._stream_thread: Optional[threading.Thread] = None
        self._stream_complete = threading.Event()
        self._stream_abort = threading.Event()
        self._stream_succeeded = False
        self._latest_frame: Optional[bytes] = None
        self._serial_lock = threading.Lock()

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    @property
    def is_recording(self) -> bool:
        return self._is_recording

    @staticmethod
    def list_ports() -> List[str]:
        """Lists available serial ports."""
        try:
            import serial.tools.list_ports
            ports = serial.tools.list_ports.comports()
            return [p.device for p in ports]
        except ImportError:
            logger.warning("pyserial is not installed. Install via `pip install pyserial`.")
            return []

    @staticmethod
    def _candidate_ports() -> List[str]:
        """Return likely XIAO ports first, while excluding virtual Bluetooth ports."""
        try:
            import serial.tools.list_ports
            ports = list(serial.tools.list_ports.comports())
        except ImportError:
            return []

        def score(port) -> tuple[int, str]:
            details = " ".join(
                str(value or "")
                for value in (
                    port.device,
                    getattr(port, "description", ""),
                    getattr(port, "manufacturer", ""),
                    getattr(port, "product", ""),
                    getattr(port, "hwid", ""),
                )
            ).lower()
            if "bluetooth" in details:
                return (99, port.device)
            if "xiao" in details or "seeed" in details or "esp32" in details:
                return (0, port.device)
            if "usbmodem" in details:
                return (1, port.device)
            if "usbserial" in details or "wch" in details or "cp210" in details:
                return (2, port.device)
            return (10, port.device)

        # Do not open unrelated debug consoles or built-in serial devices just
        # because they happen to be present on the Mac.
        return [p.device for p in sorted(ports, key=score) if score(p)[0] <= 2]

    def connect(self) -> bool:
        self.last_error = None
        if self.mock:
            logger.info("XIAO Camera running in MOCK mode.")
            self._is_connected = True
            return True

        try:
            import serial
            candidates = (
                [self._requested_port]
                if self._requested_port
                else self._candidate_ports()
            )
            if not candidates:
                raise ConnectionError("No serial ports found for XIAO ESP32S3.")

            failures = []
            for candidate in candidates:
                try:
                    logger.info(
                        f"Connecting to XIAO ESP32S3 on {candidate} at {self.baudrate} baud..."
                    )
                    self._serial = serial.Serial(
                        port=candidate,
                        baudrate=self.baudrate,
                        timeout=0.25,
                        write_timeout=2.0,
                    )
                    # Opening USB CDC can reset the ESP32-S3. Camera/PSRAM setup can
                    # take several seconds, so probe repeatedly instead of failing once.
                    self._is_connected = True
                    deadline = time.monotonic() + 8.0
                    while time.monotonic() < deadline:
                        if self.ping(timeout=min(1.0, deadline - time.monotonic())):
                            self.port = candidate
                            self.last_error = None
                            return True
                        time.sleep(0.15)
                    raise ConnectionError(
                        self.last_error
                        or "recorder firmware did not become ready within 8 seconds"
                    )
                except Exception as exc:
                    failures.append(f"{candidate}: {exc}")
                    if self._serial:
                        try:
                            self._serial.close()
                        except Exception:
                            pass
                    self._serial = None
                    self._is_connected = False
                    self.last_error = None
            raise ConnectionError("; ".join(failures))
        except Exception as e:
            logger.error(f"Failed to connect to XIAO Camera: {e}")
            self.last_error = str(e)
            if self._serial:
                try:
                    self._serial.close()
                except Exception:
                    pass
            self._serial = None
            self._is_connected = False
            return False

    def disconnect(self) -> None:
        if self.mock:
            self._is_recording = False
            self._is_connected = False
            return

        if self._serial and self._serial.is_open:
            try:
                if self._is_recording:
                    self.stop_record()
                self._serial.close()
            except Exception:
                pass
        self._serial = None
        self._is_recording = False
        self._is_connected = False

    def _send_command(self, cmd: str) -> None:
        if self.mock:
            logger.debug(f"[MOCK XIAO SEND] {cmd}")
            return
        if not self._serial or not self._serial.is_open:
            raise ConnectionError("XIAO Camera is not connected.")
        msg = f"{cmd.strip()}\n".encode("utf-8")
        self._serial.write(msg)
        self._serial.flush()

    def _read_response(self, timeout: float = 3.0) -> str:
        if self.mock:
            return "OK"
        if not self._serial or not self._serial.is_open:
            raise ConnectionError("XIAO Camera is not connected.")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self._serial.in_waiting:
                line = self._serial.readline().decode("utf-8", errors="ignore").strip()
                if line:
                    logger.debug(f"[XIAO RECV] {line}")
                    return line
            time.sleep(0.01)
        return ""

    def _wait_for_response(self, accepted: tuple[str, ...], timeout: float) -> str:
        """Read complete lines until an expected protocol response is received."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            remaining = max(0.0, deadline - time.monotonic())
            response = self._read_response(timeout=min(0.5, remaining))
            if response and any(token in response for token in accepted):
                return response
        return ""

    def ping(self, timeout: float = 2.0) -> bool:
        """Pings the device to check communication."""
        if self.mock:
            return True
        try:
            with self._serial_lock:
                self._send_command("PING")
                resp = self._wait_for_response(
                    ("READY", "PONG", "OK", "ERROR"), timeout=timeout
                )
            if "ERROR" in resp:
                self.last_error = resp
            return "READY" in resp or "PONG" in resp or "OK" in resp
        except Exception as e:
            logger.warning(f"Ping failed: {e}")
            return False

    def start_record(self, video_id: str, timeout: float = 5.0) -> bool:
        """Start XIAO streaming and encode incoming JPEG frames as WebM."""
        self.last_error = None
        self.last_video_file = self.output_dir / f"{video_id}.webm"
        logger.info(f"Starting recording on XIAO ESP32S3 for Video ID: {video_id}")
        with self._serial_lock:
            self._send_command(f"START_RECORD {video_id}")
            # The command may have reached the recorder even if its acknowledgement
            # is lost. Keep this true so failure cleanup sends STOP_RECORD safely.
            self._is_recording = True

            if self.mock:
                return True

            resp = self._wait_for_response(("RECORDING", "ERROR"), timeout=timeout)
        if "RECORDING" in resp:
            try:
                writer = WebmVideoWriter(self.last_video_file)
                writer.open()
                self._stream_complete.clear()
                self._stream_abort.clear()
                self._stream_succeeded = False
                self._stream_thread = threading.Thread(
                    target=self._receive_stream,
                    args=(writer,),
                    name="xiao-usb-video",
                    daemon=True,
                )
                self._stream_thread.start()
                logger.info(f"XIAO USB video stream -> {self.last_video_file}")
                return True
            except Exception as exc:
                self.last_error = f"Could not create local video file: {exc}"
                logger.error(self.last_error)
                try:
                    self._send_command("STOP_RECORD")
                except Exception:
                    pass
                self._is_recording = False
                return False
        if "ERROR" in resp:
            logger.error(f"XIAO returned error starting recording: {resp}")
            self.last_error = resp
            self._is_recording = False
            return False
        logger.error("Timeout waiting for RECORDING confirmation from XIAO.")
        self.last_error = "Timeout waiting for RECORDING confirmation from XIAO."
        return False

    def _read_exact(self, size: int, deadline: Optional[float] = None) -> bytes:
        if not self._serial or not self._serial.is_open:
            raise ConnectionError("XIAO Camera is not connected.")
        data = bytearray()
        while len(data) < size:
            if deadline is not None and time.monotonic() >= deadline:
                raise TimeoutError("Timed out waiting for a camera frame")
            if self._stream_abort.is_set():
                raise RuntimeError("USB video receiver was aborted")
            chunk = self._serial.read(size - len(data))
            if chunk:
                data.extend(chunk)
        return bytes(data)

    def _read_stream_packet(self, timeout: Optional[float] = None) -> tuple[int, bytes]:
        """Find the next binary frame header, skipping textual status messages."""
        deadline = time.monotonic() + timeout if timeout is not None else None
        window = bytearray(self._read_exact(len(self.STREAM_MAGIC), deadline))
        while bytes(window) != self.STREAM_MAGIC:
            window.pop(0)
            window.extend(self._read_exact(1, deadline))
        length, sequence = struct.unpack("<II", self._read_exact(8, deadline))
        if length == 0:
            return sequence, b""
        if length > self.MAX_JPEG_SIZE:
            raise RuntimeError(f"Invalid USB JPEG frame size: {length}")
        return sequence, self._read_exact(length, deadline)

    def _receive_stream(self, writer: WebmVideoWriter) -> None:
        try:
            while True:
                _, jpeg = self._read_stream_packet(timeout=3.0)
                if not jpeg:
                    break
                self._latest_frame = jpeg
                writer.write_frame(jpeg)
            if writer.frame_count == 0:
                raise RuntimeError("XIAO USB stream ended without any video frames")
            self._stream_succeeded = True
            logger.info(f"Saved {writer.frame_count} USB video frames to {writer.path}")
        except Exception as exc:
            self.last_error = f"USB video stream failed: {exc}"
            logger.error(self.last_error)
        finally:
            writer.close()
            self._stream_complete.set()

    def capture_frame(self) -> Optional[bytes]:
        """Return the latest JPEG, capturing one frame when the camera is idle."""
        if not self._is_connected or self.mock:
            return self._latest_frame
        if self._is_recording:
            return self._latest_frame
        try:
            with self._serial_lock:
                self._send_command("CAPTURE")
                _, jpeg = self._read_stream_packet(timeout=3.0)
                if jpeg:
                    self._latest_frame = jpeg
                return self._latest_frame
        except Exception as exc:
            self.last_error = f"Camera preview failed: {exc}"
            logger.warning(self.last_error)
            return None

    def send_stim_mark(self) -> bool:
        """Sends STIM_MARK to indicate stimulus onset in recording metadata/LED."""
        logger.info("Sending STIM_MARK to XIAO ESP32S3.")
        self._send_command("STIM_MARK")
        return True

    def stop_record(self, timeout: float = 8.0) -> bool:
        """Stop XIAO streaming and finalize the WebM file stored on the Mac."""
        logger.info("Stopping XIAO USB video stream...")
        self._send_command("STOP_RECORD")
        
        if self.mock:
            self._is_recording = False
            return True

        if not self._stream_complete.wait(timeout=timeout):
            self._stream_abort.set()
            self.last_error = "Timeout waiting for the XIAO USB video stream to finish."
            logger.error(self.last_error)
        if self._stream_thread:
            self._stream_thread.join(timeout=1.0)
        self._is_recording = False
        return self._stream_succeeded
