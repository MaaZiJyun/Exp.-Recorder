"""Connection discovery and retry regression tests for physical devices."""

import sys
import types
import unittest
from unittest.mock import patch

from src.devices.sdg1022x import SDG1022XDriver
from src.devices.xiao_camera import XiaoCameraDriver


class _VisaInstrument:
    def __init__(self, identity):
        self.identity = identity
        self.closed = False
        self.timeout = None
        self.write_termination = None

    def query(self, _command):
        if isinstance(self.identity, Exception):
            raise self.identity
        return self.identity

    def close(self):
        self.closed = True


class _VisaManager:
    def __init__(self):
        self.instruments = {
            "TCPIP0::OTHER::INSTR": _VisaInstrument("OTHER,SCOPE,1,1"),
            "USB0::0xF4EC::0x1103::SDG::INSTR": _VisaInstrument(
                "Siglent Technologies,SDG1022X,SERIAL,1.0"
            ),
        }
        self.closed = False

    def list_resources(self):
        return ("ASRL1::INSTR", *self.instruments)

    def open_resource(self, name):
        return self.instruments[name]

    def close(self):
        self.closed = True


class _SerialPort:
    def __init__(self, device, description="", manufacturer="", hwid=""):
        self.device = device
        self.description = description
        self.manufacturer = manufacturer
        self.product = ""
        self.hwid = hwid


class TestDeviceConnection(unittest.TestCase):
    def test_sdg_prefers_siglent_and_verifies_identity(self):
        manager = _VisaManager()
        pyvisa = types.ModuleType("pyvisa")
        pyvisa.ResourceManager = lambda _backend: manager

        with patch.dict(sys.modules, {"pyvisa": pyvisa}):
            driver = SDG1022XDriver()
            self.assertTrue(driver.connect())

        self.assertEqual(
            driver.resource_name, "USB0::0xF4EC::0x1103::SDG::INSTR"
        )
        self.assertFalse(manager.instruments[driver.resource_name].closed)

    def test_xiao_port_candidates_use_metadata_and_skip_bluetooth(self):
        bluetooth = _SerialPort("/dev/cu.Bluetooth-Incoming-Port", "Bluetooth")
        generic = _SerialPort("/dev/cu.usbserial-1", "USB serial")
        xiao = _SerialPort("/dev/cu.usbmodem42", "XIAO ESP32S3", "Seeed Studio")
        list_ports = types.ModuleType("serial.tools.list_ports")
        list_ports.comports = lambda: [bluetooth, generic, xiao]
        tools_module = types.ModuleType("serial.tools")
        tools_module.list_ports = list_ports
        serial_module = types.ModuleType("serial")
        serial_module.tools = tools_module

        with patch.dict(
            sys.modules,
            {
                "serial": serial_module,
                "serial.tools": tools_module,
                "serial.tools.list_ports": list_ports,
            },
        ):
            self.assertEqual(
                XiaoCameraDriver._candidate_ports(),
                ["/dev/cu.usbmodem42", "/dev/cu.usbserial-1"],
            )

    def test_auto_selected_xiao_port_is_rediscovered_on_reconnect(self):
        driver = XiaoCameraDriver()
        driver.port = "/dev/cu.usbmodem-old"
        serial_module = types.ModuleType("serial")
        opened = []

        class FakeSerial:
            is_open = True

            def __init__(self, *, port, **_kwargs):
                opened.append(port)

            def close(self):
                self.is_open = False

        serial_module.Serial = FakeSerial
        with (
            patch.dict(sys.modules, {"serial": serial_module}),
            patch.object(driver, "_candidate_ports", return_value=["/dev/cu.usbmodem-new"]),
            patch.object(driver, "ping", return_value=True),
        ):
            self.assertTrue(driver.connect())

        self.assertEqual(opened, ["/dev/cu.usbmodem-new"])
        self.assertEqual(driver.port, "/dev/cu.usbmodem-new")


if __name__ == "__main__":
    unittest.main()
