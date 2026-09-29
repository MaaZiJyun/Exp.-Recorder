"""Reusable inventory health checker for Seeed XIAO ESP32S3 boards."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from queue import Empty, Queue
import shutil
import subprocess
import threading
import time
from typing import Any, Callable, Optional


ProgressCallback = Callable[[str, str], None]


@dataclass(frozen=True)
class SerialPortInfo:
    device: str
    product: Optional[str]
    manufacturer: Optional[str]
    serial_number: Optional[str]
    vid: Optional[int]
    pid: Optional[int]
    hwid: Optional[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class XiaoESP32S3HealthCheck:
    """Discover, flash, and exercise an inventory XIAO ESP32S3 over USB CDC."""

    FQBN = "esp32:esp32:XIAO_ESP32S3"
    BAUDRATE = 115200
    FIRMWARE_ID = "XIAO_HEALTHCHECK_V4"
    GPIO_PINS = tuple(f"D{index}" for index in range(11))
    INTERFACE_TESTS = {
        "gpio": {
            "command": "HEALTH_GPIO",
            "title": "GPIO Digital Loopback",
            "instruction": "Power off the board, connect D0 and D1 with a jumper wire, then power it on again.",
        },
        "pwm": {
            "command": "HEALTH_PWM",
            "title": "PWM Output",
            "instruction": "Power off the board, connect D2 and D3 with a jumper wire, then power it on again.",
        },
        "uart": {
            "command": "HEALTH_UART",
            "title": "UART Loopback",
            "instruction": "Power off the board, connect D6/TX and D7/RX with a jumper wire, then power it on again.",
        },
        "spi": {
            "command": "HEALTH_SPI",
            "title": "SPI Loopback",
            "instruction": "Power off the board, connect D10/MOSI and D9/MISO with a jumper wire, then power it on again. D8/SCK is initialized by the controller.",
        },
        "i2c": {
            "command": "HEALTH_I2C",
            "title": "I²C Peripheral Scan (module required; optional)",
            "instruction": "This test cannot be performed with only a loopback wire. The XIAO has metal pads/header positions along both sides: connect the module's SDA to the pad labeled D4, SCL to D5, VCC to 3V3, and GND to any pad labeled GND. If headers are not installed, solder headers or test leads first. Skip this test if no I²C module is available. Never short D4 and D5 together.",
        },
    }

    def __init__(
        self,
        sketch_dir: Optional[Path] = None,
        arduino_cli: Optional[str] = None,
    ) -> None:
        self.sketch_dir = sketch_dir or (
            Path(__file__).resolve().parents[2]
            / "data"
            / "software"
            / "xiao_esp32s3_healthcheck"
        )
        self.arduino_cli = shutil.which("arduino-cli") if arduino_cli is None else arduino_cli

    @staticmethod
    def discover() -> list[SerialPortInfo]:
        import serial.tools.list_ports

        found = []
        for port in serial.tools.list_ports.comports():
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
                continue
            if not (
                getattr(port, "vid", None) is not None
                or "usbmodem" in details
                or "usbserial" in details
                or "xiao" in details
                or "esp32" in details
                or "seeed" in details
            ):
                continue
            found.append(
                SerialPortInfo(
                    device=port.device,
                    product=getattr(port, "product", None)
                    or getattr(port, "description", None),
                    manufacturer=getattr(port, "manufacturer", None),
                    serial_number=getattr(port, "serial_number", None),
                    vid=getattr(port, "vid", None),
                    pid=getattr(port, "pid", None),
                    hwid=getattr(port, "hwid", None),
                )
            )
        return sorted(found, key=lambda item: item.device)

    def flash(
        self,
        port: str,
        timeout: float = 180.0,
        progress: Optional[ProgressCallback] = None,
    ) -> dict[str, Any]:
        if not self.arduino_cli:
            return {
                "passed": False,
                "detail": "arduino-cli was not found, so the diagnostic firmware cannot be flashed.",
            }
        command = [
            self.arduino_cli,
            "compile",
            "--fqbn",
            self.FQBN,
            "--upload",
            "--port",
            port,
            str(self.sketch_dir),
        ]
        if progress:
            progress("flash", "Compiling and flashing XIAO ESP32S3 diagnostic firmware…")
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            output_lines: list[str] = []
            started_at = time.monotonic()
            assert process.stdout is not None
            output_queue: Queue[Optional[str]] = Queue()

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
            return_code = process.wait(timeout=max(1.0, timeout - (time.monotonic() - started_at)))
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"passed": False, "detail": f"Failed to flash diagnostic firmware: {exc}"}
        output = "\n".join(output_lines)
        return {
            "passed": return_code == 0,
            "detail": "Diagnostic firmware flashed successfully." if return_code == 0 else output[-2000:],
        }

    def command(self, port: str, command: str, timeout: float = 8.0) -> dict[str, Any]:
        import serial

        try:
            with serial.Serial(
                port=port,
                baudrate=self.BAUDRATE,
                timeout=0.2,
                write_timeout=2.0,
            ) as connection:
                # Native USB CDC resets after upload/open. Drain startup output,
                # then issue the command repeatedly until the firmware replies.
                deadline = time.monotonic() + timeout
                next_send = 0.0
                lines: list[str] = []
                while time.monotonic() < deadline:
                    now = time.monotonic()
                    if now >= next_send:
                        connection.write(f"{command}\n".encode("utf-8"))
                        connection.flush()
                        next_send = now + 0.8
                    line = connection.readline().decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    lines.append(line)
                    if line.startswith(("PASS|", "FAIL|")) and "|READY|" not in line:
                        parts = line.split("|")
                        return {
                            "passed": parts[0] == "PASS",
                            "test": parts[1] if len(parts) > 1 else command,
                            "detail": "|".join(parts[2:]) if len(parts) > 2 else line,
                            "raw": line,
                        }
                return {
                    "passed": False,
                    "test": command,
                    "detail": "The diagnostic firmware did not respond. Confirm that flashing succeeded and select the USB port again.",
                    "raw": "\n".join(lines[-10:]),
                }
        except Exception as exc:
            return {
                "passed": False,
                "test": command,
                "detail": f"Unable to open inventory-board serial port {port}: {exc}",
                "raw": "",
            }

    def initial_checks(
        self,
        port: str,
        *,
        flash: bool = True,
        progress: Optional[ProgressCallback] = None,
    ) -> dict[str, Any]:
        if progress:
            progress("usb", f"Scanning inventory-board USB port: {port}")
        ports = {item.device: item for item in self.discover()}
        usb = ports.get(port)
        checks: dict[str, Any] = {
            "usb": {
                "passed": usb is not None,
                "detail": usb.to_dict() if usb else {"device": port},
            }
        }
        if usb is None:
            return {"port": port, "checks": checks, "steps": self.steps()}
        if flash:
            if progress:
                progress("firmware_probe", "Checking whether diagnostic firmware is already running on the board…")
            probe = self.command(port, "PING", timeout=2.5)
            already_installed = probe["passed"] and probe.get("detail") == self.FIRMWARE_ID
            if already_installed:
                checks["flash"] = {
                    "passed": True,
                    "skipped": True,
                    "detail": "Diagnostic firmware detected; flashing was skipped.",
                }
                if progress:
                    progress("firmware_probe", "Diagnostic firmware detected; compilation and flashing skipped.")
            else:
                checks["flash"] = self.flash(port, progress=progress)
            if not checks["flash"]["passed"]:
                return {"port": port, "checks": checks, "steps": self.steps()}
            if not already_installed:
                time.sleep(1.0)
        if progress:
            progress("identity", "Reading the product name, hardware MAC, and wireless capabilities…")
        identity = self.command(port, "HEALTH_INFO")
        if identity["passed"]:
            parts = identity["raw"].split("|")
            identity.update(
                {
                    "product": parts[2] if len(parts) > 2 else "XIAO ESP32S3",
                    "hardware_mac": parts[3] if len(parts) > 3 else None,
                    "wifi": "WIFI=1" in parts,
                    "bluetooth": "BLUETOOTH=1" in parts,
                }
            )
        checks["identity"] = identity
        if progress:
            progress("hello", "Running the Hello World test program…")
        checks["hello"] = self.command(port, "HEALTH_HELLO")
        if progress:
            progress("complete", "Basic health check complete. Waiting for interface wiring tests.")
        return {"port": port, "checks": checks, "steps": self.steps()}

    def run_interface_test(
        self,
        port: str,
        test: str,
        pin_a: Optional[str] = None,
        pin_b: Optional[str] = None,
    ) -> dict[str, Any]:
        config = self.INTERFACE_TESTS.get(test)
        if config is None:
            raise ValueError(f"Unsupported interface test: {test}")
        command = config["command"]
        response = {"id": test, **config}
        if test == "gpio":
            first = pin_a or "D0"
            second = pin_b or "D1"
            if first not in self.GPIO_PINS or second not in self.GPIO_PINS:
                raise ValueError("GPIO pin must be one of D0-D10")
            if first == second:
                raise ValueError("GPIO loopback requires two different pins")
            command = f"HEALTH_GPIO {first} {second}"
            response["instruction"] = f"Power off the board, connect {first} and {second} with a jumper wire, then power it on again."
            response["pins"] = [first, second]
        return {**response, "result": self.command(port, command)}

    @classmethod
    def steps(cls) -> list[dict[str, str]]:
        return [
            {"id": test, "title": config["title"], "instruction": config["instruction"]}
            for test, config in cls.INTERFACE_TESTS.items()
        ]
