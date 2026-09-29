"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import type { RecorderContext } from "@/app/use-recorder";
import type { ExperimentPlan } from "@/app/types";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/circo/primitives";

const status = (plan: ExperimentPlan) => plan.completed_trial_count >= plan.trial_count ? "Completed" : plan.completed_trial_count > 0 ? "In Progress" : "Pending";
const statusTone = (plan: ExperimentPlan): "success" | "warning" | "neutral" => status(plan) === "Completed" ? "success" : status(plan) === "In Progress" ? "warning" : "neutral";

const columns: DataTableColumn<ExperimentPlan>[] = [
  { key: "id", header: "ID", cell: (row) => row.plan_id, searchValue: (row) => row.plan_id },
  { key: "subject", header: "Subject", cell: (row) => <strong>{row.subject_id}</strong>, searchValue: (row) => row.subject_id },
  { key: "positions", header: "Position Pair", cell: (row) => row.stimulation_position, searchValue: (row) => row.stimulation_position },
  { key: "waveform", header: "Waveform", cell: (row) => row.stimulation_waveform, searchValue: (row) => row.stimulation_waveform },
  { key: "frequency", header: "Frequency", cell: (row) => `${row.stimulation_frequency_hz} Hz`, sortValue: (row) => row.stimulation_frequency_hz, searchValue: (row) => row.stimulation_frequency_hz },
  { key: "trials", header: "Progress", cell: (row) => `${row.completed_trial_count}/${row.trial_count}`, sortValue: (row) => row.completed_trial_count / row.trial_count, searchValue: (row) => `${row.completed_trial_count} ${row.trial_count}` },
  { key: "status", header: "Status", cell: (row) => <Badge tone={statusTone(row)}>{status(row)}</Badge>, searchValue: status },
];

function PlanInfo({ plan }: { plan: ExperimentPlan }) {
  return <dl className="grid gap-2 text-sm">
    <div><dt className="text-xs text-zinc-500">Subject</dt><dd className="mt-1 font-medium">{plan.subject_id}</dd></div>
    <div><dt className="text-xs text-zinc-500">Position Pair</dt><dd className="mt-1">{plan.stimulation_position}</dd></div>
    <div><dt className="text-xs text-zinc-500">Signal</dt><dd className="mt-1">{plan.stimulation_waveform} · {plan.stimulation_frequency_hz} Hz · {plan.stimulation_duty_cycle_pct}%</dd></div>
    <div><dt className="text-xs text-zinc-500">Levels</dt><dd className="mt-1">{plan.stimulation_high_level_v} / {plan.stimulation_low_level_v} V</dd></div>
    <div><dt className="text-xs text-zinc-500">Timing</dt><dd className="mt-1">{plan.stimulation_duration_s}s · {plan.stimulation_count} pulses · {plan.stimulation_interval_s}s interval</dd></div>
    <div><dt className="text-xs text-zinc-500">Progress</dt><dd className="mt-1"><Badge tone={statusTone(plan)}>{plan.completed_trial_count}/{plan.trial_count} · {status(plan)}</Badge></dd></div>
  </dl>;
}

