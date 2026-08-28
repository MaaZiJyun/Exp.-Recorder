"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type DeviceStatus = {
  mock: boolean;
  sdg_connected: boolean;
  camera_connected: boolean;
  camera_recording: boolean;
  camera_error: string | null;
};

type Trial = {
  trial_id: number;
  subject_id: string;
  trial_no: number;
  video_id: string;
  experiment_timestamp: string;
  stimulation_time: string | null;
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

type RowEdit = {
  subject_id: string;
  trial_no: string;
  experiment_timestamp: string;
  stimulation_position: string;
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
  position: string;
  baseline_duration_s: string;
  post_stim_duration_s: string;
};

type DefaultConfig = Omit<TrialForm, "subject_id" | "body_length_cm" | "body_weight_g">;

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
  position: "",
  baseline_duration_s: "",
  post_stim_duration_s: "",
};

const responseActions = [
  { code: "0", zh: "静止", en: "Stationary", definition: "无明显位移" },
  { code: "1", zh: "前进", en: "Forward", definition: "主要向前方移动" },
  { code: "2", zh: "后退", en: "Backward", definition: "主要向后方移动" },
  { code: "3", zh: "左转", en: "Turn Left", definition: "主要向左改变运动方向" },
  { code: "4", zh: "右转", en: "Turn Right", definition: "主要向右改变运动方向" },
  { code: "5", zh: "前左斜行", en: "Forward-Left", definition: "同时具有前进和左向运动分量" },
  { code: "6", zh: "前右斜行", en: "Forward-Right", definition: "同时具有前进和右向运动分量" },
  { code: "7", zh: "后左斜退", en: "Backward-Left", definition: "同时具有后退和左向运动分量" },
  { code: "8", zh: "后右斜退", en: "Backward-Right", definition: "同时具有后退和右向运动分量" },
  { code: "9", zh: "抬头", en: "Head Raising", definition: "头部明显抬起，但未形成明显位移" },
] as const;

const responseDegrees = [
  { score: "0", level: "无反应", criteria: "与静止对照组相比无明显行为变化", example: "无明显动作" },
  { score: "1", level: "轻微反应", criteria: "出现轻微、短暂的身体反应，但未产生明显的定向运动", example: "抬头、身体轻微绷紧、触角轻微活动" },
  { score: "2", level: "积极反应", criteria: "出现明显、可重复的目标行为；运动速度与动态对照组接近", example: "正常行走、转向、前进/后退等" },
  { score: "3", level: "过激反应", criteria: "出现明显异常或非目标行为，可能表明刺激强度过高或产生强烈应激", example: "抽搐、翻身、剧烈乱跑、挣扎、明显应激反应" },
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
  return <span className={`status-dot ${active ? "online" : "offline"}`} aria-hidden />;
}

