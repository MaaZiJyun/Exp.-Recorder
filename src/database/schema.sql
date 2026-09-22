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

CREATE TABLE IF NOT EXISTS boards (
    board_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    mac TEXT NOT NULL UNIQUE COLLATE NOCASE,
    gpio_count INTEGER NOT NULL DEFAULT 0 CHECK (gpio_count >= 0),
    working_voltage REAL NOT NULL CHECK (working_voltage >= 0),
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'broken')),
    health_usb_detected INTEGER CHECK (health_usb_detected IN (0, 1)),
    health_wifi INTEGER CHECK (health_wifi IN (0, 1)),
    health_bluetooth INTEGER CHECK (health_bluetooth IN (0, 1)),
    health_hello INTEGER CHECK (health_hello IN (0, 1)),
    health_gpio INTEGER CHECK (health_gpio IN (0, 1)),
    health_pwm INTEGER CHECK (health_pwm IN (0, 1)),
    health_uart INTEGER CHECK (health_uart IN (0, 1)),
    health_spi INTEGER CHECK (health_spi IN (0, 1)),
    health_checked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peripherals (
    peripheral_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('camera', 'imu', 'dac', 'motor', 'sensor')),
    model TEXT NOT NULL,
    board_id INTEGER NOT NULL,
    interface_type TEXT NOT NULL CHECK (interface_type IN ('GPIO', 'I2C', 'SPI', 'UART', 'PWM')),
    voltage REAL NOT NULL CHECK (voltage >= 0),
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'broken')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(board_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_peripherals_board ON peripherals(board_id);

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

CREATE TABLE IF NOT EXISTS experiment_plans (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    subject_id TEXT NOT NULL,
    stimulation_position_id INTEGER NOT NULL,
    stimulation_position_2_id INTEGER NOT NULL,
    stimulation_position TEXT NOT NULL,
    stimulation_voltage_v REAL NOT NULL,
    stimulation_waveform TEXT NOT NULL DEFAULT 'SQUARE',
    stimulation_high_level_v REAL NOT NULL,
    stimulation_low_level_v REAL NOT NULL,
    stimulation_duty_cycle_pct REAL NOT NULL DEFAULT 50,
    stimulation_frequency_hz REAL NOT NULL,
    stimulation_duration_s REAL NOT NULL,
    stimulation_count INTEGER NOT NULL DEFAULT 1,
    stimulation_interval_s REAL NOT NULL DEFAULT 0,
    trial_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiment(experiment_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
    FOREIGN KEY (stimulation_position_id) REFERENCES stimulation_positions(position_id),
    FOREIGN KEY (stimulation_position_2_id) REFERENCES stimulation_positions(position_id)
);

CREATE TABLE IF NOT EXISTS trials (
    trial_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
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
    FOREIGN KEY (plan_id) REFERENCES experiment_plans(plan_id),
    FOREIGN KEY (subject_id) REFERENCES subjects (subject_id),
    FOREIGN KEY (stimulation_position_id) REFERENCES stimulation_positions (position_id),
    FOREIGN KEY (stimulation_position_2_id) REFERENCES stimulation_positions (position_id)
);

CREATE INDEX IF NOT EXISTS idx_trials_subject ON trials(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_video_id ON trials(video_id);

-- Per-frame animal tracking data. A Trial owns one video and many points.
CREATE TABLE IF NOT EXISTS tracking_points (
    tracking_point_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trial_id INTEGER NOT NULL,
    video_id TEXT NOT NULL,
    frame_no INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    heading REAL NOT NULL,
    FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES trials(video_id) ON DELETE CASCADE,
    UNIQUE (trial_id, frame_no)
);

CREATE INDEX IF NOT EXISTS idx_tracking_points_trial ON tracking_points(trial_id, frame_no);
CREATE INDEX IF NOT EXISTS idx_tracking_points_video ON tracking_points(video_id, frame_no);

-- One response summary per Trial/Video.
CREATE TABLE IF NOT EXISTS responses (
    trial_id INTEGER PRIMARY KEY,
    video_id TEXT NOT NULL UNIQUE,
    latency_s REAL,
    action TEXT,
    travel_distance_mm REAL,
    displacement_mm REAL,
    mean_linear_speed_mm_s REAL,
    cumulative_rotation_deg REAL,
    net_rotation_deg REAL,
    mean_angular_speed_deg_s REAL,
    mean_angular_velocity_deg_s REAL,
    FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES trials(video_id) ON DELETE CASCADE
);
