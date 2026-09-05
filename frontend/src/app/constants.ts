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
  { code: "0", zh: "静止", en: "Stationary", definition: "无明显位移" },
  { code: "1", zh: "前进", en: "Forward", definition: "主要向前方移动" },
  { code: "2", zh: "后退", en: "Backward", definition: "主要向后方移动" },
  {
    code: "3",
    zh: "左转",
    en: "Turn Left",
    definition: "主要向左改变运动方向",
  },
  {
    code: "4",
    zh: "右转",
    en: "Turn Right",
    definition: "主要向右改变运动方向",
  },
  {
    code: "5",
    zh: "前左斜行",
    en: "Forward-Left",
    definition: "同时具有前进和左向运动分量",
  },
  {
    code: "6",
    zh: "前右斜行",
    en: "Forward-Right",
    definition: "同时具有前进和右向运动分量",
  },
  {
    code: "7",
    zh: "后左斜退",
    en: "Backward-Left",
    definition: "同时具有后退和左向运动分量",
  },
  {
    code: "8",
    zh: "后右斜退",
    en: "Backward-Right",
    definition: "同时具有后退和右向运动分量",
  },
  {
    code: "9",
    zh: "抬头",
    en: "Head Raising",
    definition: "头部明显抬起，但未形成明显位移",
  },
] as const;

export const responseDegrees = [
  {
    score: "0",
    level: "无反应",
    criteria: "与静止对照组相比无明显行为变化",
    example: "无明显动作",
  },
  {
    score: "1",
    level: "轻微反应",
    criteria: "出现轻微、短暂的身体反应，但未产生明显的定向运动",
    example: "抬头、身体轻微绷紧、触角轻微活动",
  },
  {
    score: "2",
    level: "积极反应",
    criteria: "出现明显、可重复的目标行为；运动速度与动态对照组接近",
    example: "正常行走、转向、前进/后退等",
  },
  {
    score: "3",
    level: "过激反应",
    criteria: "出现明显异常或非目标行为，可能表明刺激强度过高或产生强烈应激",
    example: "抽搐、翻身、剧烈乱跑、挣扎、明显应激反应",
  },
] as const;
