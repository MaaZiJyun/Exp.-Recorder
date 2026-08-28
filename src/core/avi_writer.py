"""Small dependency-free MJPEG AVI writer used by the USB camera stream."""

from __future__ import annotations

from pathlib import Path
import struct
import time
from typing import BinaryIO, Optional


class MjpegAviWriter:
    """Write JPEG frames into a seekable AVI file without buffering the video."""

    HEADER_SIZE = 224

    def __init__(self, path: Path, width: int = 320, height: int = 240):
        self.path = Path(path)
        self.width = width
        self.height = height
        self.frame_count = 0
        self.max_frame_size = 0
        self.jpeg_bytes = 0
        self.started_at: Optional[float] = None
        self._file: Optional[BinaryIO] = None

    @staticmethod
    def _u32(value: int) -> bytes:
        return struct.pack("<I", value & 0xFFFFFFFF)

    @staticmethod
    def _u16(value: int) -> bytes:
        return struct.pack("<H", value & 0xFFFF)

    def open(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file = self.path.open("wb")
        self._file.write(self._build_header())
        self.started_at = time.monotonic()

    def _build_header(self) -> bytes:
        u32 = self._u32
        u16 = self._u16
        header = bytearray()
        header += b"RIFF" + u32(0) + b"AVI "
        header += b"LIST" + u32(192) + b"hdrl"
        header += b"avih" + u32(56)
        header += u32(0) * 5  # timing, rate, padding, flags, total frames
        header += u32(0) + u32(1) + u32(0)  # initial frames, streams, buffer
        header += u32(self.width) + u32(self.height) + u32(0) * 4
        header += b"LIST" + u32(116) + b"strl"
        header += b"strh" + u32(56) + b"vids" + b"MJPG"
        header += u32(0) * 3  # flags, priority/language, initial frames
        header += u32(1000) + u32(0)  # scale and rate
        header += u32(0) + u32(0) + u32(0)  # start, length, buffer
        header += u32(0xFFFFFFFF) + u32(0)  # quality, sample size
        header += u16(0) + u16(0) + u16(self.width) + u16(self.height)
        header += b"strf" + u32(40) + u32(40)
        header += u32(self.width) + u32(self.height)
        header += u16(1) + u16(24) + b"MJPG"
        header += u32(self.width * self.height * 3) + u32(0) * 4
        header += b"LIST" + u32(0) + b"movi"
        if len(header) != self.HEADER_SIZE:
            raise RuntimeError(f"Invalid AVI header size: {len(header)}")
        return bytes(header)

    def write_frame(self, jpeg: bytes) -> None:
        if self._file is None:
            raise RuntimeError("AVI writer is not open")
        if not jpeg.startswith(b"\xff\xd8") or not jpeg.endswith(b"\xff\xd9"):
            raise ValueError("Received frame is not a complete JPEG image")
        self._file.write(b"00dc")
        self._file.write(self._u32(len(jpeg)))
        self._file.write(jpeg)
        if len(jpeg) % 2:
            self._file.write(b"\x00")
        self.frame_count += 1
        self.jpeg_bytes += len(jpeg)
        self.max_frame_size = max(self.max_frame_size, len(jpeg))

    def close(self) -> None:
        if self._file is None:
            return
        duration = max(0.001, time.monotonic() - (self.started_at or time.monotonic()))
        fps = self.frame_count / duration if self.frame_count else 15.0
        final_size = self._file.tell()
        patches = {
            4: final_size - 8,
            32: round(1_000_000 / fps),
            36: round(self.jpeg_bytes / duration),
            48: self.frame_count,
            60: self.max_frame_size,
            132: round(fps * 1000),
            140: self.frame_count,
            144: self.max_frame_size,
            216: final_size - 220,
        }
        for position, value in patches.items():
            self._file.seek(position)
            self._file.write(self._u32(value))
        self._file.flush()
        self._file.close()
        self._file = None

    def __enter__(self) -> "MjpegAviWriter":
        self.open()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
