export type DeviceStatus = {
  mock: boolean;
  sdg_connected: boolean;
  sdg_error: string | null;
  camera_connected: boolean;
  camera_recording: boolean;
  camera_error: string | null;
};

export type Trial = {
  trial_id: number | null;
  experiment_id: number | null;
  experiment_title: string | null;
  subject_id: string;
  trial_no: number;
  video_id: string;
  experiment_timestamp: string;
  stimulation_time: string | null;
  stimulation_position_id: number | null;
  stimulation_position_2_id: number | null;
  stimulation_position: string;
  stimulation_voltage_v: number;
  stimulation_waveform: string;
  stimulation_high_level_v: number | null;
  stimulation_low_level_v: number | null;
  stimulation_duty_cycle_pct: number | null;
  stimulation_frequency_hz: number;
  status: string;
  response_latency_s: number | null;
  response_action: string | null;
  response_degree: number | null;
};

export type Experiment = {
  experiment_id: number;
  title: string;
  description: string | null;
  created_at: string;
  trial_count: number;
};

export type SubjectRecord = {
  subject_id: string;
  body_length_cm: number | null;
  body_weight_g: number | null;
  body_width_cm: number | null;
  mandibular_length_cm: number | null;
  gender: string | null;
  species: string | null;
  time_since_last_experiment_h: string | null;
  time_since_last_feeding_h: string | null;
  notes: string | null;
  created_at: string;
  trial_count: number;
  status: "正常" | "饥饿" | "疲劳";
};

export type SpeciesRecord = {
  species_id: number;
  code: string;
  scientific_name: string;
  image: string | null;
  feeding_cycle_h: number | null;
  rest_cycle_h: number | null;
};

export type StimulationPosition = {
  position_id: number;
  code: string;
  description: string | null;
  image_id: number | null;
  image: string | null;
  mark: { x: number; y: number } | null;
  species: string | null;
  created_at: string;
  trial_count: number;
};

export type SubjectPositionCombinationStatistic = {
  subject_id: string;
  position_combination: string;
  trial_count: number;
};

export type ExperimentPlan = {
  plan_id: number;
  experiment_id: number;
  subject_id: string;
  stimulation_position_id: number;
  stimulation_position_2_id: number;
  red_position_code: string;
  black_position_code: string;
  stimulation_position: string;
  stimulation_voltage_v: number;
  stimulation_waveform: string;
  stimulation_high_level_v: number;
  stimulation_low_level_v: number;
  stimulation_duty_cycle_pct: number;
  stimulation_frequency_hz: number;
  stimulation_duration_s: number;
  stimulation_count: number;
  stimulation_interval_s: number;
  trial_count: number;
  completed_trial_count: number;
};

export type RowEdit = {
  subject_id: string;
  trial_no: string;
  experiment_timestamp: string;
  stimulation_position_id: string;
  stimulation_position_2_id: string;
  stimulation_waveform: string;
  stimulation_high_level_v: string;
  stimulation_low_level_v: string;
  stimulation_duty_cycle_pct: string;
  stimulation_frequency_hz: string;
  response_latency_s: string;
  response_action: string;
  response_degree: string;
  status: string;
};

export type TaskState = {
  task_id: string | null;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  result: (Trial & { error_message?: string | null }) | null;
  logs: { timestamp: string; message: string }[];
};

export type TrialForm = {
  subject_id: string;
  body_length_cm: string;
  body_weight_g: string;
  waveform: string;
  high_level_v: string;
  low_level_v: string;
  duty_cycle_pct: string;
  frequency_hz: string;
  duration_s: string;
  count: string;
  interval_s: string;
  position_id: string;
  position_2_id: string;
  baseline_duration_s: string;
  post_stim_duration_s: string;
};

export type DefaultConfig = Omit<
  TrialForm,
  "subject_id" | "body_length_cm" | "body_weight_g"
>;
