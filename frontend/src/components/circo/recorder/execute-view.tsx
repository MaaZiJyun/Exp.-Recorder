"use client";

import {
  ArrowPathIcon,
  Cog6ToothIcon,
  QueueListIcon,
} from "@heroicons/react/20/solid";
import { Badge, Button, Dialog, EmptyState, Field, Input, Select } from "@/components/circo/ui";
import { responseActions, responseDegrees } from "@/app/constants";
import type { RecorderContext } from "@/app/use-recorder";
import { Notice } from "./notice";
import { StatusDot } from "./status-dot";
import { TrialPositionPreview } from "./trial-position-preview";

export function ExecuteView({ ctx }: { ctx: RecorderContext }) {
  const {
    devices,
    task,
    experiments,
    runExperimentId,
    subjects,
    form,
    connecting,
    running,
    ready,
    pendingTrial,
    saving,
    annotation,
    setAnnotation,
    cameraMirrored,
    setCameraMirrored,
    cameraFlipped,
    setCameraFlipped,
    previewTick,
    positions,
    runPositions,
    runPositionOne,
    runPositionTwo,
    runPositionPreview,
    activeExperimentPlan,
    activePlanProgress,
    experimentPlans,
    selectedPlanId,
    taskListOpen,
    setTaskListOpen,
    configurationOpen,
    setConfigurationOpen,
    notice,
    setNotice,
    connect,
    setField,
    setForm,
    selectRunExperiment,
    lookupSubject,
    subjectStatus,
    startTrial,
    savePendingTrial,
    discardPendingTrial,
    selectExperimentPlan,
    logWindowRef,
  } = ctx;

  return (
    <>
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
                <Badge tone={devices?.camera_connected ? "success" : "neutral"}>
                  {devices?.camera_connected ? "ONLINE" : "OFFLINE"}
                </Badge>
              </div>
            </div>
          </div>

          {devices?.mock && <Badge tone="warning">SIMULATION MODE</Badge>}
          <Field label="EXPERIMENT" className="min-w-50 flex-1 sm:flex-none">
            <Select
              value={runExperimentId}
              onChange={(event) => void selectRunExperiment(event.target.value)}
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
                const selectedSubject = subjects.find(
                  (subject) => subject.subject_id === subjectId,
                );
                if (
                  selectedSubject &&
                  subjectStatus(selectedSubject) !== "正常"
                ) {
                  setNotice({
                    kind: "error",
                    text: `警告：${selectedSubject.subject_id} 当前状态为${subjectStatus(selectedSubject)}。`,
                  });
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

      <Notice notice={notice} onClose={() => setNotice(null)} />

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

      <Dialog open={taskListOpen} title="选择实验任务" closeLabel="关闭" onClose={() => setTaskListOpen(false)}>
        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <span>可以自由选择任意未完成的任务，不限制执行顺序。</span>
            <strong>{experimentPlans.reduce((sum, plan) => sum + plan.completed_trial_count, 0)} / {experimentPlans.reduce((sum, plan) => sum + plan.trial_count, 0)}</strong>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {experimentPlans.length ? <div className="grid gap-2">{experimentPlans.map((plan) => {
              const completed = plan.completed_trial_count >= plan.trial_count;
              const selected = plan.plan_id === selectedPlanId;
              const symmetric = Math.abs(Math.abs(plan.stimulation_high_level_v) - Math.abs(plan.stimulation_low_level_v)) < 1e-9 && Math.abs(plan.stimulation_duty_cycle_pct - 50) < 1e-9;
              return <button type="button" key={plan.plan_id} disabled={completed || running} onClick={() => { selectExperimentPlan(plan); setTaskListOpen(false); }} className={`w-full rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${selected ? "border-blue-500 bg-blue-50" : completed ? "border-emerald-200 bg-emerald-50 text-zinc-500" : "border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"}`}>
                <div className="flex items-center justify-between gap-3"><strong>{completed ? "✓" : selected ? "▶" : "○"} {plan.subject_id} · {plan.stimulation_position}</strong><span>{plan.completed_trial_count}/{plan.trial_count}</span></div>
                <p className="mt-1 text-xs text-zinc-500">{symmetric ? `点位 ${plan.red_position_code} + ${plan.black_position_code}（无顺序）` : `红 ${plan.red_position_code} · 黑 ${plan.black_position_code}`} · {plan.stimulation_waveform} · {plan.stimulation_low_level_v}→{plan.stimulation_high_level_v} V · {plan.stimulation_frequency_hz} Hz</p>
              </button>;
            })}</div> : <EmptyState title="暂无实验任务" description="请先在实验页面添加 Plan。" />}
          </div>
        </div>
      </Dialog>

      <section className="dashboard-grid execute-layout">
        <aside className="left-column">
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
                  <span className="playback-pane-label">
                    VIDEO PLAYBACK
                  </span>
                  <video
                    key={pendingTrial.video_id}
                    style={{
                      transform:
                        `${cameraMirrored ? "scaleX(-1) " : ""}${cameraFlipped ? "rotate(90deg)" : ""}`.trim() ||
                        "none",
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
                    alt={
                      running ? "实验录像实时画面" : "摄像机空闲实时预览"
                    }
                    style={{
                      transform:
                        `${cameraMirrored ? "scaleX(-1) " : ""}${cameraFlipped ? "rotate(90deg)" : ""}`.trim() ||
                        "none",
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
        </aside>

        <section className="right-column">
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
              <div className="flex w-full gap-2">
                <Button
                  className="min-h-12 flex-1"
                  style={activeExperimentPlan ? { background: `linear-gradient(90deg, #2563eb 0%, #2563eb ${activePlanProgress}%, #18181b ${activePlanProgress}%, #18181b 100%)` } : undefined}
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
                  {running ? "TRIAL IN PROGRESS" : activeExperimentPlan ? `START TRIAL · ${activeExperimentPlan.completed_trial_count}/${activeExperimentPlan.trial_count}` : "START TRIAL"}
                </Button>
                <Button variant="secondary" className="min-h-12 shrink-0 px-3" title="选择实验任务" aria-label="选择实验任务" onClick={() => setTaskListOpen(true)} disabled={!runExperimentId || running}>
                  <QueueListIcon className="size-5" />
                </Button>
              </div>
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
        </section>
      </section>

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
              <div className="log-line" key={`${log.timestamp}-${index}`}>
                <time>{log.timestamp.slice(11, 19)}</time>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
