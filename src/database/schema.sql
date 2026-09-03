-- SQLite Database Schema for Experiment Automation System

CREATE TABLE IF NOT EXISTS species (
    species_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    scientific_name TEXT NOT NULL,
    image TEXT,
    feeding_cycle_h REAL,
    rest_cycle_h REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    subject_id TEXT PRIMARY KEY,
    body_length_cm REAL,
    body_weight_g REAL,
    body_width_cm REAL,
    mandibular_length_cm REAL,
    gender TEXT,
    species TEXT,
    time_since_last_feeding_h TEXT,
    time_since_last_experiment_h TEXT,
    recent_fighting TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experiment (
    experiment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stimulation_position_images (
    image_id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_hash TEXT NOT NULL UNIQUE,
    image TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stimulation_positions (
    position_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    image TEXT, -- legacy migration source; new records use image_id
    image_id INTEGER,
    mark TEXT,
    species TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES stimulation_position_images (image_id)
);

CREATE TABLE IF NOT EXISTS stimulation_position_species (
    position_id INTEGER NOT NULL,
    species_id INTEGER NOT NULL,
    PRIMARY KEY (position_id, species_id),
    FOREIGN KEY (position_id) REFERENCES stimulation_positions(position_id) ON DELETE CASCADE,
    FOREIGN KEY (species_id) REFERENCES species(species_id) ON DELETE CASCADE
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
    stimulation_position_id INTEGER,
    stimulation_position_2_id INTEGER,
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
    FOREIGN KEY (subject_id) REFERENCES subjects (subject_id),
    FOREIGN KEY (stimulation_position_id) REFERENCES stimulation_positions (position_id),
    FOREIGN KEY (stimulation_position_2_id) REFERENCES stimulation_positions (position_id)
);

CREATE INDEX IF NOT EXISTS idx_trials_subject ON trials(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_video_id ON trials(video_id);
