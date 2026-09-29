"use client";

import {
  ArrowPathIcon,
  Cog6ToothIcon,
  QueueListIcon,
} from "@heroicons/react/20/solid";
import { Badge, Button, Dialog, EmptyState, Field, Input, Select } from "@/components/circo/primitives";
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
      <section id="signal-generation" className="scroll-mt-6 flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 xl:flex-row xl:items-end xl:justify-between xl:px-5">
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
                  subjectStatus(selectedSubject) !== "Normal"
                ) {
                  setNotice({
                    kind: "error",
                    text: `Warning: ${selectedSubject.subject_id} is currently ${subjectStatus(selectedSubject)}.`,
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
            {connecting ? "Connecting…" : "Reconnect"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfigurationOpen(true)}
            disabled={running}
          >
            <Cog6ToothIcon className="size-4" />
            Configure
          </Button>
        </div>
      </section>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Dialog
        open={configurationOpen}
        title="Trial Parameters"
        closeLabel="Close"
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
            <Button onClick={() => setConfigurationOpen(false)}>Done</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={taskListOpen} title="Select Experiment Task" closeLabel="Close" onClose={() => setTaskListOpen(false)}>
        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <span>Select any unfinished task in any order.</span>
            <strong>{experimentPlans.reduce((sum, plan) => sum + plan.completed_trial_count, 0)} / {experimentPlans.reduce((sum, plan) => sum + plan.trial_count, 0)}</strong>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {experimentPlans.length ? <div className="grid gap-2">{experimentPlans.map((plan) => {
              const completed = plan.completed_trial_count >= plan.trial_count;
              const selected = plan.plan_id === selectedPlanId;
              const symmetric = Math.abs(Math.abs(plan.stimulation_high_level_v) - Math.abs(plan.stimulation_low_level_v)) < 1e-9 && Math.abs(plan.stimulation_duty_cycle_pct - 50) < 1e-9;
              return <button type="button" key={plan.plan_id} disabled={completed || running} onClick={() => { selectExperimentPlan(plan); setTaskListOpen(false); }} className={`w-full rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${selected ? "border-blue-500 bg-blue-50" : completed ? "border-emerald-200 bg-emerald-50 text-zinc-500" : "border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"}`}>
                <div className="flex items-center justify-between gap-3"><strong>{completed ? "✓" : selected ? "▶" : "○"} {plan.subject_id} · {plan.stimulation_position}</strong><span>{plan.completed_trial_count}/{plan.trial_count}</span></div>
                <p className="mt-1 text-xs text-zinc-500">{symmetric ? `Positions ${plan.red_position_code} + ${plan.black_position_code} (unordered)` : `Red ${plan.red_position_code} · Black ${plan.black_position_code}`} · {plan.stimulation_waveform} · {plan.stimulation_low_level_v}→{plan.stimulation_high_level_v} V · {plan.stimulation_frequency_hz} Hz</p>
              </button>;
            })}</div> : <EmptyState title="No experiment tasks" description="Add a plan on the Experiments page first." />}
          </div>
        </div>
      </Dialog>

      <section id="live-control" className="mt-6 grid scroll-mt-6 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <aside className="min-w-0">
          {pendingTrial && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">
                    {pendingTrial.subject_id} · Trial{" "}
                    {pendingTrial.trial_no}
                  </h3>
                </div>
              </div>
              <div className="grid items-end gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-500">
                    LATENCY <em>s</em>
                  </span>
                  <input className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
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
                <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-500">ACTION CODE</span>
                  <select className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
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
                <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-500">DEGREE</span>
                  <select className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
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
          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400">LIVE</span>
                <h2 className="text-sm font-semibold">
                  {pendingTrial
                    ? "Annotation video"
                    : running
                      ? "Recording monitor"
                      : "Camera preview"}
                </h2>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-medium ${running ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}
              >
                <i className={`size-1.5 rounded-full ${running ? "animate-pulse bg-red-500" : "bg-zinc-400"}`} />
                {pendingTrial
                  ? "PLAYBACK"
                  : running
                    ? "REC"
                    : "IDLE · LIVE"}
              </div>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  className={`min-h-8 rounded-md border px-2 text-xs ${cameraMirrored ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`}
                  onClick={() => setCameraMirrored((value) => !value)}
                  title="Mirror horizontally"
                >
                  Mirror
                </button>
                <button
                  type="button"
                  className={`min-h-8 rounded-md border px-2 text-xs ${cameraFlipped ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`}
                  onClick={() => setCameraFlipped((value) => !value)}
                  title="Rotate 90 degrees clockwise"
                >
                  Rotate 90°
                </button>
              </div>
            </div>
            {pendingTrial ? (
              <div className="grid gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-2">
                <div className="min-w-0 bg-zinc-50 p-3">
                  <span className="mb-2 block text-[10px] font-medium tracking-wide text-zinc-500">
                    STIMULATION POSITION ·{" "}
                    {pendingTrial.stimulation_position}
                  </span>
                  <TrialPositionPreview
                    trial={pendingTrial}
                    positions={positions}
                  />
                </div>
                <div className="min-w-0 bg-zinc-50 p-3">
                  <span className="mb-2 block text-[10px] font-medium tracking-wide text-zinc-500">
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
                    className="block aspect-[4/3] w-full bg-zinc-100 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="relative grid aspect-video min-h-0 place-items-center overflow-hidden border border-zinc-800 bg-zinc-950 [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:object-contain">
                {devices?.camera_connected && !devices.mock ? (
                  <img
                    src={`/backend/camera/frame?t=${previewTick}`}
                    alt={
                      running ? "Live experiment recording" : "Idle camera preview"
                    }
                    style={{
                      transform:
                        `${cameraMirrored ? "scaleX(-1) " : ""}${cameraFlipped ? "rotate(90deg)" : ""}`.trim() ||
                        "none",
                    }}
                  />
                ) : (
                  <div className="text-center text-zinc-500">
                    <span>◉</span>
                    <p>
                      {devices?.mock ? "SIMULATION MODE" : "CAMERA OFFLINE"}
                    </p>
                    <small>
                      {devices?.mock
                        ? "The live feed appears after a physical device connects"
                        : "Connect a XIAO ESP32S3 to display the live feed"}
                    </small>
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>

        <section className="min-w-0">
          <div className="grid gap-5">
            {pendingTrial ? (
              <div className="grid min-h-12 grid-cols-2 gap-2">
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
                <Button variant="secondary" className="min-h-12 shrink-0 px-3" title="Select experiment task" aria-label="Select experiment task" onClick={() => setTaskListOpen(true)} disabled={!runExperimentId || running}>
                  <QueueListIcon className="size-5" />
                </Button>
              </div>
            )}
            <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="POSITION 1" hint="The two positions must be different.">
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
                      ? "Codes are joined in order when saved."
                      : "Create positions under Filters > Positions first."
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
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-medium tracking-wide text-zinc-500">
                    POSITION PREVIEW · {runPositionOne?.code} +{" "}
                    {runPositionTwo?.code}
                  </p>
                  <div className="relative w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                    <img
                      src={runPositionPreview.image}
                      alt="Selected stimulation positions"
                      className="block h-auto w-full"
                    />
                    {[runPositionOne, runPositionTwo].map(
                      (position) =>
                        position?.mark && (
                          <span
                            key={position.position_id}
                            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${position.mark.x * 100}%`,
                              top: `${position.mark.y * 100}%`,
                            }}
                          >
                            <i className="block size-4 rounded-full border-2 border-white bg-red-500 shadow" />
                            <b className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-zinc-950 px-1.5 py-1 text-[10px] leading-none text-white shadow">{position.code}</b>
                          </span>
                        ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid min-h-44 flex-1 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center text-xs text-zinc-500">
                  Select two marked positions on the same image to show a preview
                </div>
              )}
            </section>
          </div>
        </section>
      </section>

      <section id="experiment-logs" className="mt-5 grid scroll-mt-6 gap-5 rounded-xl bg-zinc-950 p-5 text-zinc-100 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium tracking-[.15em] text-zinc-500">CURRENT RUN</p>
            <h2 className="mt-1 text-xl font-medium">
              {running
                ? `Trial ${task.result?.trial_no ?? "in progress"}`
                : task.status === "IDLE"
                  ? "Standing by"
                  : task.status}
            </h2>
          </div>
          <div className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-medium text-zinc-300">
            {task.status}
          </div>
        </div>
        <div className="h-1 overflow-hidden bg-zinc-800 md:col-start-1">
          <span
            className={`block h-full bg-white ${
              running
                ? "w-2/5 animate-pulse"
                : task.status === "COMPLETED"
                  ? "w-full"
                  : "w-0"
            }`}
          />
        </div>
        <div
          className="max-h-48 min-h-32 overflow-y-auto font-mono text-xs leading-6 text-zinc-300 md:col-start-2 md:row-span-2 md:row-start-1"
          ref={logWindowRef}
          role="log"
          aria-live="polite"
        >
          {task.logs.length === 0 ? (
            <p className="text-zinc-600">System messages will appear here.</p>
          ) : (
            task.logs.map((log, index) => (
              <div className="grid grid-cols-[5rem_1fr] gap-3" key={`${log.timestamp}-${index}`}>
                <time className="text-zinc-600">{log.timestamp.slice(11, 19)}</time>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
