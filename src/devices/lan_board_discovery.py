"""Discover inventory boards that are currently visible on the local network."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import re
import socket
import subprocess
import time
from typing import Any, Iterable, Optional


MAC_PATTERN = re.compile(r"(?i)(?:[0-9a-f]{1,2}[:-]){5}[0-9a-f]{1,2}")


def normalize_mac(value: str) -> Optional[str]:
    groups = re.split(r"[:-]", value.strip())
    if len(groups) == 6 and all(1 <= len(group) <= 2 and re.fullmatch(r"[0-9A-Fa-f]+", group) for group in groups):
        compact = "".join(group.zfill(2) for group in groups)
    else:
        compact = re.sub(r"[^0-9A-Fa-f]", "", value)
    if len(compact) != 12:
        return None
    return compact.upper()


@dataclass(frozen=True)
class DiscoveredBoard:
    mac: str
    ip_address: str
    source: str
    model: Optional[str] = None
    control_port: Optional[int] = None
    video_port: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LanBoardDiscovery:
    """Discover boards that respond to the current UDP handshake."""

    PORT = 37020
    REQUEST = b"EXP_RECORDER_DISCOVER_V1"
    RESPONSE_PREFIX = "EXP_RECORDER_BOARD_V1"

    @staticmethod
    def _parse_response(payload: bytes, ip_address: str) -> Optional[DiscoveredBoard]:
        try:
            text = payload[:2048].decode("utf-8").strip()
        except UnicodeDecodeError:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict) and data.get("protocol") == LanBoardDiscovery.RESPONSE_PREFIX:
            mac = normalize_mac(str(data.get("mac", "")))
            if mac:
                control_port = data.get("control_port")
                video_port = data.get("video_port")
                return DiscoveredBoard(
                    mac=mac,
                    ip_address=ip_address,
                    source="udp",
                    model=str(data["model"])[:200] if data.get("model") else None,
                    control_port=control_port if isinstance(control_port, int) and 0 < control_port < 65536 else None,
                    video_port=video_port if isinstance(video_port, int) and 0 < video_port < 65536 else None,
                )
        parts = text.split("|")
        if len(parts) >= 2 and parts[0] == LanBoardDiscovery.RESPONSE_PREFIX:
            mac = normalize_mac(parts[1])
            if mac:
                return DiscoveredBoard(
                    mac=mac,
                    ip_address=ip_address,
                    source="udp",
                    model=parts[3][:200] if len(parts) > 3 and parts[3] else (
                        parts[2][:200] if len(parts) > 2 and parts[2] else None
                    ),
                )
        return None

    def _udp_discover(self, timeout: float) -> list[DiscoveredBoard]:
        found: dict[str, DiscoveredBoard] = {}
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
                connection.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                connection.settimeout(min(0.25, timeout))
                connection.bind(("", 0))
                connection.sendto(self.REQUEST, ("255.255.255.255", self.PORT))
                deadline = time.monotonic() + timeout
                while time.monotonic() < deadline:
                    try:
                        payload, address = connection.recvfrom(2048)
                    except socket.timeout:
                        continue
                    record = self._parse_response(payload, address[0])
                    if record:
                        found[record.mac] = record
        except OSError:
            return []
        return list(found.values())

    @staticmethod
    def _neighbor_output() -> str:
        for command in (["ip", "neigh", "show"], ["arp", "-an"]):
            try:
                result = subprocess.run(
                    command,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=2,
                )
            except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
                continue
            if result.stdout:
                return result.stdout
        return ""

    @classmethod
    def _neighbor_records(cls, registered_macs: set[str]) -> list[DiscoveredBoard]:
        found: dict[str, DiscoveredBoard] = {}
        for line in cls._neighbor_output().splitlines():
            match = MAC_PATTERN.search(line)
            if not match:
                continue
            mac = normalize_mac(match.group(0))
            if not mac or mac not in registered_macs or "incomplete" in line.lower():
                continue
            ip_match = re.search(r"(?:^|\(|\s)(\d{1,3}(?:\.\d{1,3}){3})(?:\)|\s)", line)
            if ip_match:
                found[mac] = DiscoveredBoard(mac=mac, ip_address=ip_match.group(1), source="neighbor")
        return list(found.values())

    def discover(self, registered_macs: Iterable[str], timeout: float = 1.2) -> list[DiscoveredBoard]:
        # ARP/neighbor entries can remain cached after a board is disconnected,
        # so only a response to this scan counts as currently online.
        del registered_macs
        return self._udp_discover(timeout)