export function ExperimentPlansPanel({ ctx }: { ctx: RecorderContext }) {
  const { managedExperimentId, experimentPlans, planEditorOpen, planEditorId, planDraft, subjects, positions, defaultConfig, symmetricPlanDraft, setPlanDraft, setPlanEditorOpen, setPlanEditorId, editExperimentPlan, deleteExperimentPlan, saveExperimentPlan } = ctx;

  const addPlan = () => {
    setPlanEditorId(null);
    setPlanDraft({ subject_ids: [], stimulation_position_id: "", stimulation_position_2_id: "", stimulation_waveform: defaultConfig.waveform, stimulation_high_level_v: defaultConfig.high_level_v, stimulation_low_level_v: defaultConfig.low_level_v, stimulation_duty_cycle_pct: defaultConfig.duty_cycle_pct, stimulation_frequency_hz: defaultConfig.frequency_hz, stimulation_duration_s: defaultConfig.duration_s, stimulation_count: defaultConfig.count, stimulation_interval_s: defaultConfig.interval_s, trial_count: "1" });
    setPlanEditorOpen(true);
  };

  return <>
    <Card>
      <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-base font-semibold">Experiment Plans</h2><p className="mt-1 text-sm text-zinc-500">{experimentPlans.length} plan{experimentPlans.length === 1 ? "" : "s"}</p></div><Button onClick={addPlan} disabled={!managedExperimentId}><PlusIcon className="size-4" />Add Plan</Button></div>
      <DataTable
        rows={experimentPlans}
        columns={columns}
        getRowId={(plan) => plan.plan_id}
        getInfoTitle={(plan) => `Plan ${plan.plan_id}`}
        getSearchText={(plan) => `${plan.plan_id} ${plan.subject_id} ${plan.stimulation_position} ${plan.stimulation_waveform} ${status(plan)}`}
        searchPlaceholder="Search plans by subject, position, waveform, or status..."
        emptyTitle={managedExperimentId ? "No plans" : "No experiment selected"}
        emptyDescription={managedExperimentId ? "Add a stimulation plan for this experiment." : "Select an experiment before managing plans."}
        renderInfo={(plan) => <PlanInfo plan={plan} />}
        onUpdate={editExperimentPlan}
        onDelete={(plan) => deleteExperimentPlan(plan.plan_id)}
      />
    </Card>

    <Dialog open={planEditorOpen} title={planEditorId === null ? "Add Experiment Plan" : "Update Experiment Plan"} closeLabel="Close" onClose={() => setPlanEditorOpen(false)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveExperimentPlan(); }}>
        <Field label="Subjects" hint={planEditorId === null ? "You can select multiple subjects." : "Select one subject when editing a single plan."}><div className="max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 text-sm">{subjects.map((subject) => <label key={subject.subject_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"><input type="checkbox" disabled={planEditorId !== null && planDraft.subject_ids.length > 0 && !planDraft.subject_ids.includes(subject.subject_id)} checked={planDraft.subject_ids.includes(subject.subject_id)} onChange={(event) => setPlanDraft((current) => ({ ...current, subject_ids: event.target.checked ? [...current.subject_ids, subject.subject_id] : current.subject_ids.filter((id) => id !== subject.subject_id) }))} /><span>{subject.subject_id}</span></label>)}</div></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label={symmetricPlanDraft ? "Position 1 (unordered)" : "Position (red)"}><Select value={planDraft.stimulation_position_id} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_position_id: event.target.value }))}><option value="">Select a position...</option>{positions.map((position) => <option key={position.position_id} value={position.position_id}>{position.code}</option>)}</Select></Field><Field label={symmetricPlanDraft ? "Position 2 (unordered)" : "Position (black)"}><Select value={planDraft.stimulation_position_2_id} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_position_2_id: event.target.value }))}><option value="">Select a position...</option>{positions.map((position) => <option key={position.position_id} value={position.position_id}>{position.code}</option>)}</Select></Field></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trial Count"><Input type="number" min="1" step="1" value={planDraft.trial_count} onChange={(event) => setPlanDraft((current) => ({ ...current, trial_count: event.target.value }))} /></Field>
          <Field label="Waveform"><Select value={planDraft.stimulation_waveform} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_waveform: event.target.value }))}><option>SQUARE</option><option>PULSE</option><option>SINE</option><option>RAMP</option></Select></Field>
          <Field label="High Level (V)"><Input type="number" value={planDraft.stimulation_high_level_v} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_high_level_v: event.target.value }))} /></Field>
          <Field label="Low Level (V)"><Input type="number" value={planDraft.stimulation_low_level_v} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_low_level_v: event.target.value }))} /></Field>
          <Field label="Duty Cycle (%)"><Input type="number" value={planDraft.stimulation_duty_cycle_pct} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_duty_cycle_pct: event.target.value }))} /></Field>
          <Field label="Frequency (Hz)"><Input type="number" value={planDraft.stimulation_frequency_hz} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_frequency_hz: event.target.value }))} /></Field>
          <Field label="Stimulation Duration (s)"><Input type="number" value={planDraft.stimulation_duration_s} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_duration_s: event.target.value }))} /></Field>
          <Field label="Pulse Count"><Input type="number" min="1" value={planDraft.stimulation_count} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_count: event.target.value }))} /></Field>
          <Field label="Stimulation Interval (s)"><Input type="number" min="0" value={planDraft.stimulation_interval_s} onChange={(event) => setPlanDraft((current) => ({ ...current, stimulation_interval_s: event.target.value }))} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPlanEditorOpen(false)}>Cancel</Button><Button type="submit" disabled={!managedExperimentId || planDraft.subject_ids.length === 0}>{planEditorId === null ? "Add Plan" : "Save Changes"}</Button></div>
      </form>
    </Dialog>
  </>;
}
