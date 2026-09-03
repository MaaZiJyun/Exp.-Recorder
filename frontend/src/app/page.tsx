"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowPathIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";
import { AppShell } from "@/components/circo/app-shell";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/circo/ui";

type DeviceStatus = {
  mock: boolean;
  sdg_connected: boolean;
  sdg_error: string | null;
  camera_connected: boolean;
  camera_recording: boolean;
  camera_error: string | null;
};

type Trial = {
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

type Experiment = {
  experiment_id: number;
  title: string;
  description: string | null;
  created_at: string;
  trial_count: number;
};

type SubjectRecord = {
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

type SpeciesRecord = {
  species_id: number;
  code: string;
  scientific_name: string;
  image: string | null;
  feeding_cycle_h: number | null;
  rest_cycle_h: number | null;
};

type StimulationPosition = {
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

type SubjectPositionCombinationStatistic = {
  subject_id: string;
  position_combination: string;
  trial_count: number;
};

type RowEdit = {
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

type TaskState = {
  task_id: string | null;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  result: (Trial & { error_message?: string | null }) | null;
  logs: { timestamp: string; message: string }[];
};

type TrialForm = {
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

type DefaultConfig = Omit<
  TrialForm,
  "subject_id" | "body_length_cm" | "body_weight_g"
>;

const initialForm: TrialForm = {
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

const responseActions = [
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

const responseDegrees = [
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

function actionLabel(value: string | null) {
  if (!value) return null;
  const action = responseActions.find((item) => item.code === value);
  return action ? `${action.code} · ${action.en}` : value;
}

function degreeLabel(value: number | null) {
  if (value === null) return null;
  const degree = responseDegrees.find((item) => item.score === String(value));
  return degree ? `L${degree.score} ${degree.level}` : `L${value}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function numberOrNull(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`status-dot ${active ? "online" : "offline"}`}
      aria-hidden
    />
  );
}

function TrialPositionPreview({
  trial,
  positions,
  showDetails = false,
}: {
  trial: Trial;
  positions: StimulationPosition[];
  showDetails?: boolean;
}) {
  const selectedPositions = [
    positions.find(
      (position) => position.position_id === trial.stimulation_position_id,
    ),
    positions.find(
      (position) => position.position_id === trial.stimulation_position_2_id,
    ),
  ].filter((position): position is StimulationPosition => Boolean(position));
  const map = selectedPositions.find((position) => position.image)?.image ?? null;

  if (!map) {
    return (
      <div className="trial-position-empty">
        <span>POSITION MAP</span>
        <small>该 Trial 没有可用的刺激位置图片</small>
      </div>
    );
  }

  return (
    <div className="trial-position-preview">
      <div className="trial-position-map">
        <img src={map} alt={`刺激位置 ${trial.stimulation_position}`} />
        {selectedPositions.map(
          (position) =>
            position.mark && (
              <span
                key={position.position_id}
                className="trial-position-marker"
                style={{
                  left: `${position.mark.x * 100}%`,
                  top: `${position.mark.y * 100}%`,
                }}
              >
                <i />
                <b>{position.code}</b>
              </span>
            ),
        )}
      </div>
      {showDetails && (
        <div className="trial-position-details">
          {selectedPositions.map((position) => (
            <div key={position.position_id}>
              <strong>{position.code}</strong>
              <p>{position.description || "暂无描述"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<"execute" | "manage">("execute");
  const [devices, setDevices] = useState<DeviceStatus | null>(null);
  const [task, setTask] = useState<TaskState>({
    task_id: null,
    status: "IDLE",
    result: null,
    logs: [],
  });
  const [trials, setTrials] = useState<Trial[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [runExperimentId, setRunExperimentId] = useState("");
  const [managedExperimentId, setManagedExperimentId] = useState<number | null>(
    null,
  );
  const [experimentQuery, setExperimentQuery] = useState("");
  const [experimentDraft, setExperimentDraft] = useState({
    title: "",
    description: "",
  });
  const [editingExperiment, setEditingExperiment] = useState(false);
  const [experimentEditorId, setExperimentEditorId] = useState<number | null>(
    null,
  );
  const [experimentSaving, setExperimentSaving] = useState(false);
  const [experimentDeleting, setExperimentDeleting] = useState(false);
  const [manageTab, setManageTab] = useState<
    "experiments" | "subjects" | "positions" | "species" | "statistics"
  >(
    "experiments",
  );
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [speciesRecords, setSpeciesRecords] = useState<SpeciesRecord[]>([]);
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [speciesEditorId, setSpeciesEditorId] = useState<number | null>(null);
  const [speciesDraft, setSpeciesDraft] = useState({ code: "", scientific_name: "", image: "", feeding_cycle_h: "", rest_cycle_h: "" });
  const [subjectQuery, setSubjectQuery] = useState("");
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectEditorId, setSubjectEditorId] = useState<string | null>(null);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectDeleting, setSubjectDeleting] = useState<string | null>(null);
  const [positions, setPositions] = useState<StimulationPosition[]>([]);
  const [subjectPositionCombinationStatistics, setSubjectPositionCombinationStatistics] = useState<
    SubjectPositionCombinationStatistic[]
  >([]);
  const [statisticsExperimentId, setStatisticsExperimentId] = useState<number | null>(null);
  const [positionQuery, setPositionQuery] = useState("");
  const [editingPosition, setEditingPosition] = useState(false);
  const [positionEditorId, setPositionEditorId] = useState<number | null>(null);
  const [positionSaving, setPositionSaving] = useState(false);
  const [positionDeleting, setPositionDeleting] = useState<number | null>(null);
  const [selectedPositionImageId, setSelectedPositionImageId] = useState<
    number | null
  >(null);
  const [positionDraft, setPositionDraft] = useState({
    code: "",
    description: "",
    image: "",
    mark: null as { x: number; y: number } | null,
    species: "",
  });
  const [subjectDraft, setSubjectDraft] = useState({
    subject_id: "",
    body_length_cm: "",
    body_weight_g: "",
    body_width_cm: "",
    mandibular_length_cm: "",
    gender: "",
    species: "",
    time_since_last_experiment_h: "",
    notes: "",
  });
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [form, setForm] = useState<TrialForm>(initialForm);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Trial | null>(null);
  const [pendingTrial, setPendingTrial] = useState<Trial | null>(null);
  const [annotation, setAnnotation] = useState({
    latency: "",
    action: "",
    degree: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rowEdit, setRowEdit] = useState<RowEdit | null>(null);
  const [rowSaving, setRowSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [cameraMirrored, setCameraMirrored] = useState(false);
  const [cameraFlipped, setCameraFlipped] = useState(false);
  const previousTaskStatus = useRef(task.status);
  const filterRef = useRef("");
  const managedExperimentRef = useRef<number | null>(null);
  const logWindowRef = useRef<HTMLDivElement>(null);

  const loadTrials = useCallback(
    async (subject = "", experimentId: number | null = null) => {
      const params = new URLSearchParams();
      if (subject.trim()) params.set("subject_id", subject.trim());
      if (experimentId !== null)
        params.set("experiment_id", String(experimentId));
      const query = params.size ? `?${params.toString()}` : "";
      setTrials(await api<Trial[]>(`/trials${query}`));
    },
    [],
  );

  const loadExperiments = useCallback(async () => {
    const records = await api<Experiment[]>("/experiments");
    setExperiments(records);
    setRunExperimentId(
      (current) =>
        current || (records[0] ? String(records[0].experiment_id) : ""),
    );
    return records;
  }, []);

  const loadSubjects = useCallback(async () => {
    const records = await api<SubjectRecord[]>("/subjects");
    setSubjects(records);
    return records;
  }, []);
  const loadSpecies = useCallback(async () => {
    const records = await api<SpeciesRecord[]>("/species");
    setSpeciesRecords(records);
    return records;
  }, []);
  const saveSpecies = async () => {
    if (!speciesDraft.code.trim() || !speciesDraft.scientific_name.trim()) return;
    const record = await api<SpeciesRecord>(speciesEditorId === null ? "/species" : `/species/${speciesEditorId}`, {
      method: speciesEditorId === null ? "POST" : "PUT",
      body: JSON.stringify({ ...speciesDraft, image: speciesDraft.image || null, feeding_cycle_h: speciesDraft.feeding_cycle_h ? Number(speciesDraft.feeding_cycle_h) : null, rest_cycle_h: speciesDraft.rest_cycle_h ? Number(speciesDraft.rest_cycle_h) : null }),
    });
    setSpeciesRecords((current) => speciesEditorId === null ? [...current, record] : current.map((item) => item.species_id === record.species_id ? record : item));
    setEditingSpecies(false);
  };
  const newSpecies = () => { setSpeciesEditorId(null); setSpeciesDraft({ code: "", scientific_name: "", image: "", feeding_cycle_h: "", rest_cycle_h: "" }); setEditingSpecies(true); };

  const loadPositions = useCallback(async () => {
    const records = await api<StimulationPosition[]>("/stimulation-positions");
    setPositions(records);
    setForm((current) => ({
      ...current,
      position_id:
        current.position_id && records.some(
          (item) => String(item.position_id) === current.position_id,
        )
          ? current.position_id
          : "",
      position_2_id:
        current.position_2_id && records.some(
          (item) => String(item.position_id) === current.position_2_id,
        )
          ? current.position_2_id
          : "",
    }));
    return records;
  }, []);

  const loadSubjectPositionCombinationStatistics = useCallback(async (experimentId: number) => {
    const records = await api<SubjectPositionCombinationStatistic[]>(
      `/statistics/subject-position-combinations?experiment_id=${experimentId}`,
    );
    setSubjectPositionCombinationStatistics(records);
    return records;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [deviceState, taskState] = await Promise.all([
        api<DeviceStatus>("/devices"),
        api<TaskState>("/trials/current"),
      ]);
      setDevices(deviceState);
      setTask(taskState);
      if (
        taskState.status === "COMPLETED" &&
        taskState.result &&
        taskState.result.trial_id === null
      ) {
        setPendingTrial((current) => current ?? taskState.result);
      }
      if (
        previousTaskStatus.current === "RUNNING" &&
        taskState.status !== "RUNNING"
      ) {
        if (taskState.status === "COMPLETED" && taskState.result) {
          setPendingTrial(taskState.result);
          setAnnotation({ latency: "", action: "", degree: "" });
        }
        await Promise.all([
          loadTrials(filterRef.current, managedExperimentRef.current),
          loadExperiments(),
          loadSubjects(),
          loadSpecies(),
          loadPositions(),
        ]);
        setNotice({
          kind: taskState.status === "COMPLETED" ? "success" : "error",
          text:
            taskState.status === "COMPLETED"
              ? "实验完成，请填写 RESPONSE ANNOTATION 后保存或丢弃。"
              : (taskState.result?.error_message ?? "实验失败。"),
        });
      }
      previousTaskStatus.current = taskState.status;
    } catch {
      setDevices(null);
    }
  }, [loadExperiments, loadPositions, loadSpecies, loadSubjects, loadTrials]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadExperiments()
        .then((records) => {
          const firstId = records[0]?.experiment_id ?? null;
          managedExperimentRef.current = firstId;
          setManagedExperimentId(firstId);
          if (records[0]) {
            setExperimentDraft({
              title: records[0].title,
              description: records[0].description ?? "",
            });
            void loadTrials("", firstId);
          }
        })
        .catch(() => {
          setExperiments([]);
          setTrials([]);
        });
      void loadSubjects().catch(() => setSubjects([]));
      void loadSpecies().catch(() => setSpeciesRecords([]));
      void loadPositions().catch(() => setPositions([]));
      void refresh();
      void api<Record<string, string | number>>("/config")
        .then((defaults) => {
          setForm((current) => ({
            ...current,
            ...(Object.fromEntries(
              Object.entries(defaults).map(([key, value]) => [
                key,
                String(value),
              ]),
            ) as DefaultConfig),
          }));
        })
        .catch(() =>
          setNotice({ kind: "error", text: "无法读取后端默认配置。" }),
        );
    }, 0);
    const timer = window.setInterval(() => void refresh(), 900);
    const previewTimer = window.setInterval(
      () => setPreviewTick((value) => value + 1),
      160,
    );
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.clearInterval(previewTimer);
    };
  }, [loadExperiments, loadPositions, loadSubjects, loadTrials, refresh]);

  useEffect(() => {
    const logWindow = logWindowRef.current;
    if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
  }, [task.logs.length]);

  const connect = async () => {
    setConnecting(true);
    setNotice(null);
    try {
      const state = await api<DeviceStatus>("/devices/connect", {
        method: "POST",
      });
      setDevices(state);
      setNotice({
        kind:
          state.sdg_connected && state.camera_connected ? "success" : "error",
        text:
          state.sdg_connected && state.camera_connected
            ? "所有硬件已连接。"
            : [
                !state.sdg_connected && `SDG1022X: ${state.sdg_error || "连接失败"}`,
                !state.camera_connected && `XIAO: ${state.camera_error || "连接失败"}`,
              ]
                .filter(Boolean)
                .join("；"),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "连接失败",
      });
    } finally {
      setConnecting(false);
    }
  };

  const selectManagedExperiment = async (experiment: Experiment) => {
    managedExperimentRef.current = experiment.experiment_id;
    setManagedExperimentId(experiment.experiment_id);
    setExperimentDraft({
      title: experiment.title,
      description: experiment.description ?? "",
    });
    setEditingExperiment(false);
    setSelected(null);
    setEditingId(null);
    setRowEdit(null);
    filterRef.current = "";
    setFilter("");
    try {
      await loadTrials("", experiment.experiment_id);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "无法读取 Trial",
      });
    }
  };

  const newExperiment = () => {
    setExperimentEditorId(null);
    setExperimentDraft({ title: "", description: "" });
    setEditingExperiment(true);
  };

  const saveExperiment = async () => {
    if (!experimentDraft.title.trim()) {
      setNotice({ kind: "error", text: "Experiment 标题不能为空。" });
      return;
    }
    setExperimentSaving(true);
    try {
      const record = await api<Experiment>(
        experimentEditorId === null
          ? "/experiments"
          : `/experiments/${experimentEditorId}`,
        {
          method: experimentEditorId === null ? "POST" : "PUT",
          body: JSON.stringify({
            title: experimentDraft.title.trim(),
            description: experimentDraft.description.trim() || null,
          }),
        },
      );
      await loadExperiments();
      await selectManagedExperiment(record);
      setEditingExperiment(false);
      if (!runExperimentId) setRunExperimentId(String(record.experiment_id));
      setNotice({
        kind: "success",
        text: `Experiment “${record.title}” 已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setExperimentSaving(false);
    }
  };

  const deleteExperiment = async () => {
    const experiment = experiments.find(
      (item) => item.experiment_id === managedExperimentId,
    );
    if (
      !experiment ||
      !window.confirm(`确定删除 Experiment “${experiment.title}”？`)
    )
      return;
    setExperimentDeleting(true);
    try {
      await api(`/experiments/${experiment.experiment_id}`, {
        method: "DELETE",
      });
      const records = await loadExperiments();
      const next =
        records.find(
          (item) => item.experiment_id !== experiment.experiment_id,
        ) ?? null;
      setRunExperimentId((current) =>
        current === String(experiment.experiment_id)
          ? next
            ? String(next.experiment_id)
            : ""
          : current,
      );
      if (next) await selectManagedExperiment(next);
      else newExperiment();
      setNotice({
        kind: "success",
        text: `Experiment “${experiment.title}” 已删除。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setExperimentDeleting(false);
    }
  };

  const newSubject = () => {
    setSubjectEditorId(null);
    setSubjectDraft({
      subject_id: "",
      body_length_cm: "",
      body_weight_g: "",
      body_width_cm: "",
      mandibular_length_cm: "",
      gender: "",
      species: "",
      time_since_last_experiment_h: "",
      notes: "",
    });
    setEditingSubject(true);
  };

  const editSubject = (subject: SubjectRecord) => {
    setSubjectEditorId(subject.subject_id);
    setSubjectDraft({
      subject_id: subject.subject_id,
      body_length_cm: subject.body_length_cm?.toString() ?? "",
      body_weight_g: subject.body_weight_g?.toString() ?? "",
      body_width_cm: subject.body_width_cm?.toString() ?? "",
      mandibular_length_cm: subject.mandibular_length_cm?.toString() ?? "",
      gender: subject.gender ?? "",
      species: subject.species ?? "",
      time_since_last_experiment_h:
        subject.time_since_last_experiment_h?.toString() ?? "",
      notes: subject.notes ?? "",
    });
    setEditingSubject(true);
  };

  const saveSubject = async () => {
    if (!subjectDraft.subject_id.trim()) {
      setNotice({ kind: "error", text: "Subject ID 不能为空。" });
      return;
    }
    setSubjectSaving(true);
    try {
      const record = await api<SubjectRecord>(
        subjectEditorId === null
          ? "/subjects"
          : `/subjects/${encodeURIComponent(subjectEditorId)}`,
        {
          method: subjectEditorId === null ? "POST" : "PUT",
          body: JSON.stringify({
            subject_id: subjectDraft.subject_id.trim(),
            body_length_cm: numberOrNull(subjectDraft.body_length_cm),
            body_weight_g: numberOrNull(subjectDraft.body_weight_g),
            body_width_cm: numberOrNull(subjectDraft.body_width_cm),
            mandibular_length_cm: numberOrNull(
              subjectDraft.mandibular_length_cm,
            ),
            gender: subjectDraft.gender.trim() || null,
            species: subjectDraft.species.trim() || null,
            time_since_last_experiment_h: numberOrNull(
              subjectDraft.time_since_last_experiment_h,
            ),
            notes: subjectDraft.notes.trim() || null,
          }),
        },
      );
      await loadSubjects();
      setEditingSubject(false);
      if (form.subject_id === subjectEditorId)
        setField("subject_id", record.subject_id);
      setNotice({
        kind: "success",
        text: `Subject “${record.subject_id}” 已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSubjectSaving(false);
    }
  };

  const deleteSubject = async (subject: SubjectRecord) => {
    if (!window.confirm(`确定删除 Subject “${subject.subject_id}”？`)) return;
    setSubjectDeleting(subject.subject_id);
    try {
      await api(`/subjects/${encodeURIComponent(subject.subject_id)}`, {
        method: "DELETE",
      });
      await loadSubjects();
      setNotice({
        kind: "success",
        text: `Subject “${subject.subject_id}” 已删除。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setSubjectDeleting(null);
    }
  };

  const newPosition = () => {
    setPositionEditorId(null);
    setPositionDraft({ code: "", description: "", image: "", mark: null, species: "" });
    setEditingPosition(true);
  };

  const editPosition = (position: StimulationPosition) => {
    setPositionEditorId(position.position_id);
    setPositionDraft({
      code: position.code,
      description: position.description ?? "",
      image: position.image ?? "",
      mark: position.mark,
      species: position.species ?? "",
    });
    setEditingPosition(true);
  };

  const savePosition = async () => {
    if (!positionDraft.code.trim()) {
      setNotice({ kind: "error", text: "Position code 不能为空。" });
      return;
    }
    setPositionSaving(true);
    try {
      const record = await api<StimulationPosition>(
        positionEditorId === null
          ? "/stimulation-positions"
          : `/stimulation-positions/${positionEditorId}`,
        {
          method: positionEditorId === null ? "POST" : "PUT",
          body: JSON.stringify({
            code: positionDraft.code.trim(),
            description: positionDraft.description.trim() || null,
            image: positionDraft.image || null,
            mark: positionDraft.mark,
            species: positionDraft.species.trim() || null,
          }),
        },
      );
      await loadPositions();
      setEditingPosition(false);
      setField("position_id", String(record.position_id));
      setSelectedPositionImageId(record.image_id);
      setNotice({ kind: "success", text: `Position “${record.code}” 已保存。` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setPositionSaving(false);
    }
  };

  const deletePosition = async (position: StimulationPosition) => {
    if (!window.confirm(`确定删除 Position “${position.code}”？`)) return;
    setPositionDeleting(position.position_id);
    try {
      await api(`/stimulation-positions/${position.position_id}`, {
        method: "DELETE",
      });
      await loadPositions();
      setNotice({ kind: "success", text: `Position “${position.code}” 已删除。` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setPositionDeleting(null);
    }
  };

  const readPositionImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) {
      setNotice({ kind: "error", text: "请选择 PNG、JPEG、WebP 或 GIF 图片。" });
      return;
    }
    if (file.size > 2_000_000) {
      setNotice({ kind: "error", text: "Position 图片不能超过 2 MB。" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setPositionDraft((current) => ({
        ...current,
        image: typeof reader.result === "string" ? reader.result : "",
        mark: null,
      }));
    reader.readAsDataURL(file);
  };

  const startTrial = async () => {
    setNotice(null);
    if (
      !runExperimentId ||
      !form.subject_id.trim() ||
      !form.position_id ||
      !form.position_2_id ||
      form.position_id === form.position_2_id ||
      !runPositionPreview
    ) {
      setNotice({
        kind: "error",
        text: "请选择同一张图片上两个不同且已设置 mark 的 Stimulation Position。",
      });
      return;
    }
    try {
      setPendingTrial(null);
      setSelected(null);
      await api("/trials", {
        method: "POST",
        body: JSON.stringify({
          experiment_id: Number(runExperimentId),
          subject_id: form.subject_id,
          body_length_cm: numberOrNull(form.body_length_cm),
          body_weight_g: numberOrNull(form.body_weight_g),
          waveform: form.waveform,
          high_level_v: Number(form.high_level_v),
          low_level_v: Number(form.low_level_v),
          duty_cycle_pct: Number(form.duty_cycle_pct),
          frequency_hz: Number(form.frequency_hz),
          duration_s: Number(form.duration_s),
          count: Number(form.count),
          interval_s: Number(form.interval_s),
          position_id: Number(form.position_id),
          position_2_id: Number(form.position_2_id),
          baseline_duration_s: Number(form.baseline_duration_s),
          post_stim_duration_s: Number(form.post_stim_duration_s),
        }),
      });
      previousTaskStatus.current = "RUNNING";
      setTask((current) => ({ ...current, status: "RUNNING", result: null }));
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "无法开始实验",
      });
    }
  };

  const lookupSubject = async (subjectId = form.subject_id) => {
    if (!subjectId.trim()) return;
    try {
      const subject = await api<{
        body_length_cm: number | null;
        body_weight_g: number | null;
      }>(`/subjects/${encodeURIComponent(subjectId.trim())}`);
      setForm((current) => ({
        ...current,
        subject_id: subjectId,
        body_length_cm: subject.body_length_cm?.toString() ?? "",
        body_weight_g: subject.body_weight_g?.toString() ?? "",
      }));
    } catch {
      // A new subject is expected to return 404; retain the user's fields.
    }
  };

  const chooseTrial = (trial: Trial) => {
    setSelected(trial);
    setAnnotation({
      latency: trial.response_latency_s?.toString() ?? "",
      action: trial.response_action ?? "",
      degree: trial.response_degree?.toString() ?? "",
    });
  };

  const beginRowEdit = (trial: Trial) => {
    setEditingId(trial.trial_id);
    setRowEdit({
      subject_id: trial.subject_id,
      trial_no: String(trial.trial_no),
      experiment_timestamp: trial.experiment_timestamp ?? "",
      stimulation_position_id: trial.stimulation_position_id?.toString() ?? "",
      stimulation_position_2_id:
        trial.stimulation_position_2_id?.toString() ?? "",
      stimulation_waveform: trial.stimulation_waveform ?? "SQUARE",
      stimulation_high_level_v: String(
        trial.stimulation_high_level_v ?? trial.stimulation_voltage_v,
      ),
      stimulation_low_level_v: String(trial.stimulation_low_level_v ?? 0),
      stimulation_duty_cycle_pct: String(
        trial.stimulation_duty_cycle_pct ?? 50,
      ),
      stimulation_frequency_hz: String(trial.stimulation_frequency_hz),
      response_latency_s: trial.response_latency_s?.toString() ?? "",
      response_action: trial.response_action ?? "",
      response_degree: trial.response_degree?.toString() ?? "",
      status: trial.status,
    });
  };

  const setRowField = (key: keyof RowEdit, value: string) => {
    setRowEdit((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveRowEdit = async () => {
    if (editingId === null || !rowEdit) return;
    setRowSaving(true);
    try {
      await api(`/trials/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...rowEdit,
          trial_no: Number(rowEdit.trial_no),
          stimulation_position_id: Number(rowEdit.stimulation_position_id),
          stimulation_position_2_id: Number(
            rowEdit.stimulation_position_2_id,
          ),
          stimulation_high_level_v: Number(rowEdit.stimulation_high_level_v),
          stimulation_low_level_v: Number(rowEdit.stimulation_low_level_v),
          stimulation_duty_cycle_pct: Number(
            rowEdit.stimulation_duty_cycle_pct,
          ),
          stimulation_frequency_hz: Number(rowEdit.stimulation_frequency_hz),
          response_latency_s: numberOrNull(rowEdit.response_latency_s),
          response_action: rowEdit.response_action.trim() || null,
          response_degree: numberOrNull(rowEdit.response_degree),
        }),
      });
      await Promise.all([
        loadTrials(filterRef.current, managedExperimentRef.current),
        loadExperiments(),
        loadSubjects(),
        loadPositions(),
      ]);
      if (selected?.trial_id === editingId) setSelected(null);
      setEditingId(null);
      setRowEdit(null);
      setNotice({ kind: "success", text: `Trial #${editingId} 已更新。` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "更新失败",
      });
    } finally {
      setRowSaving(false);
    }
  };

  const deleteRow = async (trial: Trial) => {
    if (!window.confirm(`确定删除 Trial #${trial.trial_id}？录像文件将保留。`))
      return;
    setDeletingId(trial.trial_id);
    try {
      await api(`/trials/${trial.trial_id}`, { method: "DELETE" });
      if (selected?.trial_id === trial.trial_id) setSelected(null);
      if (editingId === trial.trial_id) {
        setEditingId(null);
        setRowEdit(null);
      }
      await Promise.all([
        loadTrials(filterRef.current, managedExperimentRef.current),
        loadExperiments(),
        loadSubjects(),
        loadPositions(),
      ]);
      setNotice({
        kind: "success",
        text: `Trial #${trial.trial_id} 已删除，录像文件已保留。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const saveAnnotation = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/trials/${selected.trial_id}/annotation`, {
        method: "PATCH",
        body: JSON.stringify({
          response_latency_s: numberOrNull(annotation.latency),
          response_action: annotation.action.trim() || null,
          response_degree: numberOrNull(annotation.degree),
        }),
      });
      await loadTrials(filterRef.current, managedExperimentRef.current);
      setNotice({
        kind: "success",
        text: `Trial #${selected.trial_id} 标注已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePendingTrial = async () => {
    if (!pendingTrial) return;
    setSaving(true);
    try {
      await api("/trials/current/commit", {
        method: "POST",
        body: JSON.stringify({
          response_latency_s: numberOrNull(annotation.latency),
          response_action: annotation.action.trim() || null,
          response_degree: numberOrNull(annotation.degree),
        }),
      });
      setPendingTrial(null);
      setTask((current) => ({ ...current, status: "IDLE" }));
      await Promise.all([
        loadTrials(filterRef.current, managedExperimentRef.current),
        loadExperiments(),
        loadSubjects(),
        loadPositions(),
      ]);
      setNotice({ kind: "success", text: "Trial 标注已保存到数据库。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const discardPendingTrial = async () => {
    if (!pendingTrial || !window.confirm("丢弃本次 Trial？录像也会被删除。"))
      return;
    setSaving(true);
    try {
      await api("/trials/current/discard", { method: "POST" });
      setPendingTrial(null);
      setTask((current) => ({ ...current, status: "IDLE", result: null }));
      setNotice({ kind: "success", text: "本次 Trial 已丢弃。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "丢弃失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (filterRef.current.trim())
        params.set("subject_id", filterRef.current.trim());
      if (managedExperimentRef.current !== null)
        params.set("experiment_id", String(managedExperimentRef.current));
      const query = params.size ? `?${params.toString()}` : "";
      const response = await fetch(`/backend/trials/export${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`CSV 导出失败 (${response.status})`);
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? "exp-recorder.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ kind: "success", text: "CSV 已导出。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "CSV 导出失败",
      });
    } finally {
      setExporting(false);
    }
  };

  const clearData = async () => {
    const confirmed = window.confirm(
      "确定清空所有 Experiment、Trial 和 Subject 数据吗？此操作无法撤销。data/videos/ 中的视频文件会保留。",
    );
    if (!confirmed) return;
    setClearing(true);
    setNotice(null);
    try {
      const result = await api<{
        trials_deleted: number;
        subjects_deleted: number;
        experiments_deleted: number;
      }>("/data", {
        method: "DELETE",
      });
      setTrials([]);
      setExperiments([]);
      setRunExperimentId("");
      setManagedExperimentId(null);
      managedExperimentRef.current = null;
      setSelected(null);
      setTask({ task_id: null, status: "IDLE", result: null, logs: [] });
      previousTaskStatus.current = "IDLE";
      setNotice({
        kind: "success",
        text: `已清空 ${result.experiments_deleted} 个 Experiment、${result.trials_deleted} 条 Trial 和 ${result.subjects_deleted} 个 Subject；视频文件已保留。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "清空失败",
      });
    } finally {
      setClearing(false);
    }
  };

  const setField = (key: keyof TrialForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const ready = Boolean(devices?.sdg_connected && devices?.camera_connected);
  const running = task.status === "RUNNING";
  const managedExperiment =
    experiments.find((item) => item.experiment_id === managedExperimentId) ??
    null;
  const normalizedExperimentQuery = experimentQuery.trim().toLowerCase();
  const visibleExperiments = normalizedExperimentQuery
    ? experiments.filter((experiment) =>
        `${experiment.experiment_id} ${experiment.title} ${experiment.description ?? ""}`
          .toLowerCase()
          .includes(normalizedExperimentQuery),
      )
    : experiments;
  const normalizedSubjectQuery = subjectQuery.trim().toLowerCase();
  const visibleSubjects = normalizedSubjectQuery
    ? subjects.filter((subject) =>
        `${subject.subject_id} ${subject.notes ?? ""}`
          .toLowerCase()
          .includes(normalizedSubjectQuery),
      )
    : subjects;
  const normalizedPositionQuery = positionQuery.trim().toLowerCase();
  const visiblePositions = normalizedPositionQuery
    ? positions.filter((position) =>
        `${position.code} ${position.description ?? ""}`
          .toLowerCase()
          .includes(normalizedPositionQuery),
      )
    : positions;
  const statisticSubjects = Array.from(
    new Set(
      subjectPositionCombinationStatistics.map((item) => item.subject_id),
    ),
  );
  const statisticPositionCombinations = Array.from(
    new Set(
      subjectPositionCombinationStatistics.map(
        (item) => item.position_combination,
      ),
    ),
  );
  const statisticMaximum = Math.max(
    1,
    ...subjectPositionCombinationStatistics.map((item) => item.trial_count),
  );
  const positionImages = positions.filter(
    (position, index, records) =>
      position.image_id !== null &&
      records.findIndex((item) => item.image_id === position.image_id) === index,
  );
  const speciesImageOptions = speciesRecords.filter(
    (species) => species.image && (!positionDraft.species || species.code === positionDraft.species),
  );
  const activePositionImage =
    positionImages.find(
      (position) => position.image_id === selectedPositionImageId,
    ) ?? positionImages[0] ?? null;
  const runPositionOne = positions.find(
    (position) => String(position.position_id) === form.position_id,
  );
  const selectedSubjectSpecies = subjects.find(
    (subject) => subject.subject_id === form.subject_id,
  )?.species;
  const runPositions = positions.filter(
    (position) => !position.species || position.species === selectedSubjectSpecies,
  );
  const runPositionTwo = positions.find(
    (position) => String(position.position_id) === form.position_2_id,
  );
  const runPositionPreview =
    runPositionOne?.image_id !== null &&
    runPositionOne?.image_id === runPositionTwo?.image_id
      ? runPositionOne
      : null;
  return (
    <AppShell
      workspace={view}
      manageSection={manageTab}
      onManageSectionChange={(section) => {
        setView("manage");
        // Species are currently maintained as the species field on Subjects.
        if (section === "statistics") {
          const experimentId = managedExperimentId ?? experiments[0]?.experiment_id ?? null;
          setStatisticsExperimentId(experimentId);
          if (experimentId) void loadSubjectPositionCombinationStatistics(experimentId).catch(() => setSubjectPositionCombinationStatistics([]));
        }
        setManageTab((section === "species" ? "subjects" : section) as typeof manageTab);
      }}
      onWorkspaceChange={(workspace) => {
        setView(workspace);
        if (workspace === "execute") setSelected(null);
      }}
      status={
        <div className="grid gap-2">
          <Badge tone={ready ? "success" : "neutral"}>
            {devices
              ? ready
                ? "SYSTEM READY"
                : "HARDWARE OFFLINE"
              : "API OFFLINE"}
          </Badge>
          <p className="text-xs leading-5 text-zinc-500">
            SQLite · SCPI · USB Serial
          </p>
        </div>
      }
    >
      {view === "execute" ? (
        <section className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 xl:flex-row xl:items-end xl:justify-between xl:px-5">
          <div className="flex items-end gap-x-6 gap-y-3">
            <div>
              <p className="mb-1 text-sm font-medium uppercase">
                Hardware status
              </p>
              <div className="flex py-3 gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <StatusDot active={Boolean(devices?.sdg_connected)} />
                  <span>SDG1022X</span>
                  <Badge tone={devices?.sdg_connected ? "success" : "neutral"}>
                    {devices?.sdg_connected ? "ONLINE" : "OFFLINE"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <StatusDot active={Boolean(devices?.camera_connected)} />
                  <span>XIAO ESP32S3</span>
                  <Badge
                    tone={devices?.camera_connected ? "success" : "neutral"}
                  >
                    {devices?.camera_connected ? "ONLINE" : "OFFLINE"}
                  </Badge>
                </div>
              </div>
            </div>

            {devices?.mock && <Badge tone="warning">SIMULATION MODE</Badge>}
            <Field label="EXPERIMENT" className="min-w-50 flex-1 sm:flex-none">
              <Select
                value={runExperimentId}
                onChange={(event) => setRunExperimentId(event.target.value)}
                disabled={running}
                required
              >
                <option value="">Select an experiment…</option>
                {experiments.map((experiment) => (
                  <option
                    key={experiment.experiment_id}
                    value={experiment.experiment_id}
                  >
                    {experiment.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="SUBJECT" className="max-w-50 flex-1 sm:flex-none">
              <Select
                value={form.subject_id}
                onChange={(event) => {
                  const subjectId = event.target.value;
                  setField("subject_id", subjectId);
                  const selectedSubject = subjects.find((subject) => subject.subject_id === subjectId);
                  if (selectedSubject && selectedSubject.status !== "正常") {
                    setNotice({ kind: "error", text: `警告：${selectedSubject.subject_id} 当前状态为${selectedSubject.status}。` });
                  }
                  void lookupSubject(subjectId);
                }}
                disabled={running}
                required
              >
                <option value="">Select a subject…</option>
                {subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_id}
                    {subject.species ? ` · ${subject.species}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              onClick={connect}
              disabled={connecting || running}
            >
              <ArrowPathIcon className="size-4" />
              {connecting ? "连接中…" : "重新连接"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfigurationOpen(true)}
              disabled={running}
            >
              <Cog6ToothIcon className="size-4" />
              配置
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex w-full flex-col gap-3 sm:flex-row">
          {/* Management sections are selected from the sidebar. */}
          <div className="hidden">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${manageTab === "experiments" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
              onClick={() => setManageTab("experiments")}
            >
              Experiments
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${manageTab === "subjects" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
              onClick={() => setManageTab("subjects")}
            >
              Subjects
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${manageTab === "positions" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
              onClick={() => setManageTab("positions")}
            >
              Positions
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${manageTab === "statistics" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
              onClick={() => {
                setManageTab("statistics");
                const experimentId = managedExperimentId ?? experiments[0]?.experiment_id ?? null;
                setStatisticsExperimentId(experimentId);
                if (experimentId === null) {
                  setSubjectPositionCombinationStatistics([]);
                } else {
                  void loadSubjectPositionCombinationStatistics(experimentId).catch(() =>
                    setSubjectPositionCombinationStatistics([]),
                  );
                }
              }}
            >
              Statistics
            </button>
          </div>
          {manageTab !== "statistics" && (
            <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="search"
              value={
                manageTab === "experiments"
                  ? experimentQuery
                  : manageTab === "subjects"
                    ? subjectQuery
                    : positionQuery
              }
              onChange={(event) =>
                manageTab === "experiments"
                  ? setExperimentQuery(event.target.value)
                  : manageTab === "subjects"
                    ? setSubjectQuery(event.target.value)
                    : setPositionQuery(event.target.value)
              }
              placeholder={
                manageTab === "experiments"
                  ? "搜索 Experiment 标题、描述或 ID…"
                  : manageTab === "subjects"
                    ? "搜索 Subject ID 或备注…"
                    : "搜索 Position code 或描述…"
              }
              className="pl-10"
            />
            </div>
          )}
          {manageTab !== "statistics" && (
            <Button
            onClick={
              manageTab === "experiments"
                ? newExperiment
                : manageTab === "subjects"
                  ? newSubject
                  : manageTab === "positions"
                    ? newPosition
                    : newSpecies
            }
            className="shrink-0"
          >
            <PlusIcon className="size-4" />
            {manageTab === "experiments"
              ? "新建 Experiment"
              : manageTab === "subjects"
              ? "新建 Subject"
                : manageTab === "positions" ? "新建 Position" : "新建 Species"}
            </Button>
          )}
        </section>
      )}

      {notice && (
        <div className="mt-5">
          <Alert tone={notice.kind === "success" ? "success" : "danger"}>
            <div className="flex items-center justify-between gap-5">
              <span>{notice.text}</span>
              <button
                type="button"
                className="font-semibold"
                onClick={() => setNotice(null)}
              >
                ×
              </button>
            </div>
          </Alert>
        </div>
      )}

      <Dialog
        open={editingExperiment}
        title={
          experimentEditorId === null ? "New Experiment" : "Edit Experiment"
        }
        closeLabel="关闭"
        onClose={() => setEditingExperiment(false)}
      >
        <div className="grid gap-5">
          <Field label="TITLE">
            <Input
              value={experimentDraft.title}
              onChange={(event) =>
                setExperimentDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Experiment title"
              autoFocus
            />
          </Field>
          <Field
            label="DESCRIPTION"
            hint="可选：记录实验目的、批次或协议说明。"
          >
            <Textarea
              value={experimentDraft.description}
              onChange={(event) =>
                setExperimentDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Purpose, cohort, protocol notes…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditingExperiment(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => void saveExperiment()}
              disabled={experimentSaving}
            >
              {experimentSaving ? "保存中…" : "保存 Experiment"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={editingSubject}
        title={subjectEditorId === null ? "New Subject" : "Edit Subject"}
        closeLabel="关闭"
        onClose={() => setEditingSubject(false)}
      >
        <div className="grid gap-5">
          <Field label="SUBJECT ID">
            <Input
              value={subjectDraft.subject_id}
              onChange={(event) =>
                setSubjectDraft((current) => ({
                  ...current,
                  subject_id: event.target.value,
                }))
              }
              placeholder="Subject ID"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="BODY LENGTH (cm)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.body_length_cm}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    body_length_cm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="BODY WEIGHT (g)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.body_weight_g}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    body_weight_g: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="BODY WIDTH (cm)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.body_width_cm}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    body_width_cm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="MANDIBULAR LENGTH (cm)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.mandibular_length_cm}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    mandibular_length_cm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="GENDER">
              <Input
                value={subjectDraft.gender}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    gender: event.target.value,
                  }))
                }
                placeholder="e.g. Female"
              />
            </Field>
            <Field label="SPECIES">
              <Select
                value={subjectDraft.species}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    species: event.target.value,
                  }))
                }
              >
                <option value="">选择已注册物种…</option>
                {speciesRecords.map((species) => (
                  <option key={species.species_id} value={species.code}>
                    {species.code} · {species.scientific_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="TIME SINCE LAST EXPERIMENT (h)"
              className="sm:col-span-2"
            >
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.time_since_last_experiment_h}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    time_since_last_experiment_h: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label="NOTES" hint="可选：记录样本批次、状态或其他说明。">
            <Textarea
              value={subjectDraft.notes}
              onChange={(event) =>
                setSubjectDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Subject notes…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditingSubject(false)}
            >
              取消
            </Button>
            <Button onClick={() => void saveSubject()} disabled={subjectSaving}>
              {subjectSaving ? "保存中…" : "保存 Subject"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={editingPosition}
        title={positionEditorId === null ? "New Position" : "Edit Position"}
        closeLabel="关闭"
        onClose={() => setEditingPosition(false)}
      >
        <div className="grid gap-5">
          <Field label="CODE" hint="例如 A1；只能使用字母、数字、下划线和连字符。">
            <Input
              value={positionDraft.code}
              onChange={(event) =>
                setPositionDraft((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="A1"
              autoFocus
            />
          </Field>
          <Field label="DESCRIPTION">
            <Textarea
              value={positionDraft.description}
              onChange={(event) =>
                setPositionDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="位置说明、解剖标记或操作备注…"
            />
          </Field>
          <Field label="SPECIES" hint="该位置及照片仅用于对应物种；留空表示通用。">
            <Select
              value={positionDraft.species}
              onChange={(event) =>
                setPositionDraft((current) => ({
                  ...current,
                  species: event.target.value,
                  image: speciesRecords.find((species) => species.code === event.target.value)?.image ?? "",
                  mark: null,
                }))
              }
            >
              <option value="">通用位置</option>
              {Array.from(new Set(subjects.map((subject) => subject.species).filter(Boolean) as string[])).map((species) => (
                <option key={species} value={species}>{species}</option>
              ))}
            </Select>
          </Field>
          <Field label="IMAGE" hint="图片由所选 Species 自动提供。" className="hidden">
            {speciesImageOptions.length > 0 && (
              <Select
                value={speciesImageOptions.find((species) => species.image === positionDraft.image)?.species_id?.toString() ?? ""}
                onChange={(event) => {
                  const selectedImage = speciesImageOptions.find((species) => String(species.species_id) === event.target.value);
                  setPositionDraft((current) => ({
                    ...current,
                    image: selectedImage?.image ?? "",
                    mark: null,
                  }));
                }}
              >
                <option value="">选择物种图片…</option>
                {speciesImageOptions.map((species) => (
                  <option key={species.species_id} value={species.species_id}>
                    {species.code} · {species.scientific_name}
                  </option>
                ))}
              </Select>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => readPositionImage(event.target.files?.[0])}
            />
          </Field>
          {positionDraft.image && (
            <div className="grid gap-3">
              <p className="text-xs text-zinc-500">点击图片设置 mark。</p>
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl border border-zinc-200">
                <img
                  src={positionDraft.image}
                  alt="Position preview"
                  className="block max-h-64 max-w-full cursor-crosshair"
                  onClick={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    setPositionDraft((current) => ({
                      ...current,
                      mark: {
                        x: (event.clientX - bounds.left) / bounds.width,
                        y: (event.clientY - bounds.top) / bounds.height,
                      },
                    }));
                  }}
                />
                {positionDraft.mark && (
                  <span
                    className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                    style={{
                      left: `${positionDraft.mark.x * 100}%`,
                      top: `${positionDraft.mark.y * 100}%`,
                    }}
                  />
                )}
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setPositionDraft((current) => ({
                    ...current,
                    image: "",
                    mark: null,
                  }))
                }
              >
                移除图片
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingPosition(false)}>
              取消
            </Button>
            <Button onClick={() => void savePosition()} disabled={positionSaving}>
              {positionSaving ? "保存中…" : "保存 Position"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={editingSpecies} title={speciesEditorId === null ? "New Species" : "Edit Species"} closeLabel="关闭" onClose={() => setEditingSpecies(false)}>
        <div className="grid gap-4">
          <Field label="CODE"><Input value={speciesDraft.code} onChange={(event) => setSpeciesDraft((current) => ({ ...current, code: event.target.value }))} /></Field>
          <Field label="SCIENTIFIC NAME"><Input value={speciesDraft.scientific_name} onChange={(event) => setSpeciesDraft((current) => ({ ...current, scientific_name: event.target.value }))} /></Field>
          <Field label="FEEDING CYCLE (h)"><Input type="number" min="0" value={speciesDraft.feeding_cycle_h} onChange={(event) => setSpeciesDraft((current) => ({ ...current, feeding_cycle_h: event.target.value }))} /></Field>
          <Field label="REST CYCLE (h)"><Input type="number" min="0" value={speciesDraft.rest_cycle_h} onChange={(event) => setSpeciesDraft((current) => ({ ...current, rest_cycle_h: event.target.value }))} /></Field>
          <Field label="IMAGE"><Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setSpeciesDraft((current) => ({ ...current, image: typeof reader.result === "string" ? reader.result : "" })); reader.readAsDataURL(file); }} /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingSpecies(false)}>取消</Button><Button onClick={() => void saveSpecies()}>保存 Species</Button></div>
        </div>
      </Dialog>

      <Dialog
        open={configurationOpen}
        title="Trial 参数配置"
        closeLabel="关闭"
        onClose={() => setConfigurationOpen(false)}
      >
        <div className="grid gap-6">
          <section>
            <h3 className="mb-4 text-sm font-semibold">STIMULUS</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="WAVEFORM">
                <Select
                  value={form.waveform}
                  onChange={(event) => setField("waveform", event.target.value)}
                >
                  <option value="SQUARE">Square</option>
                  <option value="PULSE">Pulse</option>
                  <option value="SINE">Sine</option>
                  <option value="RAMP">Ramp</option>
                </Select>
              </Field>
              <Field label="FREQUENCY (Hz)">
                <Input
                  type="number"
                  step="any"
                  min="0.001"
                  value={form.frequency_hz}
                  onChange={(event) =>
                    setField("frequency_hz", event.target.value)
                  }
                />
              </Field>
              <Field label="HIGH LEVEL (V)">
                <Input
                  type="number"
                  step="any"
                  value={form.high_level_v}
                  onChange={(event) =>
                    setField("high_level_v", event.target.value)
                  }
                />
              </Field>
              <Field label="LOW LEVEL (V)">
                <Input
                  type="number"
                  step="any"
                  value={form.low_level_v}
                  onChange={(event) =>
                    setField("low_level_v", event.target.value)
                  }
                />
              </Field>
              <Field label="DUTY CYCLE (%)">
                <Input
                  type="number"
                  step="any"
                  min="0.1"
                  max="99.9"
                  value={form.duty_cycle_pct}
                  onChange={(event) =>
                    setField("duty_cycle_pct", event.target.value)
                  }
                />
              </Field>
              <Field label="DURATION (s)">
                <Input
                  type="number"
                  step="any"
                  min="0.001"
                  value={form.duration_s}
                  onChange={(event) =>
                    setField("duration_s", event.target.value)
                  }
                />
              </Field>
              <Field label="COUNT">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.count}
                  onChange={(event) => setField("count", event.target.value)}
                />
              </Field>
              <Field label="INTERVAL (s)">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.interval_s}
                  onChange={(event) =>
                    setField("interval_s", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>
          <section className="border-t border-zinc-200 pt-5">
            <h3 className="mb-4 text-sm font-semibold">RECORDING WINDOW</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="BASELINE (s)">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.baseline_duration_s}
                  onChange={(event) =>
                    setField("baseline_duration_s", event.target.value)
                  }
                />
              </Field>
              <Field label="POST-STIM (s)">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.post_stim_duration_s}
                  onChange={(event) =>
                    setField("post_stim_duration_s", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>
          <div className="flex justify-end">
            <Button onClick={() => setConfigurationOpen(false)}>完成</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={selected !== null}
        title={
          selected
            ? `Playback · ${selected.subject_id} · Trial ${selected.trial_no}`
            : "Playback"
        }
        closeLabel="关闭 Playback"
        onClose={() => setSelected(null)}
        size="wide"
      >
        {selected && (
          <div className="playback-window-grid">
            <section>
              <span className="playback-window-label">
                STIMULATION POSITION · {selected.stimulation_position}
              </span>
              <TrialPositionPreview
                trial={selected}
                positions={positions}
                showDetails
              />
            </section>
            <section>
              <span className="playback-window-label">VIDEO PLAYBACK</span>
              <video
                key={selected.trial_id}
                controls
                preload="metadata"
                src={`/backend/trials/${selected.trial_id}/video`}
              />
            </section>
          </div>
        )}
      </Dialog>

      <section
        className={`dashboard-grid ${view === "execute" ? "execute-layout" : "manage-layout"} ${view === "manage" && manageTab === "statistics" ? "single-column-manage-layout" : ""}`}
      >
        <aside className="left-column">
          {view === "execute" ? (
            <>
              {pendingTrial && (
                <div className="">
                  <div className="annotation-title">
                    <div>
                      <h3>
                        {pendingTrial.subject_id} · Trial{" "}
                        {pendingTrial.trial_no}
                      </h3>
                    </div>
                  </div>
                  <div className="annotation-fields">
                    <label className="field">
                      <span>
                        LATENCY <em>s</em>
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={annotation.latency}
                        onChange={(e) =>
                          setAnnotation({
                            ...annotation,
                            latency: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field action-field">
                      <span>ACTION CODE</span>
                      <select
                        value={annotation.action}
                        onChange={(e) =>
                          setAnnotation({
                            ...annotation,
                            action: e.target.value,
                          })
                        }
                      >
                        <option value="">Not tagged</option>
                        {responseActions.map((action) => (
                          <option key={action.code} value={action.code}>
                            {action.code} · {action.zh} / {action.en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>DEGREE</span>
                      <select
                        value={annotation.degree}
                        onChange={(e) =>
                          setAnnotation({
                            ...annotation,
                            degree: e.target.value,
                          })
                        }
                      >
                        <option value="">Not tagged</option>
                        {responseDegrees.map((degree) => (
                          <option key={degree.score} value={degree.score}>
                            {degree.score} · {degree.level}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
              <section className="panel camera-panel">
                <div className="camera-heading">
                  <div className="section-heading">
                    <span>LIVE</span>
                    <h2>
                      {pendingTrial
                        ? "Annotation video"
                        : running
                          ? "Recording monitor"
                          : "Camera preview"}
                    </h2>
                  </div>
                  <div
                    className={`camera-mode ${pendingTrial ? "playback" : running ? "recording" : "idle"}`}
                  >
                    <i />
                    {pendingTrial
                      ? "PLAYBACK"
                      : running
                        ? "REC"
                        : "IDLE · LIVE"}
                  </div>
                  <div className="camera-tools">
                    <button
                      type="button"
                      className={cameraMirrored ? "active" : ""}
                      onClick={() => setCameraMirrored((value) => !value)}
                      title="水平镜像"
                    >
                      镜像
                    </button>
                    <button
                      type="button"
                      className={cameraFlipped ? "active" : ""}
                      onClick={() => setCameraFlipped((value) => !value)}
                      title="顺时针旋转 90 度"
                    >
                      旋转90°
                    </button>
                  </div>
                </div>
                {pendingTrial ? (
                  <div className="playback-pair">
                    <div className="playback-position-pane">
                      <span className="playback-pane-label">
                        STIMULATION POSITION ·{" "}
                        {pendingTrial.stimulation_position}
                      </span>
                      <TrialPositionPreview
                        trial={pendingTrial}
                        positions={positions}
                      />
                    </div>
                    <div className="playback-video-pane">
                      <span className="playback-pane-label">VIDEO PLAYBACK</span>
                      <video
                        key={pendingTrial.video_id}
                        style={{
                          transform: `${cameraMirrored ? "scaleX(-1) " : ""}${cameraFlipped ? "rotate(90deg)" : ""}`.trim() || "none",
                        }}
                        controls
                        preload="metadata"
                        src="/backend/pending-trial/video"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="camera-viewport">
                    {devices?.camera_connected && !devices.mock ? (
                      <img
                        src={`/backend/camera/frame?t=${previewTick}`}
                        alt={running ? "实验录像实时画面" : "摄像机空闲实时预览"}
                        style={{
                          transform: `${cameraMirrored ? "scaleX(-1) " : ""}${cameraFlipped ? "rotate(90deg)" : ""}`.trim() || "none",
                        }}
                      />
                    ) : (
                      <div className="camera-empty">
                        <span>◉</span>
                        <p>
                          {devices?.mock ? "SIMULATION MODE" : "CAMERA OFFLINE"}
                        </p>
                        <small>
                          {devices?.mock
                            ? "真实设备连接后显示实时画面"
                            : "连接 XIAO ESP32S3 后显示实时画面"}
                        </small>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          ) : manageTab === "experiments" ? (
            <>
              <section className="panel experiment-index-panel">
                <div className="experiment-index-heading">
                  <div className="section-heading">
                    <h2>Experiments</h2>
                  </div>
                </div>
                <div className="experiment-list">
                  {visibleExperiments.map((experiment) => (
                    <button
                      type="button"
                      key={experiment.experiment_id}
                      className={
                        managedExperimentId === experiment.experiment_id
                          ? "active"
                          : ""
                      }
                      onClick={() => void selectManagedExperiment(experiment)}
                    >
                      <span className="experiment-number">
                        E{String(experiment.experiment_id).padStart(3, "0")}
                      </span>
                      <strong>{experiment.title}</strong>
                      <small>{experiment.trial_count} trials</small>
                    </button>
                  ))}
                  {visibleExperiments.length === 0 && (
                    <div className="empty-experiments">
                      {experiments.length === 0 ? (
                        <>
                          还没有 Experiment
                          <br />
                          点击顶部按钮创建第一个。
                        </>
                      ) : (
                        "没有匹配的 Experiment。"
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel experiment-editor-panel">
                <div className="section-heading">
                  <h2>Experiment Details</h2>
                </div>
                {managedExperiment ? (
                  <>
                    <div>
                      <strong>{managedExperiment.title}</strong>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        {managedExperiment.description || "No description"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          setExperimentEditorId(
                            managedExperiment.experiment_id,
                          );
                          setExperimentDraft({
                            title: managedExperiment.title,
                            description: managedExperiment.description ?? "",
                          });
                          setEditingExperiment(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={() => void deleteExperiment()}
                        disabled={
                          experimentDeleting ||
                          managedExperiment.trial_count > 0
                        }
                      >
                        {experimentDeleting ? "删除中…" : "删除"}
                      </Button>
                    </div>
                    {managedExperiment.trial_count > 0 && (
                      <p className="delete-hint">
                        删除 Experiment 前需要先删除其中的 Trial。
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    选择一个 Experiment 查看详情，或点击 NEW 创建。
                  </p>
                )}
              </section>
            </>
          ) : manageTab === "subjects" ? (
            <section className="panel history-panel subject-records-panel">
              <div className="history-header"><div className="section-heading"><h2>Species</h2></div><Button className="min-h-9 px-3 text-xs" onClick={newSpecies}><PlusIcon className="size-4" />新建 Species</Button></div>
              <div className="table-wrap"><table><thead><tr><th>CODE</th><th>SCIENTIFIC NAME</th><th>ACTIONS</th></tr></thead><tbody>
                {speciesRecords.map((species) => <tr key={species.species_id}><td>{species.code}</td><td>{species.scientific_name}</td><td><button type="button" onClick={() => { setSpeciesEditorId(species.species_id); setSpeciesDraft({ code: species.code, scientific_name: species.scientific_name, image: species.image ?? "", feeding_cycle_h: species.feeding_cycle_h?.toString() ?? "", rest_cycle_h: species.rest_cycle_h?.toString() ?? "" }); setEditingSpecies(true); }}>编辑</button> <button type="button" onClick={() => void api(`/species/${species.species_id}`, { method: "DELETE" }).then(() => loadSpecies())}>删除</button></td></tr>)}
              </tbody></table></div>
            </section>
          ) : manageTab === "positions" ? (
            <section className="panel p-4">
              <div className="section-heading">
                <h2>Shared Position Map</h2>
              </div>
              {activePositionImage?.image ? (
                <div className="grid gap-3">
                  <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                    <img
                      src={activePositionImage.image}
                      alt="Shared stimulation position map"
                      className="block h-auto w-full"
                    />
                    {positions
                      .filter(
                        (position) =>
                          position.image_id === activePositionImage.image_id &&
                          position.mark,
                      )
                      .map((position) => (
                        <span
                          key={position.position_id}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${(position.mark?.x ?? 0) * 100}%`,
                            top: `${(position.mark?.y ?? 0) * 100}%`,
                          }}
                        >
                          <i className="block size-4 rounded-full border-2 border-white bg-red-500 shadow" />
                          <b className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-zinc-950 px-1.5 py-1 text-[10px] leading-none text-white shadow">
                            {position.code}
                          </b>
                        </span>
                      ))}
                  </div>
                  <small className="text-zinc-500">
                    同一图片上的所有 Position marks 会同时显示。
                  </small>
                </div>
              ) : (
                <EmptyState
                  title="还没有位置图片"
                  description="新建 Position 并上传图片后，会在这里显示所有标记。"
                />
              )}
            </section>
          ) : null}
        </aside>

        <section className="right-column">
          {view === "execute" ? (
            <>
              <div className="execute-controls">
                {pendingTrial ? (
                  <div className="pending-top-actions">
                    <Button
                      onClick={() => void savePendingTrial()}
                      disabled={saving}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void discardPendingTrial()}
                      disabled={saving}
                    >
                      Discard
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full min-h-12"
                    onClick={() => void startTrial()}
                    disabled={
                      !ready ||
                      running ||
                      !runExperimentId ||
                      !form.subject_id.trim() ||
                      !form.position_id ||
                      !form.position_2_id ||
                      form.position_id === form.position_2_id ||
                      !runPositionPreview
                    }
                  >
                    <span>{running ? "●" : "▶"}</span>
                    {running ? "TRIAL IN PROGRESS" : "START TRIAL"}
                  </Button>
                )}
                <section className="panel run-position-panel">
                  <div className="run-position-fields">
                    <Field label="POSITION 1" hint="两个位置必须不同。">
                      <Select
                        value={form.position_id}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          const nextPosition = positions.find(
                            (position) =>
                              String(position.position_id) === nextId,
                          );
                          const secondPosition = positions.find(
                            (position) =>
                              String(position.position_id) ===
                              form.position_2_id,
                          );
                          setForm((current) => ({
                            ...current,
                            position_id: nextId,
                            position_2_id:
                              secondPosition &&
                              secondPosition.image_id ===
                                nextPosition?.image_id &&
                              secondPosition.position_id !==
                                nextPosition?.position_id
                                ? current.position_2_id
                                : "",
                          }));
                        }}
                        required
                      >
                        <option value="">Select a marked position…</option>
                        {runPositions.map((position) => (
                          <option
                            key={position.position_id}
                            value={position.position_id}
                            disabled={
                              !position.image_id ||
                              !position.mark ||
                              String(position.position_id) ===
                                form.position_2_id
                            }
                          >
                            {position.code}
                            {position.description
                              ? ` · ${position.description}`
                              : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="POSITION 2"
                      hint={
                        positions.length
                          ? "保存时按顺序拼接 code。"
                          : "请先在 Manage > Positions 中创建位置。"
                      }
                    >
                      <Select
                        value={form.position_2_id}
                        onChange={(event) =>
                          setField("position_2_id", event.target.value)
                        }
                        required
                      >
                        <option value="">Select a second position…</option>
                        {runPositions.map((position) => (
                          <option
                            key={position.position_id}
                            value={position.position_id}
                            disabled={
                              !position.image_id ||
                              !position.mark ||
                              String(position.position_id) ===
                                form.position_id ||
                              position.image_id !== runPositionOne?.image_id
                            }
                          >
                            {position.code}
                            {position.description
                              ? ` · ${position.description}`
                              : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  {runPositionPreview?.image ? (
                    <div className="run-position-preview">
                      <p>
                        POSITION PREVIEW · {runPositionOne?.code} +{" "}
                        {runPositionTwo?.code}
                      </p>
                      <div>
                        <img
                          src={runPositionPreview.image}
                          alt="Selected stimulation positions"
                        />
                        {[runPositionOne, runPositionTwo].map(
                          (position) =>
                            position?.mark && (
                              <span
                                key={position.position_id}
                                style={{
                                  left: `${position.mark.x * 100}%`,
                                  top: `${position.mark.y * 100}%`,
                                }}
                              >
                                <i />
                                <b>{position.code}</b>
                              </span>
                            ),
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="run-position-placeholder">
                      选择同一图片上的两个标记位置后显示预览
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : manageTab === "experiments" ? (
            <>
              <section className="panel history-panel trials-history-panel">
                <div className="history-header items-center justify-between">
                  <div>
                    <h2>
                      {managedExperiment
                        ? `${managedExperiment.title} / Trials`
                        : "Select an Experiment"}
                    </h2>
                  </div>
                  <div className="history-tools">
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      onClick={exportCsv}
                      disabled={exporting || !managedExperiment}
                    >
                      {exporting ? "导出中…" : "导出 CSV"}
                    </Button>
                    <Button
                      variant="danger"
                      className="min-h-9 px-3 text-xs"
                      onClick={clearData}
                      disabled={clearing || running}
                    >
                      {clearing ? "清空中…" : "清空数据"}
                    </Button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TRIAL</th>
                        <th>SUBJECT</th>
                        <th>STIMULUS</th>
                        <th>POSITION</th>
                        <th>RECORDED</th>
                        <th>STATUS</th>
                        <th>RESPONSE</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trials.map((trial) =>
                        editingId === trial.trial_id && rowEdit ? (
                          <tr key={trial.trial_id} className="editing-row">
                            <td>
                              <input
                                aria-label="Trial number"
                                type="number"
                                min="1"
                                value={rowEdit.trial_no}
                                onChange={(e) =>
                                  setRowField("trial_no", e.target.value)
                                }
                              />
                              <small>#{trial.trial_id}</small>
                            </td>
                            <td>
                              <input
                                aria-label="Subject ID"
                                value={rowEdit.subject_id}
                                onChange={(e) =>
                                  setRowField("subject_id", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <div className="stimulus-edit">
                                <select
                                  aria-label="Waveform"
                                  value={rowEdit.stimulation_waveform}
                                  onChange={(e) =>
                                    setRowField(
                                      "stimulation_waveform",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option>SQUARE</option>
                                  <option>PULSE</option>
                                  <option>SINE</option>
                                  <option>RAMP</option>
                                </select>
                                <input
                                  aria-label="Frequency Hz"
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  value={rowEdit.stimulation_frequency_hz}
                                  onChange={(e) =>
                                    setRowField(
                                      "stimulation_frequency_hz",
                                      e.target.value,
                                    )
                                  }
                                />
                                <input
                                  aria-label="Low level V"
                                  type="number"
                                  step="any"
                                  value={rowEdit.stimulation_low_level_v}
                                  onChange={(e) =>
                                    setRowField(
                                      "stimulation_low_level_v",
                                      e.target.value,
                                    )
                                  }
                                />
                                <input
                                  aria-label="High level V"
                                  type="number"
                                  step="any"
                                  value={rowEdit.stimulation_high_level_v}
                                  onChange={(e) =>
                                    setRowField(
                                      "stimulation_high_level_v",
                                      e.target.value,
                                    )
                                  }
                                />
                                <input
                                  aria-label="Duty cycle percent"
                                  type="number"
                                  step="any"
                                  min="0.1"
                                  max="99.9"
                                  value={rowEdit.stimulation_duty_cycle_pct}
                                  onChange={(e) =>
                                    setRowField(
                                      "stimulation_duty_cycle_pct",
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <select
                                aria-label="Position"
                                value={rowEdit.stimulation_position_id}
                                onChange={(e) =>
                                  setRowField(
                                    "stimulation_position_id",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">Select…</option>
                                {positions.map((position) => (
                                  <option
                                    key={position.position_id}
                                    value={position.position_id}
                                    disabled={
                                      String(position.position_id) ===
                                      rowEdit.stimulation_position_2_id
                                    }
                                  >
                                    {position.code}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="Second position"
                                value={rowEdit.stimulation_position_2_id}
                                onChange={(e) =>
                                  setRowField(
                                    "stimulation_position_2_id",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">Select second…</option>
                                {positions.map((position) => (
                                  <option
                                    key={position.position_id}
                                    value={position.position_id}
                                    disabled={
                                      String(position.position_id) ===
                                      rowEdit.stimulation_position_id
                                    }
                                  >
                                    {position.code}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                aria-label="Recorded timestamp"
                                value={rowEdit.experiment_timestamp}
                                onChange={(e) =>
                                  setRowField(
                                    "experiment_timestamp",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <select
                                aria-label="Status"
                                value={rowEdit.status}
                                onChange={(e) =>
                                  setRowField("status", e.target.value)
                                }
                              >
                                <option>COMPLETED</option>
                                <option>FAILED</option>
                                <option>ABORTED</option>
                              </select>
                            </td>
                            <td>
                              <div className="response-edit">
                                <input
                                  aria-label="Latency seconds"
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="Latency"
                                  value={rowEdit.response_latency_s}
                                  onChange={(e) =>
                                    setRowField(
                                      "response_latency_s",
                                      e.target.value,
                                    )
                                  }
                                />
                                <select
                                  aria-label="Action code"
                                  value={rowEdit.response_action}
                                  onChange={(e) =>
                                    setRowField(
                                      "response_action",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">No action</option>
                                  {responseActions.map((action) => (
                                    <option
                                      key={action.code}
                                      value={action.code}
                                    >
                                      {action.code} · {action.zh}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label="Response degree"
                                  value={rowEdit.response_degree}
                                  onChange={(e) =>
                                    setRowField(
                                      "response_degree",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">No degree</option>
                                  {responseDegrees.map((degree) => (
                                    <option
                                      key={degree.score}
                                      value={degree.score}
                                    >
                                      {degree.score} · {degree.level}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td>
                              <div className="row-actions">
                                <Button
                                  className="min-h-8 px-2 text-xs"
                                  onClick={() => void saveRowEdit()}
                                  disabled={rowSaving}
                                >
                                  {rowSaving ? "…" : "保存"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="min-h-8 px-2 text-xs"
                                  onClick={() => {
                                    setEditingId(null);
                                    setRowEdit(null);
                                  }}
                                  disabled={rowSaving}
                                >
                                  取消
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={trial.trial_id}
                            onClick={() => chooseTrial(trial)}
                            className={
                              selected?.trial_id === trial.trial_id
                                ? "selected"
                                : ""
                            }
                          >
                            <td>
                              <strong>
                                T{String(trial.trial_no).padStart(3, "0")}
                              </strong>
                              <small>#{trial.trial_id}</small>
                            </td>
                            <td>{trial.subject_id}</td>
                            <td>
                              <strong>
                                {trial.stimulation_waveform ?? "SQUARE"} ·{" "}
                                {trial.stimulation_frequency_hz} Hz
                              </strong>
                              <small>
                                {trial.stimulation_low_level_v ?? 0} →{" "}
                                {trial.stimulation_high_level_v ??
                                  trial.stimulation_voltage_v}{" "}
                                V · {trial.stimulation_duty_cycle_pct ?? 50}%
                              </small>
                            </td>
                            <td>{trial.stimulation_position || "—"}</td>
                            <td>
                              {trial.experiment_timestamp?.slice(0, 16) ?? "—"}
                            </td>
                            <td>
                              <span
                                className={`table-status ${trial.status.toLowerCase()}`}
                              >
                                {trial.status}
                              </span>
                            </td>
                            <td>
                              {trial.response_action !== null ? (
                                <>
                                  <strong>
                                    {actionLabel(trial.response_action)}
                                  </strong>
                                  <small>
                                    {degreeLabel(trial.response_degree)}
                                  </small>
                                </>
                              ) : (
                                <span className="muted">Not tagged</span>
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                <Button
                                  variant="secondary"
                                  className="min-h-8 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    beginRowEdit(trial);
                                  }}
                                  disabled={running || editingId !== null}
                                >
                                  编辑
                                </Button>
                                <Button
                                  variant="danger"
                                  className="min-h-8 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteRow(trial);
                                  }}
                                  disabled={
                                    running ||
                                    deletingId === trial.trial_id ||
                                    editingId !== null
                                  }
                                >
                                  {deletingId === trial.trial_id ? "…" : "删除"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                      {trials.length === 0 && (
                        <tr>
                          <td className="empty-table" colSpan={8}>
                            No trial records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`annotation-drawer ${selected ? "open" : ""}`}>
                  {selected ? (
                    <>
                      <div className="annotation-title">
                        <div>
                          <p>RESPONSE ANNOTATION</p>
                          <h3>
                            {selected
                              ? `${selected.subject_id} · Trial ${selected.trial_no}`
                              : "Select a trial"}
                          </h3>
                        </div>
                        {selected && (
                          <button onClick={() => setSelected(null)}>×</button>
                        )}
                      </div>
                      <div className="annotation-fields">
                        <label className="field">
                          <span>
                            LATENCY <em>s</em>
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={!selected}
                            value={annotation.latency}
                            onChange={(e) =>
                              setAnnotation({
                                ...annotation,
                                latency: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field action-field">
                          <span>ACTION CODE</span>
                          <select
                            disabled={!selected}
                            value={annotation.action}
                            onChange={(e) =>
                              setAnnotation({
                                ...annotation,
                                action: e.target.value,
                              })
                            }
                          >
                            <option value="">Not tagged</option>
                            {annotation.action &&
                              !responseActions.some(
                                (item) => item.code === annotation.action,
                              ) && (
                                <option value={annotation.action}>
                                  {annotation.action} (Legacy)
                                </option>
                              )}
                            {responseActions.map((action) => (
                              <option key={action.code} value={action.code}>
                                {action.code} · {action.zh} / {action.en}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>DEGREE</span>
                          <select
                            disabled={!selected}
                            value={annotation.degree}
                            onChange={(e) =>
                              setAnnotation({
                                ...annotation,
                                degree: e.target.value,
                              })
                            }
                          >
                            <option value="">Not tagged</option>
                            {responseDegrees.map((degree) => (
                              <option key={degree.score} value={degree.score}>
                                {degree.score} · {degree.level}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          onClick={saveAnnotation}
                          disabled={!selected || saving}
                        >
                          {saving ? "保存中…" : "保存标注"}
                        </Button>
                      </div>
                      <details className="response-guide">
                        <summary>查看应对刺激反应动作编号与程度分级</summary>
                        <div className="guide-grid">
                          <div>
                            <h4>应对刺激反应动作编号</h4>
                            <div className="guide-table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>编号</th>
                                    <th>动作</th>
                                    <th>英文</th>
                                    <th>定义</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {responseActions.map((action) => (
                                    <tr key={action.code}>
                                      <td>{action.code}</td>
                                      <td>{action.zh}</td>
                                      <td>{action.en}</td>
                                      <td>{action.definition}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <h4>反应动作程度分级</h4>
                            <div className="guide-table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>评分</th>
                                    <th>反应等级</th>
                                    <th>判定标准</th>
                                    <th>典型表现</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {responseDegrees.map((degree) => (
                                    <tr key={degree.score}>
                                      <td>{degree.score}</td>
                                      <td>{degree.level}</td>
                                      <td>{degree.criteria}</td>
                                      <td>{degree.example}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </details>
                    </>
                  ) : (
                    <EmptyState
                      title="选择一个 Trial"
                      description="从上方表格选择记录后，可查看录像并填写反应标注。"
                    />
                  )}
                </div>
              </section>
            </>
          ) : manageTab === "subjects" ? (
            <section className="panel history-panel subject-records-panel">
              <div className="history-header">
                <div className="section-heading">
                  <h2>Subject Records</h2>
                </div>
                <Button className="min-h-9 px-3 text-xs" onClick={newSubject}>
                  <PlusIcon className="size-4" />
                  新建 Subject
                </Button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SUBJECT ID</th>
                      <th>LENGTH</th>
                      <th>WIDTH</th>
                      <th>MANDIBLE</th>
                      <th>WEIGHT</th>
                      <th>SPECIES</th>
                      <th>TRIALS</th>
                      <th>CREATED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSubjects.map((subject) => (
                      <tr key={subject.subject_id} className={subject.status !== "正常" ? "text-zinc-400" : ""}>
                        <td>
                          <strong>{subject.subject_id}</strong>
                        </td>
                        <td>
                          {subject.body_length_cm ?? "—"}
                          <small>
                            {subject.body_length_cm !== null ? "cm" : ""}
                          </small>
                        </td>
                        <td>
                          {subject.body_width_cm ?? "—"}
                          <small>
                            {subject.body_width_cm !== null ? "cm" : ""}
                          </small>
                        </td>
                        <td>
                          {subject.mandibular_length_cm ?? "—"}
                          <small>
                            {subject.mandibular_length_cm !== null ? "cm" : ""}
                          </small>
                        </td>
                        <td>
                          {subject.body_weight_g ?? "—"}
                          <small>
                            {subject.body_weight_g !== null ? "g" : ""}
                          </small>
                        </td>
                        <td>{subject.species || "—"}</td>
                        <td>{subject.trial_count}</td>
                        <td>{subject.created_at?.slice(0, 16) ?? "—"}</td>
                        <td>
                          <div className="row-actions">
                            <button onClick={() => void api(`/subjects/${subject.subject_id}/feed`, { method: "POST" }).then(() => loadSubjects())} disabled={running}>Feed</button>
                            <button onClick={() => void api(`/subjects/${subject.subject_id}/test`, { method: "POST" }).then(() => loadSubjects())} disabled={running}>Test</button>
                            <button
                              onClick={() => editSubject(subject)}
                              disabled={running}
                            >
                              编辑
                            </button>
                            <button
                              className="row-delete"
                              onClick={() => void deleteSubject(subject)}
                              disabled={
                                running ||
                                subject.trial_count > 0 ||
                                subjectDeleting === subject.subject_id
                              }
                            >
                              {subjectDeleting === subject.subject_id
                                ? "…"
                                : "删除"}
                            </button>
                          </div>
                          {subject.trial_count > 0 && (
                            <small>先删除关联 Trial</small>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visibleSubjects.length === 0 && (
                      <tr>
                        <td className="empty-table" colSpan={12}>
                          {subjects.length === 0
                            ? "还没有 Subject。"
                            : "没有匹配的 Subject。"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : manageTab === "positions" ? (
            <section className="panel history-panel subject-records-panel">
              <div className="history-header">
                <div className="section-heading">
                  <h2>Stimulation Positions</h2>
                </div>
                <Button className="min-h-9 px-3 text-xs" onClick={newPosition}>
                  <PlusIcon className="size-4" />
                  新建 Position
                </Button>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {visiblePositions.map((position) => (
                  <article
                    key={position.position_id}
                    className={`cursor-pointer overflow-hidden rounded-xl border bg-white ${activePositionImage?.image_id === position.image_id ? "border-zinc-950 ring-2 ring-zinc-200" : "border-zinc-200"}`}
                    onClick={() => setSelectedPositionImageId(position.image_id)}
                  >
                    {position.image ? (
                      <div className="flex h-48 items-center justify-center bg-zinc-100">
                        <div className="relative w-fit max-w-full">
                          <img
                            src={position.image}
                            alt={`Stimulation position ${position.code}`}
                            className="block max-h-48 max-w-full"
                          />
                          {position.mark && (
                            <span
                              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                              style={{
                                left: `${position.mark.x * 100}%`,
                                top: `${position.mark.y * 100}%`,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid h-48 place-items-center bg-zinc-100 text-sm text-zinc-400">
                        No image
                      </div>
                    )}
                    <div className="grid gap-3 p-4">
                      <div>
                        <Badge tone="info">{position.code}</Badge>
                        <p className="mt-2 text-sm text-zinc-600">
                          {position.description || "No description"}
                        </p>
                      </div>
                      <small className="text-zinc-500">
                        ID {position.position_id} · {position.trial_count} trials
                      </small>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => editPosition(position)}
                          disabled={running}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="danger"
                          className="flex-1"
                          onClick={() => void deletePosition(position)}
                          disabled={
                            running ||
                            position.trial_count > 0 ||
                            positionDeleting === position.position_id
                          }
                        >
                          {positionDeleting === position.position_id ? "…" : "删除"}
                        </Button>
                      </div>
                      {position.trial_count > 0 && (
                        <small className="text-zinc-500">已被 Trial 使用，不能删除。</small>
                      )}
                    </div>
                  </article>
                ))}
                {visiblePositions.length === 0 && (
                  <EmptyState
                    title={positions.length === 0 ? "还没有 Position" : "没有匹配的 Position"}
                    description="创建并标记刺激位置后，才能开始实验。"
                  />
                )}
              </div>
            </section>
          ) : manageTab === "statistics" ? (
            <section className="panel statistics-panel">
              <div className="history-header">
                <div>
                  <div className="section-heading">
                    <span>STATISTICS</span>
                    <h2>Trials by Subject and Position Combination</h2>
                  </div>
                  <p className="statistics-description">
                    每个 Trial 按完整刺激点组合计数，例如 H1A1。
                  </p>
                </div>
                <div className="statistics-controls">
                  <label className="statistics-experiment-select">
                    <span>EXPERIMENT</span>
                    <Select
                      value={statisticsExperimentId?.toString() ?? ""}
                      onChange={(event) => {
                        const experimentId = event.target.value ? Number(event.target.value) : null;
                        setStatisticsExperimentId(experimentId);
                        if (experimentId === null) {
                          setSubjectPositionCombinationStatistics([]);
                        } else {
                          void loadSubjectPositionCombinationStatistics(experimentId).catch(() =>
                            setSubjectPositionCombinationStatistics([]),
                          );
                        }
                      }}
                    >
                      <option value="">选择 Experiment…</option>
                      {experiments.map((experiment) => (
                        <option key={experiment.experiment_id} value={experiment.experiment_id}>
                          {experiment.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Badge tone="info">MAX {statisticMaximum} TRIALS</Badge>
                </div>
              </div>
              {statisticSubjects.length > 0 &&
              statisticPositionCombinations.length > 0 ? (
                <>
                  <div className="statistics-legend">
                    {statisticPositionCombinations.map(
                      (combination, combinationIndex) => (
                      <span key={combination}>
                        <i
                          style={{
                            backgroundColor: `hsl(${(combinationIndex * 67) % 360} 45% 48%)`,
                          }}
                        />
                        {combination}
                      </span>
                      ),
                    )}
                  </div>
                  <div className="statistics-chart-scroll">
                    <div
                      className="statistics-chart"
                      style={{
                        minWidth: `${Math.max(
                          720,
                          statisticSubjects.length *
                            Math.max(
                              96,
                              statisticPositionCombinations.length * 34,
                            ),
                        )}px`,
                      }}
                    >
                      {statisticSubjects.map((subjectId) => (
                        <div className="statistics-subject" key={subjectId}>
                          <div className="statistics-bars">
                            {statisticPositionCombinations.map(
                              (combination, combinationIndex) => {
                                const count =
                                  subjectPositionCombinationStatistics.find(
                                    (item) =>
                                      item.subject_id === subjectId &&
                                      item.position_combination === combination,
                                  )?.trial_count ?? 0;
                                return (
                                  <div
                                    className="statistics-bar-slot"
                                    key={combination}
                                    title={`${subjectId} · ${combination}: ${count} trials`}
                                  >
                                    <span>{count}</span>
                                    <i
                                      style={{
                                        height: `${(count / statisticMaximum) * 100}%`,
                                        backgroundColor: `hsl(${(combinationIndex * 67) % 360} 45% 48%)`,
                                      }}
                                    />
                                  </div>
                                );
                              },
                            )}
                          </div>
                          <strong>{subjectId}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="暂无统计数据"
                    description="创建 Subject、Position 并完成 Trial 后，统计图会显示在这里。"
                  />
                </div>
              )}
            </section>
          ) : null}
        </section>
      </section>
      {view === "execute" && (
        <section className="panel run-panel run-footer-panel">
          <div className="run-summary">
            <div>
              <p>CURRENT RUN</p>
              <h2>
                {running
                  ? `Trial ${task.result?.trial_no ?? "in progress"}`
                  : task.status === "IDLE"
                    ? "Standing by"
                    : task.status}
              </h2>
            </div>
            <div className={`run-badge ${task.status.toLowerCase()}`}>
              {task.status}
            </div>
          </div>
          <div className="progress-track">
            <span
              className={
                running
                  ? "moving"
                  : task.status === "COMPLETED"
                    ? "complete"
                    : ""
              }
            />
          </div>
          <div
            className="log-window"
            ref={logWindowRef}
            role="log"
            aria-live="polite"
          >
            {task.logs.length === 0 ? (
              <p className="empty-log">System messages will appear here.</p>
            ) : (
              task.logs.map((log, index) => (
                <div
                  className="log-line"
                  key={`${log.timestamp}-${index}`}
                >
                  <time>{log.timestamp.slice(11, 19)}</time>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
}