export default function Home() {
  const [devices, setDevices] = useState<DeviceStatus | null>(null);
  const [task, setTask] = useState<TaskState>({ task_id: null, status: "IDLE", result: null, logs: [] });
  const [trials, setTrials] = useState<Trial[]>([]);
  const [form, setForm] = useState<TrialForm>(initialForm);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Trial | null>(null);
  const [annotation, setAnnotation] = useState({ latency: "", action: "", degree: "" });
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rowEdit, setRowEdit] = useState<RowEdit | null>(null);
  const [rowSaving, setRowSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const previousTaskStatus = useRef(task.status);
  const filterRef = useRef("");
  const logWindowRef = useRef<HTMLDivElement>(null);

  const loadTrials = useCallback(async (subject = "") => {
    const query = subject.trim() ? `?subject_id=${encodeURIComponent(subject.trim())}` : "";
    setTrials(await api<Trial[]>(`/trials${query}`));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [deviceState, taskState] = await Promise.all([
        api<DeviceStatus>("/devices"),
        api<TaskState>("/trials/current"),
      ]);
      setDevices(deviceState);
      setTask(taskState);
      if (previousTaskStatus.current === "RUNNING" && taskState.status !== "RUNNING") {
        await loadTrials(filterRef.current);
        setNotice({
          kind: taskState.status === "COMPLETED" ? "success" : "error",
          text: taskState.status === "COMPLETED" ? "实验完成，数据已写入数据库。" : taskState.result?.error_message ?? "实验失败。",
        });
      }
      previousTaskStatus.current = taskState.status;
    } catch {
      setDevices(null);
    }
  }, [loadTrials]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadTrials().catch(() => setTrials([]));
      void refresh();
      void api<Record<string, string | number>>("/config").then((defaults) => {
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, String(value)])) as DefaultConfig,
        }));
      }).catch(() => setNotice({ kind: "error", text: "无法读取后端默认配置。" }));
    }, 0);
    const timer = window.setInterval(() => void refresh(), 900);
    const previewTimer = window.setInterval(() => setPreviewTick((value) => value + 1), 250);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.clearInterval(previewTimer);
    };
  }, [loadTrials, refresh]);

  useEffect(() => {
    const logWindow = logWindowRef.current;
    if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
  }, [task.logs.length]);

  const connect = async () => {
    setConnecting(true);
    setNotice(null);
    try {
      const state = await api<DeviceStatus>("/devices/connect", { method: "POST" });
      setDevices(state);
      setNotice({
        kind: state.sdg_connected && state.camera_connected ? "success" : "error",
        text: state.sdg_connected && state.camera_connected ? "所有硬件已连接。" : "部分硬件连接失败，请检查线缆与固件。",
      });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "连接失败" });
    } finally {
      setConnecting(false);
    }
  };

  const startTrial = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      await api("/trials", {
        method: "POST",
        body: JSON.stringify({
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
          position: form.position,
          baseline_duration_s: Number(form.baseline_duration_s),
          post_stim_duration_s: Number(form.post_stim_duration_s),
        }),
      });
      previousTaskStatus.current = "RUNNING";
      setTask((current) => ({ ...current, status: "RUNNING", result: null }));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "无法开始实验" });
    }
  };

  const lookupSubject = async () => {
    if (!form.subject_id.trim()) return;
    try {
      const subject = await api<{ body_length_cm: number | null; body_weight_g: number | null }>(
        `/subjects/${encodeURIComponent(form.subject_id.trim())}`,
      );
      setForm((current) => ({
        ...current,
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
      stimulation_position: trial.stimulation_position ?? "",
      stimulation_waveform: trial.stimulation_waveform ?? "SQUARE",
      stimulation_high_level_v: String(trial.stimulation_high_level_v ?? trial.stimulation_voltage_v),
      stimulation_low_level_v: String(trial.stimulation_low_level_v ?? 0),
      stimulation_duty_cycle_pct: String(trial.stimulation_duty_cycle_pct ?? 50),
      stimulation_frequency_hz: String(trial.stimulation_frequency_hz),
      response_latency_s: trial.response_latency_s?.toString() ?? "",
      response_action: trial.response_action ?? "",
      response_degree: trial.response_degree?.toString() ?? "",
      status: trial.status,
    });
  };

  const setRowField = (key: keyof RowEdit, value: string) => {
    setRowEdit((current) => current ? { ...current, [key]: value } : current);
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
          stimulation_high_level_v: Number(rowEdit.stimulation_high_level_v),
          stimulation_low_level_v: Number(rowEdit.stimulation_low_level_v),
          stimulation_duty_cycle_pct: Number(rowEdit.stimulation_duty_cycle_pct),
          stimulation_frequency_hz: Number(rowEdit.stimulation_frequency_hz),
          response_latency_s: numberOrNull(rowEdit.response_latency_s),
          response_action: rowEdit.response_action.trim() || null,
          response_degree: numberOrNull(rowEdit.response_degree),
        }),
      });
      await loadTrials(filterRef.current);
      if (selected?.trial_id === editingId) setSelected(null);
      setEditingId(null);
      setRowEdit(null);
      setNotice({ kind: "success", text: `Trial #${editingId} 已更新。` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "更新失败" });
    } finally {
      setRowSaving(false);
    }
  };

  const deleteRow = async (trial: Trial) => {
    if (!window.confirm(`确定删除 Trial #${trial.trial_id}？录像文件将保留。`)) return;
    setDeletingId(trial.trial_id);
    try {
      await api(`/trials/${trial.trial_id}`, { method: "DELETE" });
      if (selected?.trial_id === trial.trial_id) setSelected(null);
      if (editingId === trial.trial_id) { setEditingId(null); setRowEdit(null); }
      await loadTrials(filterRef.current);
      setNotice({ kind: "success", text: `Trial #${trial.trial_id} 已删除，录像文件已保留。` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "删除失败" });
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
      await loadTrials(filterRef.current);
      setNotice({ kind: "success", text: `Trial #${selected.trial_id} 标注已保存。` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const query = filterRef.current.trim()
        ? `?subject_id=${encodeURIComponent(filterRef.current.trim())}`
        : "";
      const response = await fetch(`/backend/trials/export${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`CSV 导出失败 (${response.status})`);
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "exp-recorder.csv";
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
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "CSV 导出失败" });
    } finally {
      setExporting(false);
    }
  };

  const clearData = async () => {
    const confirmed = window.confirm(
      "确定清空所有 Trial 和 Subject 数据吗？此操作无法撤销。data/videos/ 中的视频文件会保留。",
    );
    if (!confirmed) return;
    setClearing(true);
    setNotice(null);
    try {
      const result = await api<{ trials_deleted: number; subjects_deleted: number }>("/data", {
        method: "DELETE",
      });
      setTrials([]);
      setSelected(null);
      setTask({ task_id: null, status: "IDLE", result: null, logs: [] });
      previousTaskStatus.current = "IDLE";
      setNotice({
        kind: "success",
        text: `已清空 ${result.trials_deleted} 条 Trial 和 ${result.subjects_deleted} 个 Subject；视频文件已保留。`,
      });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "清空失败" });
    } finally {
      setClearing(false);
    }
  };

  const setField = (key: keyof TrialForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const ready = Boolean(devices?.sdg_connected && devices?.camera_connected);
  const running = task.status === "RUNNING";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">ER</div>
        <div className="brand-copy">
          <p>EXPERIMENT OPERATIONS</p>
          <h1>Exp. Recorder</h1>
        </div>
        <div className="topbar-spacer" />
        <div className={`system-pill ${ready ? "ready" : "waiting"}`}>
          <span className="pulse" />
          {devices ? (ready ? "SYSTEM READY" : "HARDWARE OFFLINE") : "API OFFLINE"}
        </div>
        <button className="ghost-button" onClick={connect} disabled={connecting || running}>
          {connecting ? "CONNECTING…" : "RECONNECT"}
        </button>
      </header>

      {notice && (
        <button className={`notice ${notice.kind}`} onClick={() => setNotice(null)}>
          <span>{notice.text}</span><span>×</span>
        </button>
      )}

      <section className="dashboard-grid">
        <aside className="left-column">
          <section className="panel device-panel">
            <div className="section-heading"><span>01</span><h2>Hardware</h2></div>
            <div className="device-row">
              <div className="device-icon">⚡</div>
              <div><strong>SDG1022X</strong><small>Stimulus generator</small></div>
              <div className="device-state"><StatusDot active={Boolean(devices?.sdg_connected)} />{devices?.sdg_connected ? "ONLINE" : "OFFLINE"}</div>
            </div>
            <div className="device-row">
              <div className="device-icon">◉</div>
              <div><strong>XIAO ESP32S3</strong><small>{devices?.camera_error ?? (devices?.camera_recording ? "Recording now" : "Camera recorder")}</small></div>
              <div className="device-state"><StatusDot active={Boolean(devices?.camera_connected)} />{devices?.camera_connected ? "ONLINE" : "OFFLINE"}</div>
            </div>
            {devices?.mock && <div className="mock-banner">SIMULATION MODE · NO PHYSICAL OUTPUT</div>}
          </section>

          <section className="panel camera-panel">
            <div className="camera-heading">
              <div className="section-heading"><span>LIVE</span><h2>{selected ? "Annotation video" : running ? "Recording monitor" : "Camera preview"}</h2></div>
              <div className={`camera-mode ${selected ? "playback" : running ? "recording" : "idle"}`}><i />{selected ? "PLAYBACK" : running ? "REC" : "IDLE · LIVE"}</div>
            </div>
            <div className="camera-viewport">
              {selected ? (
                <video key={selected.trial_id} controls preload="metadata" src={`/backend/trials/${selected.trial_id}/video`} />
              ) : devices?.camera_connected && !devices.mock ? (
                <img src={`/backend/camera/frame?t=${previewTick}`} alt={running ? "实验录像实时画面" : "摄像机空闲实时预览"} />
              ) : (
                <div className="camera-empty"><span>◉</span><p>{devices?.mock ? "SIMULATION MODE" : "CAMERA OFFLINE"}</p><small>{devices?.mock ? "真实设备连接后显示实时画面" : "连接 XIAO ESP32S3 后显示实时画面"}</small></div>
              )}
            </div>
            {selected && <button type="button" className="return-live" onClick={() => setSelected(null)}>← RETURN TO LIVE CAMERA</button>}
          </section>

          <form className="panel config-panel" onSubmit={startTrial}>
            <div className="section-heading"><span>02</span><h2>New Trial</h2></div>
            <div className="subject-grid">
              <label className="field wide"><span>SUBJECT ID</span><input value={form.subject_id} onChange={(e) => setField("subject_id", e.target.value)} onBlur={lookupSubject} required /></label>
              <label className="field"><span>LENGTH <em>cm</em></span><input type="number" step="any" min="0" value={form.body_length_cm} onChange={(e) => setField("body_length_cm", e.target.value)} /></label>
              <label className="field"><span>WEIGHT <em>g</em></span><input type="number" step="any" min="0" value={form.body_weight_g} onChange={(e) => setField("body_weight_g", e.target.value)} /></label>
            </div>
            <div className="divider"><span>STIMULUS</span></div>
            <div className="form-grid">
              <label className="field"><span>WAVEFORM</span><select value={form.waveform} onChange={(e) => setField("waveform", e.target.value)}><option value="SQUARE">Square</option><option value="PULSE">Pulse</option><option value="SINE">Sine</option><option value="RAMP">Ramp</option></select></label>
              <label className="field"><span>FREQUENCY <em>Hz</em></span><input type="number" step="any" min="0.001" value={form.frequency_hz} onChange={(e) => setField("frequency_hz", e.target.value)} required /></label>
              <label className="field"><span>HIGH LEVEL <em>V</em></span><input type="number" step="any" value={form.high_level_v} onChange={(e) => setField("high_level_v", e.target.value)} required /></label>
              <label className="field"><span>LOW LEVEL <em>V</em></span><input type="number" step="any" value={form.low_level_v} onChange={(e) => setField("low_level_v", e.target.value)} required /></label>
              <label className="field"><span>DUTY CYCLE <em>%</em></span><input type="number" step="any" min="0.1" max="99.9" value={form.duty_cycle_pct} onChange={(e) => setField("duty_cycle_pct", e.target.value)} required /></label>
              <label className="field"><span>DURATION <em>s</em></span><input type="number" step="any" min="0.001" value={form.duration_s} onChange={(e) => setField("duration_s", e.target.value)} required /></label>
              <label className="field"><span>COUNT</span><input type="number" step="1" min="1" value={form.count} onChange={(e) => setField("count", e.target.value)} required /></label>
              <label className="field"><span>INTERVAL <em>s</em></span><input type="number" step="any" min="0" value={form.interval_s} onChange={(e) => setField("interval_s", e.target.value)} required /></label>
              <label className="field"><span>POSITION</span><input value={form.position} onChange={(e) => setField("position", e.target.value)} required /></label>
            </div>
            <div className="divider"><span>RECORDING WINDOW</span></div>
            <div className="timing-row">
              <label className="field"><span>BASELINE <em>s</em></span><input type="number" step="any" min="0" value={form.baseline_duration_s} onChange={(e) => setField("baseline_duration_s", e.target.value)} required /></label>
              <div className="timeline"><i /><b>STIM</b><i /></div>
              <label className="field"><span>POST-STIM <em>s</em></span><input type="number" step="any" min="0" value={form.post_stim_duration_s} onChange={(e) => setField("post_stim_duration_s", e.target.value)} required /></label>
            </div>
            <button className="start-button" disabled={!ready || running}>
              <span>{running ? "●" : "▶"}</span>{running ? "TRIAL IN PROGRESS" : "START TRIAL"}
            </button>
            {!ready && <p className="button-hint">Connect both devices before starting.</p>}
          </form>
        </aside>

        <section className="right-column">
          <section className="panel run-panel">
            <div className="run-summary">
              <div><p>CURRENT RUN</p><h2>{running ? `Trial ${task.result?.trial_no ?? "in progress"}` : task.status === "IDLE" ? "Standing by" : task.status}</h2></div>
              <div className={`run-badge ${task.status.toLowerCase()}`}>{task.status}</div>
            </div>
            <div className="progress-track"><span className={running ? "moving" : task.status === "COMPLETED" ? "complete" : ""} /></div>
            <div className="log-window" ref={logWindowRef} role="log" aria-live="polite">
              {task.logs.length === 0 ? <p className="empty-log">System messages will appear here.</p> : task.logs.map((log, index) => (
                <div className="log-line" key={`${log.timestamp}-${index}`}><time>{log.timestamp.slice(11, 19)}</time><span>{log.message}</span></div>
              ))}
            </div>
          </section>

          <section className="panel history-panel">
            <div className="history-header">
              <div className="section-heading"><span>03</span><h2>Trial Archive</h2></div>
              <div className="history-tools">
                <div className="filter-control"><input placeholder="Filter subject…" value={filter} onChange={(e) => { filterRef.current = e.target.value; setFilter(e.target.value); }} onKeyDown={(e) => e.key === "Enter" && void loadTrials(filterRef.current)} /><button type="button" onClick={() => void loadTrials(filterRef.current)}>FILTER</button></div>
                <button type="button" className="archive-button export" onClick={exportCsv} disabled={exporting}>{exporting ? "EXPORTING…" : "EXPORT CSV"}</button>
                <button type="button" className="archive-button danger" onClick={clearData} disabled={clearing || running}>{clearing ? "CLEARING…" : "CLEAR DATA"}</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>TRIAL</th><th>SUBJECT</th><th>STIMULUS</th><th>POSITION</th><th>RECORDED</th><th>STATUS</th><th>RESPONSE</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {trials.map((trial) => editingId === trial.trial_id && rowEdit ? (
                    <tr key={trial.trial_id} className="editing-row">
                      <td><input aria-label="Trial number" type="number" min="1" value={rowEdit.trial_no} onChange={(e) => setRowField("trial_no", e.target.value)} /><small>#{trial.trial_id}</small></td>
                      <td><input aria-label="Subject ID" value={rowEdit.subject_id} onChange={(e) => setRowField("subject_id", e.target.value)} /></td>
                      <td><div className="stimulus-edit"><select aria-label="Waveform" value={rowEdit.stimulation_waveform} onChange={(e) => setRowField("stimulation_waveform", e.target.value)}><option>SQUARE</option><option>PULSE</option><option>SINE</option><option>RAMP</option></select><input aria-label="Frequency Hz" type="number" step="any" min="0.001" value={rowEdit.stimulation_frequency_hz} onChange={(e) => setRowField("stimulation_frequency_hz", e.target.value)} /><input aria-label="Low level V" type="number" step="any" value={rowEdit.stimulation_low_level_v} onChange={(e) => setRowField("stimulation_low_level_v", e.target.value)} /><input aria-label="High level V" type="number" step="any" value={rowEdit.stimulation_high_level_v} onChange={(e) => setRowField("stimulation_high_level_v", e.target.value)} /><input aria-label="Duty cycle percent" type="number" step="any" min="0.1" max="99.9" value={rowEdit.stimulation_duty_cycle_pct} onChange={(e) => setRowField("stimulation_duty_cycle_pct", e.target.value)} /></div></td>
                      <td><input aria-label="Position" value={rowEdit.stimulation_position} onChange={(e) => setRowField("stimulation_position", e.target.value)} /></td>
                      <td><input aria-label="Recorded timestamp" value={rowEdit.experiment_timestamp} onChange={(e) => setRowField("experiment_timestamp", e.target.value)} /></td>
                      <td><select aria-label="Status" value={rowEdit.status} onChange={(e) => setRowField("status", e.target.value)}><option>COMPLETED</option><option>FAILED</option><option>ABORTED</option></select></td>
                      <td><div className="response-edit"><input aria-label="Latency seconds" type="number" min="0" step="any" placeholder="Latency" value={rowEdit.response_latency_s} onChange={(e) => setRowField("response_latency_s", e.target.value)} /><select aria-label="Action code" value={rowEdit.response_action} onChange={(e) => setRowField("response_action", e.target.value)}><option value="">No action</option>{responseActions.map((action) => <option key={action.code} value={action.code}>{action.code} · {action.zh}</option>)}</select><select aria-label="Response degree" value={rowEdit.response_degree} onChange={(e) => setRowField("response_degree", e.target.value)}><option value="">No degree</option>{responseDegrees.map((degree) => <option key={degree.score} value={degree.score}>{degree.score} · {degree.level}</option>)}</select></div></td>
                      <td><div className="row-actions"><button className="row-save" onClick={() => void saveRowEdit()} disabled={rowSaving}>{rowSaving ? "…" : "保存"}</button><button onClick={() => { setEditingId(null); setRowEdit(null); }} disabled={rowSaving}>取消</button></div></td>
                    </tr>
                  ) : (
                    <tr key={trial.trial_id} onClick={() => chooseTrial(trial)} className={selected?.trial_id === trial.trial_id ? "selected" : ""}>
                      <td><strong>T{String(trial.trial_no).padStart(3, "0")}</strong><small>#{trial.trial_id}</small></td>
                      <td>{trial.subject_id}</td>
                      <td><strong>{trial.stimulation_waveform ?? "SQUARE"} · {trial.stimulation_frequency_hz} Hz</strong><small>{trial.stimulation_low_level_v ?? 0} → {trial.stimulation_high_level_v ?? trial.stimulation_voltage_v} V · {trial.stimulation_duty_cycle_pct ?? 50}%</small></td>
                      <td>{trial.stimulation_position || "—"}</td>
                      <td>{trial.experiment_timestamp?.slice(0, 16) ?? "—"}</td>
                      <td><span className={`table-status ${trial.status.toLowerCase()}`}>{trial.status}</span></td>
                      <td>{trial.response_action !== null ? <><strong>{actionLabel(trial.response_action)}</strong><small>{degreeLabel(trial.response_degree)}</small></> : <span className="muted">Not tagged</span>}</td>
                      <td><div className="row-actions"><button onClick={(e) => { e.stopPropagation(); beginRowEdit(trial); }} disabled={running || editingId !== null}>编辑</button><button className="row-delete" onClick={(e) => { e.stopPropagation(); void deleteRow(trial); }} disabled={running || deletingId === trial.trial_id || editingId !== null}>{deletingId === trial.trial_id ? "…" : "删除"}</button></div></td>
                    </tr>
                  ))}
                  {trials.length === 0 && <tr><td className="empty-table" colSpan={8}>No trial records found.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className={`annotation-drawer ${selected ? "open" : ""}`}>
              <div className="annotation-title"><div><p>RESPONSE ANNOTATION</p><h3>{selected ? `${selected.subject_id} · Trial ${selected.trial_no}` : "Select a trial"}</h3></div>{selected && <button onClick={() => setSelected(null)}>×</button>}</div>
              <div className="annotation-fields">
                <label className="field"><span>LATENCY <em>s</em></span><input type="number" min="0" step="any" disabled={!selected} value={annotation.latency} onChange={(e) => setAnnotation({ ...annotation, latency: e.target.value })} /></label>
                <label className="field action-field"><span>ACTION CODE</span><select disabled={!selected} value={annotation.action} onChange={(e) => setAnnotation({ ...annotation, action: e.target.value })}><option value="">Not tagged</option>{annotation.action && !responseActions.some((item) => item.code === annotation.action) && <option value={annotation.action}>{annotation.action} (Legacy)</option>}{responseActions.map((action) => <option key={action.code} value={action.code}>{action.code} · {action.zh} / {action.en}</option>)}</select></label>
                <label className="field"><span>DEGREE</span><select disabled={!selected} value={annotation.degree} onChange={(e) => setAnnotation({ ...annotation, degree: e.target.value })}><option value="">Not tagged</option>{responseDegrees.map((degree) => <option key={degree.score} value={degree.score}>{degree.score} · {degree.level}</option>)}</select></label>
                <button className="save-button" onClick={saveAnnotation} disabled={!selected || saving}>{saving ? "SAVING…" : "SAVE"}</button>
              </div>
              <details className="response-guide">
                <summary>查看应对刺激反应动作编号与程度分级</summary>
                <div className="guide-grid">
                  <div>
                    <h4>应对刺激反应动作编号</h4>
                    <div className="guide-table-wrap"><table><thead><tr><th>编号</th><th>动作</th><th>英文</th><th>定义</th></tr></thead><tbody>{responseActions.map((action) => <tr key={action.code}><td>{action.code}</td><td>{action.zh}</td><td>{action.en}</td><td>{action.definition}</td></tr>)}</tbody></table></div>
                  </div>
                  <div>
                    <h4>反应动作程度分级</h4>
                    <div className="guide-table-wrap"><table><thead><tr><th>评分</th><th>反应等级</th><th>判定标准</th><th>典型表现</th></tr></thead><tbody>{responseDegrees.map((degree) => <tr key={degree.score}><td>{degree.score}</td><td>{degree.level}</td><td>{degree.criteria}</td><td>{degree.example}</td></tr>)}</tbody></table></div>
                  </div>
                </div>
              </details>
            </div>
          </section>
        </section>
      </section>
      <footer><span>EXP. RECORDER / LOCAL CONTROL PLANE</span><span>SQLite · SCPI · USB SERIAL</span></footer>
    </main>
  );
}
