"""Database Manager for SQLite."""

import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from src.config import DB_PATH


class DatabaseManager:
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
            existing_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(trials)").fetchall()
            }
            migrations = {
                "stimulation_waveform": "TEXT NOT NULL DEFAULT 'SQUARE'",
                "stimulation_high_level_v": "REAL",
                "stimulation_low_level_v": "REAL",
                "stimulation_duty_cycle_pct": "REAL",
            }
            for column, definition in migrations.items():
                if column not in existing_columns:
                    conn.execute(f"ALTER TABLE trials ADD COLUMN {column} {definition}")
            conn.commit()

    def upsert_subject(
        self,
        subject_id: str,
        body_length_cm: Optional[float] = None,
        body_weight_g: Optional[float] = None,
        notes: Optional[str] = None
    ) -> None:
        query = """
        INSERT INTO subjects (subject_id, body_length_cm, body_weight_g, notes)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(subject_id) DO UPDATE SET
            body_length_cm = COALESCE(excluded.body_length_cm, subjects.body_length_cm),
            body_weight_g = COALESCE(excluded.body_weight_g, subjects.body_weight_g),
            notes = COALESCE(excluded.notes, subjects.notes)
        """
        with self.get_connection() as conn:
            conn.execute(query, (subject_id, body_length_cm, body_weight_g, notes))
            conn.commit()

    def get_subject(self, subject_id: str) -> Optional[Dict[str, Any]]:
        query = "SELECT * FROM subjects WHERE subject_id = ?"
        with self.get_connection() as conn:
            cursor = conn.execute(query, (subject_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_next_trial_no(self, subject_id: str) -> int:
        query = "SELECT MAX(trial_no) as max_no FROM trials WHERE subject_id = ?"
        with self.get_connection() as conn:
            cursor = conn.execute(query, (subject_id,))
            row = cursor.fetchone()
            if row and row["max_no"] is not None:
                return int(row["max_no"]) + 1
            return 1

    def insert_trial(self, trial_data: Dict[str, Any]) -> int:
        keys = [
            "subject_id", "trial_no", "video_id", "experiment_timestamp", "video_file",
            "stimulation_time", "stimulation_position", "stimulation_voltage_v",
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

    def list_trials(self, subject_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        if subject_id:
            query = """
            SELECT t.*, s.body_length_cm, s.body_weight_g
            FROM trials t
            LEFT JOIN subjects s ON t.subject_id = s.subject_id
            WHERE t.subject_id = ?
            ORDER BY t.trial_id DESC
            LIMIT ?
            """
            params = (subject_id, limit)
        else:
            query = """
            SELECT t.*, s.body_length_cm, s.body_weight_g
            FROM trials t
            LEFT JOIN subjects s ON t.subject_id = s.subject_id
            ORDER BY t.trial_id DESC
            LIMIT ?
            """
            params = (limit,)

        with self.get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def clear_all_data(self) -> Dict[str, int]:
        """Delete experiment records while deliberately leaving video files untouched."""
        with self.get_connection() as conn:
            trial_count = conn.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
            subject_count = conn.execute("SELECT COUNT(*) FROM subjects").fetchone()[0]
            conn.execute("DELETE FROM trials")
            conn.execute("DELETE FROM subjects")
            conn.execute("DELETE FROM sqlite_sequence WHERE name = 'trials'")
            conn.commit()
        return {"trials_deleted": trial_count, "subjects_deleted": subject_count}
