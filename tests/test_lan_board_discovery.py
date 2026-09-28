import unittest
from unittest.mock import patch

from src.devices.lan_board_discovery import LanBoardDiscovery, normalize_mac


class TestLanBoardDiscovery(unittest.TestCase):
    def test_normalize_and_parse_protocol_responses(self):
        self.assertEqual(normalize_mac("cc:d9:0b:69:70:90"), "CCD90B697090")
        self.assertIsNone(normalize_mac("BOARD-001"))

        text_record = LanBoardDiscovery._parse_response(
            b"EXP_RECORDER_BOARD_V1|CC:D9:0B:69:70:90|Camera board|XIAO ESP32S3",
            "192.168.1.42",
        )
        self.assertIsNotNone(text_record)
        self.assertEqual(text_record.mac, "CCD90B697090")
        self.assertEqual(text_record.ip_address, "192.168.1.42")

        json_record = LanBoardDiscovery._parse_response(
            b'{"protocol":"EXP_RECORDER_BOARD_V1","mac":"AA-BB-CC-DD-EE-FF","control_port":80,"video_port":81}',
            "192.168.1.43",
        )
        self.assertEqual(json_record.mac, "AABBCCDDEEFF")
        self.assertEqual(json_record.control_port, 80)
        self.assertEqual(json_record.video_port, 81)

    def test_neighbor_table_only_matches_registered_boards(self):
        output = """? (192.168.1.8) at cc:d9:b:69:70:90 on en0 ifscope
? (192.168.1.9) at aa:bb:cc:dd:ee:ff on en0 ifscope
? (192.168.1.10) at (incomplete) on en0 ifscope
        """
        with patch.object(LanBoardDiscovery, "_neighbor_output", return_value=output):
            records = LanBoardDiscovery._neighbor_records({"CCD90B697090"})
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].mac, "CCD90B697090")
        self.assertEqual(records[0].source, "neighbor")


if __name__ == "__main__":
    unittest.main()
