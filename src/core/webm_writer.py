"""Real-time VP8 WebM writer for JPEG frames received over USB."""

from __future__ import annotations

import time
from fractions import Fraction
from pathlib import Path
from typing import Any, Optional


class WebmVideoWriter:
    """Decode incoming JPEG frames and encode a browser-native, silent WebM."""

    def __init__(self, path: Path, width: int = 640, height: int = 480, fps: int = 15):
        self.path = Path(path)
        self.width = width
        self.height = height
        self.fps = fps
        self.frame_count = 0
        self._container: Optional[Any] = None
        self._stream: Optional[Any] = None
        self._jpeg_decoder: Optional[Any] = None
        self._start_monotonic: Optional[float] = None
        self._last_pts_ms = -1

    def open(self) -> None:
        try:
            import av
        except ImportError as exc:
            raise RuntimeError("WebM recording requires PyAV; install project requirements") from exc

        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._container = av.open(str(self.path), mode="w", format="webm")
        self._stream = self._container.add_stream("libvpx", rate=self.fps)
        self._stream.width = self.width
        self._stream.height = self.height
        self._stream.pix_fmt = "yuv420p"
        # The camera's USB frame rate is not fixed at the nominal 15 fps.
        # Explicit wall-clock timestamps prevent the WebM from playing too fast.
        self._stream.time_base = Fraction(1, 1000)
        self._stream.options = {"deadline": "realtime", "cpu-used": "8"}
        self._jpeg_decoder = av.CodecContext.create("mjpeg", "r")
        self._start_monotonic = time.monotonic()
        self._last_pts_ms = -1

    def write_frame(self, jpeg: bytes) -> None:
        if self._container is None or self._stream is None or self._jpeg_decoder is None:
            raise RuntimeError("WebM writer is not open")
        if not jpeg.startswith(b"\xff\xd8") or not jpeg.endswith(b"\xff\xd9"):
            raise ValueError("Received frame is not a complete JPEG image")

        import av

        frames = self._jpeg_decoder.decode(av.Packet(jpeg))
        if not frames:
            raise ValueError("JPEG decoder returned no video frame")
        frame = frames[0].reformat(width=self.width, height=self.height, format="yuv420p")
        elapsed_ms = round((time.monotonic() - (self._start_monotonic or time.monotonic())) * 1000)
        frame.pts = max(self._last_pts_ms + 1, elapsed_ms)
        frame.time_base = self._stream.time_base
        self._last_pts_ms = frame.pts
        for packet in self._stream.encode(frame):
            self._container.mux(packet)
        self.frame_count += 1

    def close(self) -> None:
        if self._container is None:
            return
        if self._stream is not None:
            for packet in self._stream.encode(None):
                self._container.mux(packet)
        self._container.close()
        self._container = None
        self._stream = None
        self._jpeg_decoder = None
        self._start_monotonic = None
        self._last_pts_ms = -1

    def __enter__(self) -> "WebmVideoWriter":
        self.open()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
