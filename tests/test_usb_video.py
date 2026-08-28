"""Tests for USB MJPEG framing and local WebM creation."""

import base64
import struct
import tempfile
import unittest
from pathlib import Path

from src.core.webm_writer import WebmVideoWriter
from src.devices.xiao_camera import XiaoCameraDriver


class FakeSerial:
    def __init__(self, data: bytes):
        self.data = bytearray(data)
        self.is_open = True

    def read(self, size: int) -> bytes:
        chunk = self.data[:size]
        del self.data[:size]
        return bytes(chunk)


class TestUsbVideo(unittest.TestCase):
    def test_webm_writer_creates_ebml_video(self):
        jpeg = base64.b64decode(
            "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////"
            "2wBDAf//////////////////////////////////////////////////////////////////////////////////////"
            "wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k="
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "capture.webm"
            with WebmVideoWriter(path, width=1, height=1) as writer:
                writer.write_frame(jpeg)
                writer.write_frame(jpeg)

            content = path.read_bytes()
            self.assertEqual(content[:4], b"\x1aE\xdf\xa3")
            self.assertIn(b"webm", content[:128].lower())
            self.assertGreater(len(content), 100)

    def test_stream_parser_skips_text_and_reads_jpeg_packet(self):
        jpeg = b"\xff\xd8usb-frame\xff\xd9"
        packet = b"STIM_ACK\n" + XiaoCameraDriver.STREAM_MAGIC
        packet += struct.pack("<II", len(jpeg), 7) + jpeg
        driver = XiaoCameraDriver()
        driver._serial = FakeSerial(packet)

        sequence, received = driver._read_stream_packet()

        self.assertEqual(sequence, 7)
        self.assertEqual(received, jpeg)


if __name__ == "__main__":
    unittest.main()
