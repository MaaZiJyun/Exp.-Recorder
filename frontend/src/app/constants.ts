import type { TrialForm } from "./types";

export const initialForm: TrialForm = {
  subject_id: "B01",
  body_length_cm: "",
  body_weight_g: "",
  waveform: "SQUARE",
  high_level_v: "",
  low_level_v: "",
  duty_cycle_pct: "",
  frequency_hz: "",
  duration_s: "",
  count: "",
  interval_s: "",
  position_id: "",
  position_2_id: "",
  baseline_duration_s: "",
  post_stim_duration_s: "",
};

export const responseActions = [
  { code: "0", zh: "Stationary", en: "Stationary", definition: "No visible displacement" },
  { code: "1", zh: "Forward", en: "Forward", definition: "Primarily moves forward" },
  { code: "2", zh: "Backward", en: "Backward", definition: "Primarily moves backward" },
  {
    code: "3",
    zh: "Turn left",
    en: "Turn Left",
    definition: "Primarily changes direction to the left",
  },
  {
    code: "4",
    zh: "Turn right",
    en: "Turn Right",
    definition: "Primarily changes direction to the right",
  },
  {
    code: "5",
    zh: "Forward-left",
    en: "Forward-Left",
    definition: "Combines forward and leftward movement",
  },
  {
    code: "6",
    zh: "Forward-right",
    en: "Forward-Right",
    definition: "Combines forward and rightward movement",
  },
  {
    code: "7",
    zh: "Backward-left",
    en: "Backward-Left",
    definition: "Combines backward and leftward movement",
  },
  {
    code: "8",
    zh: "Backward-right",
    en: "Backward-Right",
    definition: "Combines backward and rightward movement",
  },
  {
    code: "9",
    zh: "Head raise",
    en: "Head Raising",
    definition: "Clearly raises the head without visible displacement",
  },
  {
    code: "10",
    zh: "Twitch / flick",
    en: "Shaking",
    definition: "Visible body twitching",
  },
  {
    code: "11",
    zh: "Unrelated",
    en: "Not Applicable",
    definition: "Response is unrelated or cannot be classified",
  },
] as const;

export const responseDegrees = [
  {
    score: "0",
    level: "No response",
    criteria: "No visible behavioral change compared with the stationary control",
    example: "No visible movement",
  },
  {
    score: "1",
    level: "Mild response",
    criteria: "A mild, brief response without clear directional movement",
    example: "Head raise, slight body tension, or minor antenna movement",
  },
  {
    score: "2",
    level: "Active response",
    criteria: "Clear behavior with speed close to the active control",
    example: "Normal walking, turning, or forward/backward movement",
  },
  {
    score: "3",
    level: "Excessive response",
    criteria: "Marked abnormal or non-target behavior that may indicate excessive stimulation or severe stress",
    example: "Convulsions, rolling over, frantic running, struggling, or severe stress",
  },
  {
    score: "4",
    level: "Not applicable",
    criteria: "Response is not applicable or cannot be assessed",
    example: "Not applicable or indeterminate",
  },
] as const;
