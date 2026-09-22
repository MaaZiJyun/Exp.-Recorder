import sys
import types
import unittest
from unittest.mock import patch

from src.devices.xiao_healthcheck import SerialPortInfo, XiaoESP32S3HealthCheck


class _Port:
    def __init__(self, device, description, *, vid=None, pid=None, serial_number=None):
        self.device = device
        self.description = description
        self.product = description
        self.manufacturer = "Seeed Studio" if vid else None
        self.vid = vid
        self.pid = pid
        self.serial_number = serial_number
        self.hwid = f"USB VID:PID={vid:04X}:{pid:04X}" if vid and pid else "n/a"


class _FakeSerial:
    def __init__(self, **_kwargs):
        self.responses = [b"PASS|READY|XIAO_HEALTHCHECK_V2\n"]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def write(self, payload):
        command = payload.decode().strip()
        if command == "HEALTH_HELLO":
            self.responses.append(b"PASS|HELLO|hello world\n")
        elif command == "HEALTH_GPIO":
            self.responses.append(b"PASS|GPIO|D0-D1\n")

    def flush(self):
        return None

    def readline(self):
        return self.responses.pop(0) if self.responses else b""


class TestXiaoHealthCheck(unittest.TestCase):
    def test_discovery_filters_non_usb_and_bluetooth_ports(self):
        ports = [
            _Port("/dev/cu.Bluetooth", "Bluetooth-Incoming-Port"),
            _Port("/dev/cu.debug", "Debug console"),
            _Port("/dev/cu.usbmodem42", "XIAO ESP32S3", vid=0x303A, pid=0x1001, serial_number="ABC"),
        ]
        list_ports = types.ModuleType("serial.tools.list_ports")
        list_ports.comports = lambda: ports
        tools_module = types.ModuleType("serial.tools")
        tools_module.list_ports = list_ports
        serial_module = types.ModuleType("serial")
        serial_module.tools = tools_module
        with patch.dict(sys.modules, {"serial": serial_module, "serial.tools": tools_module, "serial.tools.list_ports": list_ports}):
            found = XiaoESP32S3HealthCheck.discover()
        self.assertEqual([item.device for item in found], ["/dev/cu.usbmodem42"])
        self.assertEqual(found[0].serial_number, "ABC")

    def test_line_protocol_command_and_interface_metadata(self):
        serial_module = types.ModuleType("serial")
        serial_module.Serial = _FakeSerial
        checker = XiaoESP32S3HealthCheck(arduino_cli="arduino-cli")
        with patch.dict(sys.modules, {"serial": serial_module}):
            hello = checker.command("/dev/cu.usbmodem42", "HEALTH_HELLO", timeout=0.1)
            gpio = checker.run_interface_test("/dev/cu.usbmodem42", "gpio")
        self.assertTrue(hello["passed"])
        self.assertEqual(hello["detail"], "hello world")
        self.assertTrue(gpio["result"]["passed"])
        self.assertIn("D0", gpio["instruction"])

    def test_flash_reports_missing_cli(self):
        checker = XiaoESP32S3HealthCheck(arduino_cli="")
        result = checker.flash("/dev/cu.usbmodem42")
        self.assertFalse(result["passed"])
        self.assertIn("arduino-cli", result["detail"])

    def test_existing_health_firmware_skips_flash(self):
        checker = XiaoESP32S3HealthCheck(arduino_cli="arduino-cli")
        port = SerialPortInfo("/dev/cu.usbmodem42", "XIAO ESP32S3", "Seeed", "ABC", 0x303A, 0x1001, "USB")
        replies = [
            {"passed": True, "detail": checker.FIRMWARE_ID, "raw": f"PASS|PING|{checker.FIRMWARE_ID}"},
            {"passed": True, "detail": "XIAO ESP32S3|AABBCCDDEEFF|WIFI=1|BLUETOOTH=1", "raw": "PASS|INFO|XIAO ESP32S3|AABBCCDDEEFF|WIFI=1|BLUETOOTH=1"},
            {"passed": True, "detail": "hello world", "raw": "PASS|HELLO|hello world"},
        ]
        progress = []
        with patch.object(checker, "discover", return_value=[port]):
            with patch.object(checker, "command", side_effect=replies):
                with patch.object(checker, "flash") as flash:
                    result = checker.initial_checks(
                        port.device,
                        progress=lambda stage, message: progress.append((stage, message)),
                    )
        flash.assert_not_called()
        self.assertTrue(result["checks"]["flash"]["skipped"])
        self.assertTrue(result["checks"]["identity"]["wifi"])
        self.assertTrue(any(stage == "firmware_probe" for stage, _ in progress))


if __name__ == "__main__":
    unittest.main()
