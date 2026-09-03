"""Database Manager for SQLite."""

import hashlib
import json
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
            }
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
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_experiment ON trials(experiment_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_position ON trials(stimulation_position_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trials_position_2 ON trials(stimulation_position_2_id)"
            )
            conn.commit()

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
    ) -> int:
        with self.get_connection() as conn:
            image_id = self._resolve_position_image(conn, image)
            cursor = conn.execute(
                """INSERT INTO stimulation_positions
                (code, description, image_id, mark) VALUES (?, ?, ?, ?)""",
                (code, description, image_id, self._mark_json(mark)),
            )
            conn.commit()
            return cursor.lastrowid

    def get_stimulation_position(self, position_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute(
                """SELECT p.position_id, p.code, p.description, p.image_id,
                    p.mark, p.created_at, i.image, (
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
                    p.mark, p.created_at, i.image, (
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
                """WITH combinations AS (
                    SELECT DISTINCT stimulation_position AS position_combination
                    FROM trials
                    WHERE stimulation_position IS NOT NULL
                      AND TRIM(stimulation_position) != ''
                      AND (? IS NULL OR experiment_id = ?)
                )
                SELECT s.subject_id, c.position_combination,
                    COUNT(DISTINCT t.trial_id) AS trial_count
                FROM subjects s
                CROSS JOIN combinations c
                LEFT JOIN trials t
                  ON t.subject_id = s.subject_id
                 AND t.stimulation_position = c.position_combination
                 AND (? IS NULL OR t.experiment_id = ?)
                GROUP BY s.subject_id, c.position_combination
                ORDER BY s.subject_id COLLATE NOCASE,
                         c.position_combination COLLATE NOCASE""",
                (experiment_id, experiment_id, experiment_id, experiment_id),
            ).fetchall()
            return [dict(row) for row in rows]

    def update_stimulation_position(
        self,
        position_id: int,
        code: str,
        description: Optional[str] = None,
        image: Optional[str] = None,
        mark: Optional[Dict[str, float]] = None,
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
                SET code = ?, description = ?, image_id = ?, mark = ?, image = NULL
                WHERE position_id = ?""",
                (code, description, image_id, self._mark_json(mark), position_id),
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

    def list_subjects(self) -> List[Dict[str, Any]]:
        query = """
        SELECT s.*, COUNT(t.trial_id) AS trial_count
        FROM subjects s
        LEFT JOIN trials t ON t.subject_id = s.subject_id
        GROUP BY s.subject_id
        ORDER BY s.created_at DESC, s.subject_id
        """
        with self.get_connection() as conn:
            return [dict(row) for row in conn.execute(query).fetchall()]

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
            "experiment_id", "subject_id", "trial_no", "video_id", "experiment_timestamp", "video_file",
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
