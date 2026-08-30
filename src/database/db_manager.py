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
                "experiment_id": "INTEGER REFERENCES experiment(experiment_id)",
                "stimulation_waveform": "TEXT NOT NULL DEFAULT 'SQUARE'",
                "stimulation_high_level_v": "REAL",
                "stimulation_low_level_v": "REAL",
                "stimulation_duty_cycle_pct": "REAL",
            }
            for column, definition in migrations.items():
                if column not in existing_columns:
                    conn.execute(f"ALTER TABLE trials ADD COLUMN {column} {definition}")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_experiment ON trials(experiment_id)"
            )
            conn.commit()

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
            "experiment_id", "subject_id", "trial_no", "video_id", "experiment_timestamp", "video_file",
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

    def update_trial(self, trial_id: int, trial_data: Dict[str, Any]) -> bool:
        """Update the editable fields of one trial while preserving its video identity."""
        allowed = (
            "experiment_id", "subject_id", "trial_no", "experiment_timestamp", "stimulation_position",
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
        """Delete one database row without deleting its video file."""
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
        SELECT t.*, s.body_length_cm, s.body_weight_g, e.title AS experiment_title
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
