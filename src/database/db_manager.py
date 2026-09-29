"""Database Manager for SQLite."""

import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
from src.config import DB_PATH


class DatabaseManager:
    NETWORK_MAC_MIGRATION_KEY = "boards_mac_network_order_v1"

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = Path(db_path) if db_path else DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
        schema_file = Path(__file__).parent / "schema.sql"
        if not schema_file.exists():
            return
        with open(schema_file, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        with self.get_connection() as conn:
            conn.executescript(schema_sql)
            existing_board_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(boards)").fetchall()
            }
            if "serial_number" in existing_board_columns and "mac" not in existing_board_columns:
                conn.execute("ALTER TABLE boards RENAME COLUMN serial_number TO mac")
                existing_board_columns.remove("serial_number")
                existing_board_columns.add("mac")
            for obsolete_column in (
                "health_product", "health_mac", "wifi", "bluetooth", "usb",
                "name", "gpio_count", "working_voltage",
            ):
                if obsolete_column in existing_board_columns:
                    conn.execute(f"ALTER TABLE boards DROP COLUMN {obsolete_column}")
                    existing_board_columns.remove(obsolete_column)
            board_health_migrations = {
                "health_usb_detected": "INTEGER",
                "health_wifi": "INTEGER",
                "health_bluetooth": "INTEGER",
                "health_hello": "INTEGER",
                "health_gpio": "INTEGER",
                "health_pwm": "INTEGER",
                "health_uart": "INTEGER",
                "health_spi": "INTEGER",
                "health_checked_at": "TIMESTAMP",
            }
            for column, definition in board_health_migrations.items():
                if column not in existing_board_columns:
                    conn.execute(f"ALTER TABLE boards ADD COLUMN {column} {definition}")
            self._migrate_board_macs_to_network_order(conn)
            existing_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(trials)").fetchall()
            }
            migrations = {
                "experiment_id": "INTEGER REFERENCES experiment(experiment_id)",
                "plan_id": "INTEGER REFERENCES experiment_plans(plan_id)",
                "stimulation_position_id": "INTEGER REFERENCES stimulation_positions(position_id)",
                "stimulation_position_2_id": "INTEGER REFERENCES stimulation_positions(position_id)",
                "stimulation_waveform": "TEXT NOT NULL DEFAULT 'SQUARE'",
                "stimulation_high_level_v": "REAL",
                "stimulation_low_level_v": "REAL",
                "stimulation_duty_cycle_pct": "REAL",
            }
            for column, definition in migrations.items():
                if column not in existing_columns:
                    conn.execute(f"ALTER TABLE trials ADD COLUMN {column} {definition}")
            existing_plan_columns = {row["name"] for row in conn.execute("PRAGMA table_info(experiment_plans)").fetchall()}
            plan_migrations = {
                "stimulation_position_id": "INTEGER",
                "stimulation_position_2_id": "INTEGER", "stimulation_position": "TEXT",
                "stimulation_voltage_v": "REAL", "stimulation_waveform": "TEXT DEFAULT 'SQUARE'",
                "stimulation_high_level_v": "REAL", "stimulation_low_level_v": "REAL",
                "stimulation_duty_cycle_pct": "REAL DEFAULT 50", "stimulation_frequency_hz": "REAL",
                "stimulation_duration_s": "REAL DEFAULT 0.5", "stimulation_count": "INTEGER DEFAULT 1",
                "stimulation_interval_s": "REAL DEFAULT 0",
                "trial_count": "INTEGER NOT NULL DEFAULT 1",
            }
            for column, definition in plan_migrations.items():
                if column not in existing_plan_columns:
                    conn.execute(f"ALTER TABLE experiment_plans ADD COLUMN {column} {definition}")
            if "red_position_id" in existing_plan_columns:
                conn.execute("""UPDATE experiment_plans SET
                    stimulation_position_id=COALESCE(stimulation_position_id, red_position_id),
                    stimulation_position_2_id=COALESCE(stimulation_position_2_id, black_position_id),
                    stimulation_position=COALESCE(stimulation_position, position_combination),
                    stimulation_high_level_v=COALESCE(stimulation_high_level_v, high_level_v),
                    stimulation_low_level_v=COALESCE(stimulation_low_level_v, low_level_v),
                    stimulation_voltage_v=COALESCE(stimulation_voltage_v, high_level_v-low_level_v),
                    stimulation_frequency_hz=COALESCE(stimulation_frequency_hz, frequency_hz)
                """)
            # Symmetric 50% bipolar stimulation has no first/second position;
            # normalize both historical and future-facing records by position code.
            for table in ("experiment_plans", "trials"):
                conn.execute(f"""UPDATE {table}
                    SET stimulation_position_id = stimulation_position_2_id,
                        stimulation_position_2_id = stimulation_position_id,
                        stimulation_position =
                            (SELECT code FROM stimulation_positions WHERE position_id = {table}.stimulation_position_2_id) ||
                            (SELECT code FROM stimulation_positions WHERE position_id = {table}.stimulation_position_id)
                    WHERE ABS(ABS(stimulation_high_level_v) - ABS(stimulation_low_level_v)) < 0.000000001
                      AND ABS(stimulation_duty_cycle_pct - 50.0) < 0.000000001
                      AND (SELECT code FROM stimulation_positions WHERE position_id = {table}.stimulation_position_id) COLLATE NOCASE >
                          (SELECT code FROM stimulation_positions WHERE position_id = {table}.stimulation_position_2_id) COLLATE NOCASE
                """)
            for plan in conn.execute("SELECT * FROM experiment_plans ORDER BY plan_id").fetchall():
                self._match_existing_plan_trials(conn, plan["plan_id"], dict(plan))
            existing_subject_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(subjects)").fetchall()
            }
            subject_migrations = {
                "body_width_cm": "REAL",
                "mandibular_length_cm": "REAL",
                "gender": "TEXT",
                "species": "TEXT",
                "time_since_last_feeding_h": "REAL",
                "time_since_last_experiment_h": "REAL",
                "recent_fighting": "TEXT",
                "time_since_last_feeding_h": "TEXT",
            }
            for column, definition in subject_migrations.items():
                if column not in existing_subject_columns:
                    conn.execute(f"ALTER TABLE subjects ADD COLUMN {column} {definition}")
            existing_position_columns = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(stimulation_positions)").fetchall()
            }
            position_migrations = {
                "image_id": "INTEGER REFERENCES stimulation_position_images(image_id)",
                "mark": "TEXT",
                "species": "TEXT",
            }
            existing_species_columns = {row["name"] for row in conn.execute("PRAGMA table_info(species)").fetchall()}
            for column, definition in {"feeding_cycle_h": "REAL", "rest_cycle_h": "REAL"}.items():
                if column not in existing_species_columns:
                    conn.execute(f"ALTER TABLE species ADD COLUMN {column} {definition}")
            for column, definition in position_migrations.items():
                if column not in existing_position_columns:
                    conn.execute(
                        f"ALTER TABLE stimulation_positions ADD COLUMN {column} {definition}"
                    )
            if "image" in existing_position_columns:
                legacy_images = conn.execute(
                    """SELECT position_id, image FROM stimulation_positions
                    WHERE image IS NOT NULL AND image != '' AND image_id IS NULL"""
                ).fetchall()
                for row in legacy_images:
                    image_id = self._resolve_position_image(conn, row["image"])
                    conn.execute(
                        "UPDATE stimulation_positions SET image_id = ?, image = NULL WHERE position_id = ?",
                        (image_id, row["position_id"]),
                    )
            existing_software_columns = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(software)").fetchall()
            }
            if "supported_device" not in existing_software_columns:
                conn.execute(
                    """ALTER TABLE software ADD COLUMN supported_device TEXT
                       NOT NULL DEFAULT 'XIAO ESP32S3'"""
                )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_experiment ON trials(experiment_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_position ON trials(stimulation_position_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_position_2 ON trials(stimulation_position_2_id)"
            )
            conn.execute("""INSERT OR IGNORE INTO responses
                (trial_id, video_id, latency_s, action)
                SELECT trial_id, video_id, response_latency_s, response_action
                FROM trials
                WHERE response_latency_s IS NOT NULL OR response_action IS NOT NULL
            """)
            self._seed_builtin_software(conn)
            conn.commit()

    @staticmethod
    def _seed_builtin_software(conn: sqlite3.Connection) -> None:
        software_root = Path(__file__).resolve().parents[2] / "data" / "software"
        builtins = (
            (
                "XIAO ESP32S3 Inventory Health Check",
                "4.0.0",
                "Inventory diagnostic firmware for USB identity, wireless capability, Hello World, GPIO, PWM, UART, SPI, and I2C checks.",
                software_root / "xiao_esp32s3_healthcheck",
                "XIAO ESP32S3",
            ),
            (
                "XIAO ESP32S3 Recorder",
                "1.0.0",
                "USB MJPEG camera recorder firmware for the experiment-rig XIAO ESP32S3 Sense.",
                software_root / "xiao_esp32s3_recorder",
                "XIAO ESP32S3 Sense",
            ),
        )
        for name, version, description, source_path, supported_device in builtins:
            if not source_path.is_dir():
                continue
            conn.execute(
                """INSERT INTO software
                       (name, version, description, source_code_addr, supported_device)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(name, version) DO UPDATE SET
                       description=excluded.description,
                       source_code_addr=excluded.source_code_addr,
                       supported_device=excluded.supported_device,
                       updated_at=CURRENT_TIMESTAMP
                   WHERE software.description IS NOT excluded.description
                      OR software.source_code_addr IS NOT excluded.source_code_addr
                      OR software.supported_device IS NOT excluded.supported_device""",
                (name, version, description, str(source_path), supported_device),
            )

    @classmethod
    def _migrate_board_macs_to_network_order(cls, conn: sqlite3.Connection) -> None:
        """Convert MACs emitted by health-check firmware V3 to network byte order once."""
        migrated = conn.execute(
            "SELECT 1 FROM app_metadata WHERE key=?",
            (cls.NETWORK_MAC_MIGRATION_KEY,),
        ).fetchone()
        if migrated:
            return

        updates: list[tuple[int, str]] = []
        for row in conn.execute("SELECT board_id, mac FROM boards").fetchall():
            compact = re.sub(r"[^0-9A-Fa-f]", "", row["mac"])
            if len(compact) != 12:
                continue
            octets = [compact[index:index + 2] for index in range(0, 12, 2)]
            updates.append((int(row["board_id"]), "".join(reversed(octets)).upper()))

        # Use temporary values so a valid reversal cannot trip the UNIQUE MAC
        # constraint while another row still contains the destination value.
        for board_id, _ in updates:
            conn.execute(
                "UPDATE boards SET mac=? WHERE board_id=?",
                (f"__MAC_NETWORK_ORDER_{board_id}__", board_id),
            )
        for board_id, network_mac in updates:
            conn.execute(
                """UPDATE boards SET mac=?, updated_at=CURRENT_TIMESTAMP
                WHERE board_id=?""",
                (network_mac, board_id),
            )

        conn.execute(
            "INSERT INTO app_metadata (key, value) VALUES (?, 'complete')",
            (cls.NETWORK_MAC_MIGRATION_KEY,),
        )

    @staticmethod
    def _resolve_position_image(conn: sqlite3.Connection, image: Optional[str]) -> Optional[int]:
        if not image:
            return None
        image_hash = hashlib.sha256(image.encode("utf-8")).hexdigest()
        conn.execute(
            "INSERT OR IGNORE INTO stimulation_position_images (image_hash, image) VALUES (?, ?)",
            (image_hash, image),
        )
        row = conn.execute(
            "SELECT image_id FROM stimulation_position_images WHERE image_hash = ?",
            (image_hash,),
        ).fetchone()
        return int(row["image_id"])

    @staticmethod
    def _mark_json(mark: Optional[Dict[str, float]]) -> Optional[str]:
        return json.dumps(mark, separators=(",", ":")) if mark else None

    @staticmethod
    def _position_dict(row: sqlite3.Row) -> Dict[str, Any]:
        record = dict(row)
        record["mark"] = json.loads(record["mark"]) if record.get("mark") else None
        return record

    @staticmethod
    def _board_dict(row: sqlite3.Row) -> Dict[str, Any]:
        record = dict(row)
        for field in (
            "health_usb_detected", "health_wifi", "health_bluetooth",
            "health_hello", "health_gpio", "health_pwm", "health_uart", "health_spi",
        ):
            if record.get(field) is not None:
                record[field] = bool(record[field])
        return record

    @staticmethod
    def _remove_unused_position_image(conn: sqlite3.Connection, image_id: Optional[int]) -> None:
        if image_id is not None:
            conn.execute(
                """DELETE FROM stimulation_position_images
                WHERE image_id = ? AND NOT EXISTS (
                    SELECT 1 FROM stimulation_positions WHERE image_id = ?
                )""",
                (image_id, image_id),
            )

    def create_stimulation_position(
        self,
        code: str,
        description: Optional[str] = None,
        image: Optional[str] = None,
        mark: Optional[Dict[str, float]] = None,
        species: Optional[str] = None,
    ) -> int:
        with self.get_connection() as conn:
            image_id = self._resolve_position_image(conn, image)
            cursor = conn.execute(
                """INSERT INTO stimulation_positions
                (code, description, image_id, mark, species) VALUES (?, ?, ?, ?, ?)""",
                (code, description, image_id, self._mark_json(mark), species),
            )
            conn.commit()
            return cursor.lastrowid

    def get_stimulation_position(self, position_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute(
                """SELECT p.position_id, p.code, p.description, p.image_id,
                    p.mark, p.species, p.created_at, i.image, (
                    SELECT COUNT(*) FROM trials t
                    WHERE t.stimulation_position_id = p.position_id
                       OR t.stimulation_position_2_id = p.position_id
                ) AS trial_count
                FROM stimulation_positions p
                LEFT JOIN stimulation_position_images i ON i.image_id = p.image_id
                WHERE p.position_id = ?
                """,
                (position_id,),
            ).fetchone()
            return self._position_dict(row) if row else None

    def list_stimulation_positions(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute(
                """SELECT p.position_id, p.code, p.description, p.image_id,
                    p.mark, p.species, p.created_at, i.image, (
                    SELECT COUNT(*) FROM trials t
                    WHERE t.stimulation_position_id = p.position_id
                       OR t.stimulation_position_2_id = p.position_id
                ) AS trial_count
                FROM stimulation_positions p
                LEFT JOIN stimulation_position_images i ON i.image_id = p.image_id
                ORDER BY p.code COLLATE NOCASE, p.position_id"""
            ).fetchall()
            return [self._position_dict(row) for row in rows]

    def list_subject_position_combination_statistics(
        self, experiment_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Count trials for every Subject/position-combination pair."""
        with self.get_connection() as conn:
            rows = conn.execute(
                """WITH normalized_trials AS (
                    SELECT t.*,
                        CASE
                            WHEN ABS(ABS(t.stimulation_high_level_v) - ABS(t.stimulation_low_level_v)) < 0.000000001
                             AND ABS(t.stimulation_duty_cycle_pct - 50.0) < 0.000000001
                             AND p1.code IS NOT NULL AND p2.code IS NOT NULL
                             AND t.stimulation_position IN (p1.code || p2.code, p2.code || p1.code)
                            THEN CASE
                                WHEN p1.code COLLATE NOCASE <= p2.code COLLATE NOCASE
                                THEN p1.code || p2.code ELSE p2.code || p1.code
                            END
                            ELSE t.stimulation_position
                        END AS normalized_position
                    FROM trials t
                    LEFT JOIN stimulation_positions p1 ON p1.position_id = t.stimulation_position_id
                    LEFT JOIN stimulation_positions p2 ON p2.position_id = t.stimulation_position_2_id
                    WHERE (? IS NULL OR t.experiment_id = ?)
                ), combinations AS (
                    SELECT DISTINCT normalized_position AS position_combination
                    FROM normalized_trials
                    WHERE normalized_position IS NOT NULL
                      AND TRIM(normalized_position) != ''
                )
                SELECT s.subject_id, c.position_combination,
                    COUNT(DISTINCT t.trial_id) AS trial_count
                FROM subjects s
                CROSS JOIN combinations c
                LEFT JOIN normalized_trials t
                  ON t.subject_id = s.subject_id
                 AND t.normalized_position = c.position_combination
                GROUP BY s.subject_id, c.position_combination
                ORDER BY s.subject_id COLLATE NOCASE,
                         c.position_combination COLLATE NOCASE""",
                (experiment_id, experiment_id),
            ).fetchall()
            return [dict(row) for row in rows]

    def update_stimulation_position(
        self,
        position_id: int,
        code: str,
        description: Optional[str] = None,
        image: Optional[str] = None,
        mark: Optional[Dict[str, float]] = None,
        species: Optional[str] = None,
    ) -> bool:
        with self.get_connection() as conn:
            existing = conn.execute(
                "SELECT image_id FROM stimulation_positions WHERE position_id = ?",
                (position_id,),
            ).fetchone()
            if not existing:
                return False
            old_image_id = existing["image_id"]
            image_id = self._resolve_position_image(conn, image)
            cursor = conn.execute(
                """UPDATE stimulation_positions
                SET code = ?, description = ?, image_id = ?, mark = ?, species = ?, image = NULL
                WHERE position_id = ?""",
                (code, description, image_id, self._mark_json(mark), species, position_id),
            )
            if old_image_id != image_id:
                self._remove_unused_position_image(conn, old_image_id)
            conn.commit()
            return cursor.rowcount > 0

    def delete_stimulation_position(self, position_id: int) -> bool:
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT image_id FROM stimulation_positions WHERE position_id = ?",
                (position_id,),
            ).fetchone()
            cursor = conn.execute(
                "DELETE FROM stimulation_positions WHERE position_id = ?",
                (position_id,),
            )
            if row:
                self._remove_unused_position_image(conn, row["image_id"])
            conn.commit()
            return cursor.rowcount > 0

    def insert_experiment(self, title: str, description: Optional[str] = None) -> int:
        query = "INSERT INTO experiment (title, description) VALUES (?, ?)"
        with self.get_connection() as conn:
            cursor = conn.execute(query, (title, description))
            conn.commit()
            return cursor.lastrowid

    def get_experiment(self, experiment_id: int) -> Optional[Dict[str, Any]]:
        query = """
        SELECT e.*, COUNT(t.trial_id) AS trial_count
        FROM experiment e
        LEFT JOIN trials t ON t.experiment_id = e.experiment_id
        WHERE e.experiment_id = ?
        GROUP BY e.experiment_id
        """
        with self.get_connection() as conn:
            row = conn.execute(query, (experiment_id,)).fetchone()
            return dict(row) if row else None

    def list_experiments(self) -> List[Dict[str, Any]]:
        query = """
        SELECT e.*, COUNT(t.trial_id) AS trial_count
        FROM experiment e
        LEFT JOIN trials t ON t.experiment_id = e.experiment_id
        GROUP BY e.experiment_id
        ORDER BY e.experiment_id DESC
        """
        with self.get_connection() as conn:
            return [dict(row) for row in conn.execute(query).fetchall()]

    def update_experiment(
        self,
        experiment_id: int,
        title: str,
        description: Optional[str] = None,
    ) -> bool:
        query = "UPDATE experiment SET title = ?, description = ? WHERE experiment_id = ?"
        with self.get_connection() as conn:
            cursor = conn.execute(query, (title, description, experiment_id))
            conn.commit()
            return cursor.rowcount > 0

    def delete_experiment(self, experiment_id: int) -> bool:
        """Delete an empty experiment; linked trials are protected by the foreign key."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM experiment WHERE experiment_id = ?",
                (experiment_id,),
            )
            conn.commit()
            return cursor.rowcount > 0

    def list_experiment_plans(self, experiment_id: int) -> List[Dict[str, Any]]:
        query = """
        SELECT p.plan_id, p.experiment_id, p.subject_id,
               p.stimulation_position_id, p.stimulation_position_2_id,
               p.stimulation_position, p.stimulation_voltage_v, p.stimulation_waveform,
               p.stimulation_high_level_v, p.stimulation_low_level_v,
               p.stimulation_duty_cycle_pct, p.stimulation_frequency_hz,
               p.stimulation_duration_s, p.stimulation_count, p.stimulation_interval_s, p.trial_count,
               p.created_at, r.code AS red_position_code, b.code AS black_position_code,
               (SELECT COUNT(*) FROM trials t WHERE t.plan_id=p.plan_id AND t.status='COMPLETED') AS completed_trial_count
        FROM experiment_plans p
        JOIN stimulation_positions r ON r.position_id = p.stimulation_position_id
        JOIN stimulation_positions b ON b.position_id = p.stimulation_position_2_id
        WHERE p.experiment_id = ?
        ORDER BY p.plan_id
        """
        with self.get_connection() as conn:
            return [dict(row) for row in conn.execute(query, (experiment_id,)).fetchall()]

    @staticmethod
    def _is_symmetric_plan(data: Dict[str, Any]) -> bool:
        try:
            return (
                abs(abs(float(data["stimulation_high_level_v"])) - abs(float(data["stimulation_low_level_v"]))) < 1e-9
                and abs(float(data["stimulation_duty_cycle_pct"]) - 50.0) < 1e-9
            )
        except (KeyError, TypeError, ValueError):
            return False

    def _canonicalize_plan_positions(
        self, conn: sqlite3.Connection, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        if not self._is_symmetric_plan(data):
            return data
        positions = conn.execute(
            "SELECT position_id, code FROM stimulation_positions WHERE position_id IN (?, ?)",
            (data["stimulation_position_id"], data["stimulation_position_2_id"]),
        ).fetchall()
        by_id = {row["position_id"]: row["code"] for row in positions}
        first_id = data["stimulation_position_id"]
        second_id = data["stimulation_position_2_id"]
        first_code = by_id.get(first_id)
        second_code = by_id.get(second_id)
        if first_code is None or second_code is None:
            return data
        ordered = sorted(((first_code, first_id), (second_code, second_id)), key=lambda item: (item[0].casefold(), item[1]))
        return {
            **data,
            "stimulation_position_id": ordered[0][1],
            "stimulation_position_2_id": ordered[1][1],
            "stimulation_position": f"{ordered[0][0]}{ordered[1][0]}",
        }

    def _match_existing_plan_trials(
        self,
        conn: sqlite3.Connection,
        plan_id: int,
        data: Dict[str, Any],
    ) -> None:
        completed = conn.execute(
            "SELECT COUNT(*) FROM trials WHERE plan_id=? AND status='COMPLETED'",
            (plan_id,),
        ).fetchone()[0]
        remaining = max(0, int(data["trial_count"]) - completed)
        if remaining == 0:
            return
        matches = conn.execute("""SELECT trial_id FROM trials WHERE plan_id IS NULL AND status='COMPLETED'
            AND experiment_id=? AND subject_id=?
            AND ((stimulation_position_id=? AND stimulation_position_2_id=?)
              OR (?=1 AND stimulation_position_id=? AND stimulation_position_2_id=?))
            AND stimulation_waveform=? AND stimulation_high_level_v=? AND stimulation_low_level_v=?
            AND stimulation_duty_cycle_pct=? AND stimulation_frequency_hz=? AND stimulation_duration_s=?
            AND stimulation_count=? AND stimulation_interval_s=? ORDER BY trial_id LIMIT ?""",
            (
                data["experiment_id"], data["subject_id"],
                data["stimulation_position_id"], data["stimulation_position_2_id"],
                int(self._is_symmetric_plan(data)),
                data["stimulation_position_2_id"], data["stimulation_position_id"],
                data["stimulation_waveform"], data["stimulation_high_level_v"],
                data["stimulation_low_level_v"], data["stimulation_duty_cycle_pct"],
                data["stimulation_frequency_hz"], data["stimulation_duration_s"],
                data["stimulation_count"], data["stimulation_interval_s"], remaining,
            ),
        ).fetchall()
        for match in matches:
            conn.execute("UPDATE trials SET plan_id=? WHERE trial_id=?", (plan_id, match["trial_id"]))

    def create_experiment_plan(self, data: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            data = self._canonicalize_plan_positions(conn, data)
            keys = list(data.keys())
            legacy = {row["name"] for row in conn.execute("PRAGMA table_info(experiment_plans)")}
            if "red_position_id" in legacy:
                data = {**data, "red_position_id": data["stimulation_position_id"], "black_position_id": data["stimulation_position_2_id"], "position_combination": data["stimulation_position"], "high_level_v": data["stimulation_high_level_v"], "low_level_v": data["stimulation_low_level_v"], "frequency_hz": data["stimulation_frequency_hz"], "completed_trial_count": 0}
                keys = list(data.keys())
            cursor = conn.execute(
                f"INSERT INTO experiment_plans ({', '.join(keys)}) VALUES ({', '.join('?' for _ in keys)})",
                tuple(data[key] for key in keys),
            )
            plan_id = cursor.lastrowid
            self._match_existing_plan_trials(conn, plan_id, data)
            conn.commit()
            return plan_id

    def delete_experiment_plan(self, plan_id: int) -> bool:
        with self.get_connection() as conn:
            conn.execute("UPDATE trials SET plan_id = NULL WHERE plan_id = ?", (plan_id,))
            cursor = conn.execute("DELETE FROM experiment_plans WHERE plan_id = ?", (plan_id,))
            conn.commit()
            return cursor.rowcount > 0

    def update_experiment_plan(self, plan_id: int, data: Dict[str, Any]) -> bool:
        with self.get_connection() as conn:
            data = self._canonicalize_plan_positions(conn, data)
            conn.execute("UPDATE trials SET plan_id=NULL WHERE plan_id=?", (plan_id,))
            keys = [key for key in data if key != "experiment_id"]
            cursor = conn.execute(
                f"UPDATE experiment_plans SET {', '.join(f'{key}=?' for key in keys)} WHERE plan_id=? AND experiment_id=?",
                tuple(data[key] for key in keys) + (plan_id, data["experiment_id"]),
            )
            if cursor.rowcount == 0:
                conn.commit()
                return False
            self._match_existing_plan_trials(conn, plan_id, data)
            conn.commit()
            return cursor.rowcount > 0

    def complete_experiment_plan_trial(self, plan_id: int) -> None:
        return None

    def uncomplete_experiment_plan_trial(self, plan_id: int) -> None:
        return None

    def upsert_subject(
        self,
        subject_id: str,
        body_length_cm: Optional[float] = None,
        body_weight_g: Optional[float] = None,
        notes: Optional[str] = None,
        body_width_cm: Optional[float] = None,
        mandibular_length_cm: Optional[float] = None,
        gender: Optional[str] = None,
        species: Optional[str] = None,
        time_since_last_experiment_h: Optional[float] = None,
    ) -> None:
        query = """
        INSERT INTO subjects (
            subject_id, body_length_cm, body_weight_g, notes, body_width_cm,
            mandibular_length_cm, gender, species, time_since_last_experiment_h
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subject_id) DO UPDATE SET
            body_length_cm = COALESCE(excluded.body_length_cm, subjects.body_length_cm),
            body_weight_g = COALESCE(excluded.body_weight_g, subjects.body_weight_g),
            notes = COALESCE(excluded.notes, subjects.notes),
            body_width_cm = COALESCE(excluded.body_width_cm, subjects.body_width_cm),
            mandibular_length_cm = COALESCE(excluded.mandibular_length_cm, subjects.mandibular_length_cm),
            gender = COALESCE(excluded.gender, subjects.gender),
            species = COALESCE(excluded.species, subjects.species),
            time_since_last_experiment_h = COALESCE(excluded.time_since_last_experiment_h, subjects.time_since_last_experiment_h)
        """
        with self.get_connection() as conn:
            conn.execute(query, (
                subject_id, body_length_cm, body_weight_g, notes, body_width_cm,
                mandibular_length_cm, gender, species, time_since_last_experiment_h,
            ))
            conn.commit()

    def get_subject(self, subject_id: str) -> Optional[Dict[str, Any]]:
        query = """
        SELECT s.*, COUNT(t.trial_id) AS trial_count
        FROM subjects s
        LEFT JOIN trials t ON t.subject_id = s.subject_id
        WHERE s.subject_id = ?
        GROUP BY s.subject_id
        """
        with self.get_connection() as conn:
            cursor = conn.execute(query, (subject_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_species(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            return [dict(row) for row in conn.execute("SELECT * FROM species ORDER BY code COLLATE NOCASE").fetchall()]

    def create_species(self, code: str, scientific_name: str, image: Optional[str] = None, feeding_cycle_h: Optional[float] = None, rest_cycle_h: Optional[float] = None) -> int:
        with self.get_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO species (code, scientific_name, image, feeding_cycle_h, rest_cycle_h) VALUES (?, ?, ?, ?, ?)",
                (code, scientific_name, image, feeding_cycle_h, rest_cycle_h),
            )
            conn.commit()
            return cursor.lastrowid

    def update_species(self, species_id: int, code: str, scientific_name: str, image: Optional[str] = None, feeding_cycle_h: Optional[float] = None, rest_cycle_h: Optional[float] = None) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute("UPDATE species SET code=?, scientific_name=?, image=?, feeding_cycle_h=?, rest_cycle_h=? WHERE species_id=?", (code, scientific_name, image, feeding_cycle_h, rest_cycle_h, species_id))
            conn.commit()
            return cursor.rowcount > 0

    def touch_subject_date(self, subject_id: str, field: str) -> bool:
        if field not in {"time_since_last_feeding_h", "time_since_last_experiment_h"}:
            raise ValueError("Invalid subject date field")
        with self.get_connection() as conn:
            cursor = conn.execute(f"UPDATE subjects SET {field}=? WHERE subject_id=?", (__import__('datetime').datetime.now().isoformat(timespec='seconds'), subject_id))
            conn.commit()
            return cursor.rowcount > 0

    def delete_species(self, species_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute("DELETE FROM species WHERE species_id=?", (species_id,))
            conn.commit()
            return cursor.rowcount > 0

    def list_boards(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute(
                """SELECT b.*, COUNT(p.peripheral_id) AS peripheral_count
                FROM boards b
                LEFT JOIN peripherals p ON p.board_id = b.board_id
                GROUP BY b.board_id
                ORDER BY b.model COLLATE NOCASE, b.board_id"""
            ).fetchall()
            return [self._board_dict(row) for row in rows]

    def get_board(self, board_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute(
                """SELECT b.*, COUNT(p.peripheral_id) AS peripheral_count
                FROM boards b
                LEFT JOIN peripherals p ON p.board_id = b.board_id
                WHERE b.board_id = ?
                GROUP BY b.board_id""",
                (board_id,),
            ).fetchone()
            return self._board_dict(row) if row else None

    def create_board(self, data: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO boards
                (model, mac, status) VALUES (?, ?, ?)""",
                (data["model"], data["mac"], data["status"]),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def update_board(self, board_id: int, data: Dict[str, Any]) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """UPDATE boards SET model=?, mac=?, status=?, updated_at=CURRENT_TIMESTAMP
                WHERE board_id=?""",
                (data["model"], data["mac"], data["status"], board_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_board_health(self, board_id: int, data: Dict[str, Any]) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """UPDATE boards SET
                model=?, mac=?, status='online', health_usb_detected=?, health_wifi=?,
                health_bluetooth=?, health_hello=?, health_gpio=?, health_pwm=?,
                health_uart=?, health_spi=?, health_checked_at=CURRENT_TIMESTAMP,
                updated_at=CURRENT_TIMESTAMP
                WHERE board_id=?""",
                (
                    data["model"], data["mac"], data["usb_detected"], data["wifi"],
                    data["bluetooth"], data["hello"], data["gpio"], data["pwm"],
                    data["uart"], data["spi"], board_id,
                ),
            )
            conn.commit()
            return cursor.rowcount > 0

    def create_board_from_health(self, data: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            conn.execute(
                """INSERT INTO boards (
                model, mac, status, health_usb_detected, health_wifi,
                health_bluetooth, health_hello, health_gpio, health_pwm,
                health_uart, health_spi, health_checked_at
                ) VALUES (?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(mac) DO UPDATE SET
                model=excluded.model, status='online',
                health_usb_detected=excluded.health_usb_detected,
                health_wifi=excluded.health_wifi,
                health_bluetooth=excluded.health_bluetooth,
                health_hello=excluded.health_hello,
                health_gpio=excluded.health_gpio,
                health_pwm=excluded.health_pwm,
                health_uart=excluded.health_uart,
                health_spi=excluded.health_spi,
                health_checked_at=CURRENT_TIMESTAMP,
                updated_at=CURRENT_TIMESTAMP""",
                (
                    data["model"], data["mac"], data["usb_detected"], data["wifi"],
                    data["bluetooth"], data["hello"], data["gpio"], data["pwm"],
                    data["uart"], data["spi"],
                ),
            )
            row = conn.execute("SELECT board_id FROM boards WHERE mac=?", (data["mac"],)).fetchone()
            conn.commit()
            assert row is not None
            return int(row["board_id"])

    def refresh_board_statuses(self, online_macs: set[str]) -> List[Dict[str, Any]]:
        """Refresh reachability while preserving an unresponsive board's broken state."""
        with self.get_connection() as conn:
            rows = conn.execute("SELECT board_id, mac, status FROM boards").fetchall()
            for row in rows:
                compact_mac = "".join(
                    character for character in row["mac"] if character in "0123456789abcdefABCDEF"
                ).upper()
                next_status = "online" if compact_mac in online_macs else (
                    "broken" if row["status"] == "broken" else "offline"
                )
                if next_status != row["status"]:
                    conn.execute(
                        "UPDATE boards SET status=?, updated_at=CURRENT_TIMESTAMP WHERE board_id=?",
                        (next_status, row["board_id"]),
                    )
            conn.commit()
        return self.list_boards()

    def delete_board(self, board_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute("DELETE FROM boards WHERE board_id = ?", (board_id,))
            conn.commit()
            return cursor.rowcount > 0

    def list_peripherals(self, board_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = """SELECT p.*, b.model || ' · ' || b.mac AS board_name
            FROM peripherals p JOIN boards b ON b.board_id = p.board_id"""
        params: tuple[Any, ...] = ()
        if board_id is not None:
            query += " WHERE p.board_id = ?"
            params = (board_id,)
        query += " ORDER BY p.name COLLATE NOCASE, p.peripheral_id"
        with self.get_connection() as conn:
            return [dict(row) for row in conn.execute(query, params).fetchall()]

    def get_peripheral(self, peripheral_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute(
                """SELECT p.*, b.model || ' · ' || b.mac AS board_name
                FROM peripherals p JOIN boards b ON b.board_id = p.board_id
                WHERE p.peripheral_id = ?""",
                (peripheral_id,),
            ).fetchone()
            return dict(row) if row else None

    def create_peripheral(self, data: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO peripherals
                (name, type, model, board_id, interface_type, voltage, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    data["name"], data["type"], data["model"], data["board_id"],
                    data["interface_type"], data["voltage"], data["status"],
                ),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def update_peripheral(self, peripheral_id: int, data: Dict[str, Any]) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """UPDATE peripherals SET name=?, type=?, model=?, board_id=?,
                interface_type=?, voltage=?, status=?, updated_at=CURRENT_TIMESTAMP
                WHERE peripheral_id=?""",
                (
                    data["name"], data["type"], data["model"], data["board_id"],
                    data["interface_type"], data["voltage"], data["status"], peripheral_id,
                ),
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete_peripheral(self, peripheral_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM peripherals WHERE peripheral_id = ?", (peripheral_id,)
            )
            conn.commit()
            return cursor.rowcount > 0

    def list_software(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute(
                """SELECT id, name, version, description, source_code_addr, supported_device,
                          created_at, updated_at
                   FROM software
                   ORDER BY name COLLATE NOCASE, version COLLATE NOCASE, id"""
            ).fetchall()
            return [dict(row) for row in rows]

    def get_software(self, software_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute(
                """SELECT id, name, version, description, source_code_addr, supported_device,
                          created_at, updated_at
                   FROM software WHERE id=?""",
                (software_id,),
            ).fetchone()
            return dict(row) if row else None

    def create_software(self, data: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO software
                       (name, version, description, source_code_addr, supported_device)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    data["name"], data["version"], data.get("description"),
                    data["source_code_addr"], data["supported_device"],
                ),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def update_software(self, software_id: int, data: Dict[str, Any]) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """UPDATE software SET name=?, version=?, description=?,
                          source_code_addr=?, supported_device=?,
                          updated_at=CURRENT_TIMESTAMP
                   WHERE id=?""",
                (
                    data["name"], data["version"], data.get("description"),
                    data["source_code_addr"], data["supported_device"], software_id,
                ),
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete_software(self, software_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute("DELETE FROM software WHERE id=?", (software_id,))
            conn.commit()
            return cursor.rowcount > 0

    def list_subjects(self) -> List[Dict[str, Any]]:
        query = """
        SELECT s.*, COUNT(t.trial_id) AS trial_count
        FROM subjects s
        LEFT JOIN trials t ON t.subject_id = s.subject_id
        GROUP BY s.subject_id
        ORDER BY s.created_at DESC, s.subject_id
        """
        with self.get_connection() as conn:
            rows = [dict(row) for row in conn.execute(query).fetchall()]
            species = {row["code"]: dict(row) for row in conn.execute("SELECT code, feeding_cycle_h, rest_cycle_h FROM species").fetchall()}
            now = datetime.now(timezone.utc)
            for row in rows:
                config = species.get(row.get("species")) or {}
                status = "Normal"
                try:
                    feeding = datetime.fromisoformat(row["time_since_last_feeding_h"]) if row.get("time_since_last_feeding_h") else None
                    if feeding and feeding.tzinfo is None: feeding = feeding.replace(tzinfo=timezone.utc)
                    if feeding and config.get("feeding_cycle_h") is not None and (now - feeding).total_seconds() / 3600 > config["feeding_cycle_h"]: status = "Hungry"
                    testing = datetime.fromisoformat(row["time_since_last_experiment_h"]) if row.get("time_since_last_experiment_h") else None
                    if testing and testing.tzinfo is None: testing = testing.replace(tzinfo=timezone.utc)
                    if testing and config.get("rest_cycle_h") is not None and (now - testing).total_seconds() / 3600 < config["rest_cycle_h"]: status = "Fatigued"
                except (TypeError, ValueError):
                    pass
                row["status"] = status
            return rows

    def update_subject(
        self,
        current_subject_id: str,
        subject_id: str,
        body_length_cm: Optional[float] = None,
        body_weight_g: Optional[float] = None,
        notes: Optional[str] = None,
        body_width_cm: Optional[float] = None,
        mandibular_length_cm: Optional[float] = None,
        gender: Optional[str] = None,
        species: Optional[str] = None,
        time_since_last_experiment_h: Optional[float] = None,
    ) -> bool:
        """Update a subject, safely carrying linked trials across an ID rename."""
        with self.get_connection() as conn:
            existing = conn.execute(
                "SELECT 1 FROM subjects WHERE subject_id = ?",
                (current_subject_id,),
            ).fetchone()
            if not existing:
                return False
            if subject_id == current_subject_id:
                conn.execute(
                    """UPDATE subjects
                    SET body_length_cm = ?, body_weight_g = ?, notes = ?,
                        body_width_cm = ?, mandibular_length_cm = ?, gender = ?,
                        species = ?, time_since_last_experiment_h = ?
                    WHERE subject_id = ?""",
                    (
                        body_length_cm, body_weight_g, notes, body_width_cm,
                        mandibular_length_cm, gender, species,
                        time_since_last_experiment_h, current_subject_id,
                    ),
                )
            else:
                conn.execute(
                    """INSERT INTO subjects
                    (subject_id, body_length_cm, body_weight_g, notes, body_width_cm,
                     mandibular_length_cm, gender, species, time_since_last_experiment_h)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        subject_id, body_length_cm, body_weight_g, notes,
                        body_width_cm, mandibular_length_cm, gender, species,
                        time_since_last_experiment_h,
                    ),
                )
                conn.execute(
                    "UPDATE trials SET subject_id = ? WHERE subject_id = ?",
                    (subject_id, current_subject_id),
                )
                conn.execute(
                    "DELETE FROM subjects WHERE subject_id = ?",
                    (current_subject_id,),
                )
            conn.commit()
            return True

    def delete_subject(self, subject_id: str) -> bool:
        """Delete an unreferenced subject; linked trials remain FK-protected."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM subjects WHERE subject_id = ?",
                (subject_id,),
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_next_trial_no(
        self,
        subject_id: str,
        experiment_id: Optional[int] = None,
    ) -> int:
        if experiment_id is None:
            query = "SELECT MAX(trial_no) as max_no FROM trials WHERE subject_id = ?"
            params = (subject_id,)
        else:
            query = """
            SELECT MAX(trial_no) as max_no
            FROM trials
            WHERE subject_id = ? AND experiment_id = ?
            """
            params = (subject_id, experiment_id)
        with self.get_connection() as conn:
            cursor = conn.execute(query, params)
            row = cursor.fetchone()
            if row and row["max_no"] is not None:
                return int(row["max_no"]) + 1
            return 1

    def insert_trial(self, trial_data: Dict[str, Any]) -> int:
        keys = [
            "experiment_id", "plan_id", "subject_id", "trial_no", "video_id", "experiment_timestamp", "video_file",
            "stimulation_time", "stimulation_position_id", "stimulation_position_2_id",
            "stimulation_position", "stimulation_voltage_v",
            "stimulation_waveform", "stimulation_high_level_v",
            "stimulation_low_level_v", "stimulation_duty_cycle_pct",
            "stimulation_frequency_hz", "stimulation_duration_s", "stimulation_count",
            "stimulation_interval_s", "baseline_duration_s", "post_stim_duration_s",
            "response_latency_s", "response_action", "response_degree",
            "status", "error_message"
        ]
        
        present_keys = [k for k in keys if k in trial_data]
        placeholders = ", ".join(["?"] * len(present_keys))
        columns = ", ".join(present_keys)
        values = [trial_data[k] for k in present_keys]

        query = f"INSERT INTO trials ({columns}) VALUES ({placeholders})"
        with self.get_connection() as conn:
            cursor = conn.execute(query, values)
            conn.commit()
            return cursor.lastrowid

    def update_trial_response(
        self,
        trial_id: int,
        response_latency_s: Optional[float] = None,
        response_action: Optional[str] = None,
        response_degree: Optional[float] = None
    ) -> bool:
        query = """
        UPDATE trials
        SET response_latency_s = ?, response_action = ?, response_degree = ?
        WHERE trial_id = ?
        """
        with self.get_connection() as conn:
            cursor = conn.execute(query, (response_latency_s, response_action, response_degree, trial_id))
            conn.commit()
            return cursor.rowcount > 0

    def list_tracking_points(self, trial_id: int) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute(
                """SELECT tracking_point_id, trial_id, video_id, frame_no, timestamp, x, y, heading
                   FROM tracking_points WHERE trial_id=? ORDER BY frame_no""",
                (trial_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def upsert_tracking_point(self, trial_id: int, point: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            trial = conn.execute("SELECT video_id FROM trials WHERE trial_id=?", (trial_id,)).fetchone()
            if trial is None:
                return None
            conn.execute(
                """INSERT INTO tracking_points
                    (trial_id, video_id, frame_no, timestamp, x, y, heading)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(trial_id, frame_no) DO UPDATE SET
                    timestamp=excluded.timestamp, x=excluded.x,
                    y=excluded.y, heading=excluded.heading""",
                (trial_id, trial["video_id"], point["frame_no"], point["timestamp"], point["x"], point["y"], point["heading"]),
            )
            conn.commit()
            row = conn.execute(
                "SELECT tracking_point_id, trial_id, video_id, frame_no, timestamp, x, y, heading FROM tracking_points WHERE trial_id=? AND frame_no=?",
                (trial_id, point["frame_no"]),
            ).fetchone()
            return dict(row) if row else None

    def replace_tracking_points(self, trial_id: int, points: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
        with self.get_connection() as conn:
            trial = conn.execute("SELECT video_id FROM trials WHERE trial_id=?", (trial_id,)).fetchone()
            if trial is None:
                return None
            conn.execute("DELETE FROM tracking_points WHERE trial_id=?", (trial_id,))
            conn.executemany(
                "INSERT INTO tracking_points (trial_id, video_id, frame_no, timestamp, x, y, heading) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(trial_id, trial["video_id"], p["frame_no"], p["timestamp"], p["x"], p["y"], p["heading"]) for p in points],
            )
            conn.commit()
            rows = conn.execute(
                "SELECT tracking_point_id, trial_id, video_id, frame_no, timestamp, x, y, heading FROM tracking_points WHERE trial_id=? ORDER BY frame_no",
                (trial_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_response(self, trial_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM responses WHERE trial_id=?", (trial_id,)).fetchone()
            return dict(row) if row else None

    def upsert_response(self, trial_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            trial = conn.execute("SELECT video_id FROM trials WHERE trial_id=?", (trial_id,)).fetchone()
            if trial is None:
                return None
            conn.execute(
                """INSERT INTO responses (
                    trial_id, video_id, latency_s, action, travel_distance_mm,
                    displacement_mm, mean_linear_speed_mm_s, cumulative_rotation_deg,
                    net_rotation_deg, mean_angular_speed_deg_s, mean_angular_velocity_deg_s
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(trial_id) DO UPDATE SET
                    video_id=excluded.video_id, latency_s=excluded.latency_s,
                    action=excluded.action, travel_distance_mm=excluded.travel_distance_mm,
                    displacement_mm=excluded.displacement_mm,
                    mean_linear_speed_mm_s=excluded.mean_linear_speed_mm_s,
                    cumulative_rotation_deg=excluded.cumulative_rotation_deg,
                    net_rotation_deg=excluded.net_rotation_deg,
                    mean_angular_speed_deg_s=excluded.mean_angular_speed_deg_s,
                    mean_angular_velocity_deg_s=excluded.mean_angular_velocity_deg_s""",
                (trial_id, trial["video_id"], data.get("latency_s"), data.get("action"), data.get("travel_distance_mm"), data.get("displacement_mm"), data.get("mean_linear_speed_mm_s"), data.get("cumulative_rotation_deg"), data.get("net_rotation_deg"), data.get("mean_angular_speed_deg_s"), data.get("mean_angular_velocity_deg_s")),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM responses WHERE trial_id=?", (trial_id,)).fetchone()
            return dict(row) if row else None

    def update_trial(self, trial_id: int, trial_data: Dict[str, Any]) -> bool:
        """Update the editable fields of one trial while preserving its video identity."""
        allowed = (
            "experiment_id", "subject_id", "trial_no", "experiment_timestamp",
            "stimulation_position_id", "stimulation_position_2_id", "stimulation_position",
            "stimulation_waveform", "stimulation_high_level_v", "stimulation_low_level_v",
            "stimulation_duty_cycle_pct", "stimulation_voltage_v",
            "stimulation_frequency_hz", "response_latency_s", "response_action",
            "response_degree", "status",
        )
        values = {key: trial_data[key] for key in allowed if key in trial_data}
        if not values:
            return False
        assignments = ", ".join(f"{key} = ?" for key in values)
        query = f"UPDATE trials SET {assignments} WHERE trial_id = ?"
        with self.get_connection() as conn:
            cursor = conn.execute(query, (*values.values(), trial_id))
            conn.commit()
            return cursor.rowcount > 0

    def delete_trial(self, trial_id: int) -> bool:
        """Delete one database row; callers may clean up its video file."""
        with self.get_connection() as conn:
            cursor = conn.execute("DELETE FROM trials WHERE trial_id = ?", (trial_id,))
            conn.commit()
            return cursor.rowcount > 0

    def list_trials(
        self,
        subject_id: Optional[str] = None,
        experiment_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        if subject_id:
            conditions.append("t.subject_id = ?")
            params.append(subject_id)
        if experiment_id is not None:
            conditions.append("t.experiment_id = ?")
            params.append(experiment_id)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
        SELECT t.*, s.body_length_cm, s.body_weight_g, s.body_width_cm,
               s.mandibular_length_cm, s.gender, s.species,
               s.time_since_last_experiment_h, e.title AS experiment_title
        FROM trials t
        LEFT JOIN subjects s ON t.subject_id = s.subject_id
        LEFT JOIN experiment e ON t.experiment_id = e.experiment_id
        {where}
        ORDER BY t.trial_id DESC
        LIMIT ?
        """
        params.append(limit)

        with self.get_connection() as conn:
            cursor = conn.execute(query, tuple(params))
            return [dict(row) for row in cursor.fetchall()]

    def get_trial(self, trial_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM trials WHERE trial_id=?", (trial_id,)).fetchone()
            return dict(row) if row else None

    def clear_all_data(self) -> Dict[str, int]:
        """Delete experiment records while deliberately leaving video files untouched."""
        with self.get_connection() as conn:
            trial_count = conn.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
            subject_count = conn.execute("SELECT COUNT(*) FROM subjects").fetchone()[0]
            experiment_count = conn.execute("SELECT COUNT(*) FROM experiment").fetchone()[0]
            conn.execute("DELETE FROM trials")
            conn.execute("DELETE FROM subjects")
            conn.execute("DELETE FROM experiment")
            conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('trials', 'experiment')")
            conn.commit()
        return {
            "trials_deleted": trial_count,
            "subjects_deleted": subject_count,
            "experiments_deleted": experiment_count,
        }
