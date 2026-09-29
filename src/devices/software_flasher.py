"""Compile and flash a software-library entry to a USB-connected XIAO ESP32S3."""

from __future__ import annotations

from pathlib import Path
from queue import Empty, Queue
import shutil
import subprocess
import threading
import time
from typing import Any, Callable, Optional
from urllib.parse import unquote, urlparse


ProgressCallback = Callable[[str, str], None]


class SoftwareFlasher:
    """Reusable Arduino CLI runner for local sketch folders stored in the library."""

    FQBN = "esp32:esp32:XIAO_ESP32S3"

    def __init__(self, arduino_cli: Optional[str] = None) -> None:
        self.arduino_cli = shutil.which("arduino-cli") if arduino_cli is None else arduino_cli

    @staticmethod
    def resolve_sketch(source_code_addr: str) -> Path:
        address = source_code_addr.strip()
        parsed = urlparse(address)
        if parsed.scheme and parsed.scheme != "file":
            raise ValueError("Flashing requires a local sketch path or file:// address.")
        raw_path = unquote(parsed.path) if parsed.scheme == "file" else address
        path = Path(raw_path).expanduser().resolve()
        if not path.exists():
            raise ValueError(f"Source path does not exist: {path}")
        sketch = path.parent if path.is_file() else path
        if not any(sketch.glob("*.ino")):
            raise ValueError(f"No Arduino .ino sketch was found in: {sketch}")
        return sketch

    def flash(
        self,
        source_code_addr: str,
        port: str,
        *,
        timeout: float = 300.0,
        progress: Optional[ProgressCallback] = None,
    ) -> dict[str, Any]:
        if not self.arduino_cli:
            return {"passed": False, "detail": "arduino-cli was not found."}
        try:
            sketch = self.resolve_sketch(source_code_addr)
        except ValueError as exc:
            return {"passed": False, "detail": str(exc)}

        command = [
            self.arduino_cli,
            "compile",
            "--fqbn",
            self.FQBN,
            "--upload",
            "--port",
            port,
            str(sketch),
        ]
        if progress:
            progress("compile", f"Compiling {sketch.name} for XIAO ESP32S3…")

        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            output_lines: list[str] = []
            output_queue: Queue[Optional[str]] = Queue()
            started_at = time.monotonic()
            assert process.stdout is not None

            def read_output() -> None:
                for line in process.stdout:
                    output_queue.put(line)
                output_queue.put(None)

            threading.Thread(target=read_output, daemon=True).start()
            output_finished = False
            while not output_finished:
                if time.monotonic() - started_at > timeout:
                    process.kill()
                    raise subprocess.TimeoutExpired(command, timeout)
                try:
                    line = output_queue.get(timeout=0.2)
                except Empty:
                    continue
                if line is None:
                    output_finished = True
                    continue
                message = line.strip()
                if message:
                    output_lines.append(message)
                    if progress:
                        progress("flash", message)

            return_code = process.wait(
                timeout=max(1.0, timeout - (time.monotonic() - started_at))
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"passed": False, "detail": f"Unable to flash program: {exc}"}

        output = "\n".join(output_lines)
        return {
            "passed": return_code == 0,
            "detail": (
                f"{sketch.name} was flashed successfully."
                if return_code == 0
                else output[-4000:] or "arduino-cli exited with an error."
            ),
            "sketch": str(sketch),
            "port": port,
            "fqbn": self.FQBN,
        }
