-- SQLite Database Schema for Experiment Automation System

CREATE TABLE IF NOT EXISTS subjects (
    subject_id TEXT PRIMARY KEY,
    body_length_cm REAL,
    body_weight_g REAL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experiment (
    experiment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trials (
    trial_id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER,
    subject_id TEXT NOT NULL,
    trial_no INTEGER NOT NULL,
    video_id TEXT NOT NULL UNIQUE,
    experiment_timestamp TEXT NOT NULL,
    video_file TEXT NOT NULL,
    
    -- Stimulation Parameters & Timestamps
    stimulation_time TEXT,
    stimulation_position TEXT,
    stimulation_voltage_v REAL NOT NULL,
    stimulation_waveform TEXT NOT NULL DEFAULT 'SQUARE',
    stimulation_high_level_v REAL,
    stimulation_low_level_v REAL,
    stimulation_duty_cycle_pct REAL,
    stimulation_frequency_hz REAL NOT NULL,
    stimulation_duration_s REAL NOT NULL,
    stimulation_count INTEGER NOT NULL DEFAULT 1,
    stimulation_interval_s REAL NOT NULL DEFAULT 0.0,
    
    -- Baseline and Post-recording Durations (s)
    baseline_duration_s REAL DEFAULT 2.0,
    post_stim_duration_s REAL DEFAULT 3.0,
    
    -- Manual Post-experiment Annotation Data
    response_latency_s REAL,
    response_action TEXT,
    response_degree REAL,
    
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED', 'ABORTED'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (experiment_id) REFERENCES experiment (experiment_id),
    FOREIGN KEY (subject_id) REFERENCES subjects (subject_id)
);

CREATE INDEX IF NOT EXISTS idx_trials_subject ON trials(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_video_id ON trials(video_id);
