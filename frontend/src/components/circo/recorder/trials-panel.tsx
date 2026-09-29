"use client";

import type { RecorderContext } from "@/app/use-recorder";
import type { Trial } from "@/app/types";
import { responseActions, responseDegrees } from "@/app/constants";
import { actionLabel, degreeLabel } from "@/app/lib";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/circo/primitives";
import { TrialPositionPreview } from "./trial-position-preview";

const trialKey = (trial: Trial) => trial.trial_id ?? `${trial.subject_id}-${trial.trial_no}-${trial.experiment_timestamp}`;
const statusTone = (trial: Trial): "success" | "warning" | "danger" | "neutral" => trial.status === "COMPLETED" ? "success" : trial.status === "FAILED" ? "danger" : trial.status === "ABORTED" ? "warning" : "neutral";

const columns: DataTableColumn<Trial>[] = [
  { key: "trial", header: "Trial", cell: (row) => <strong>T{String(row.trial_no).padStart(3, "0")}</strong>, sortValue: (row) => row.trial_no, searchValue: (row) => `${row.trial_no} ${row.trial_id ?? ""}` },
  { key: "subject", header: "Subject", cell: (row) => row.subject_id, searchValue: (row) => row.subject_id },
  { key: "stimulus", header: "Stimulus", cell: (row) => `${row.stimulation_waveform ?? "SQUARE"} · ${row.stimulation_frequency_hz} Hz`, searchValue: (row) => `${row.stimulation_waveform} ${row.stimulation_frequency_hz}` },
  { key: "position", header: "Position", cell: (row) => row.stimulation_position || "—", searchValue: (row) => row.stimulation_position },
  { key: "recorded", header: "Recorded", cell: (row) => row.experiment_timestamp?.slice(0, 16) || "—", sortValue: (row) => row.experiment_timestamp ? new Date(row.experiment_timestamp) : null, searchValue: (row) => row.experiment_timestamp },
  { key: "status", header: "Status", cell: (row) => <Badge tone={statusTone(row)}>{row.status}</Badge>, searchValue: (row) => row.status },
  { key: "response", header: "Response", cell: (row) => row.response_action !== null ? <span>{actionLabel(row.response_action)}<small className="ml-2 text-zinc-500">{degreeLabel(row.response_degree)}</small></span> : <span className="text-zinc-400">Not tagged</span>, searchValue: (row) => `${actionLabel(row.response_action) ?? ""} ${degreeLabel(row.response_degree) ?? ""}` },
];

function TrialInfo({ trial }: { trial: Trial }) {
  return <dl className="grid gap-2 text-sm">
    <div><dt className="text-xs text-zinc-500">Trial</dt><dd className="mt-1 font-medium">T{String(trial.trial_no).padStart(3, "0")} · Record #{trial.trial_id}</dd></div>
    <div><dt className="text-xs text-zinc-500">Subject</dt><dd className="mt-1">{trial.subject_id}</dd></div>
    <div><dt className="text-xs text-zinc-500">Stimulus</dt><dd className="mt-1">{trial.stimulation_waveform ?? "SQUARE"} · {trial.stimulation_frequency_hz} Hz · {trial.stimulation_low_level_v ?? 0} → {trial.stimulation_high_level_v ?? trial.stimulation_voltage_v} V · {trial.stimulation_duty_cycle_pct ?? 50}%</dd></div>
    <div><dt className="text-xs text-zinc-500">Position</dt><dd className="mt-1">{trial.stimulation_position || "—"}</dd></div>
    <div><dt className="text-xs text-zinc-500">Recorded</dt><dd className="mt-1">{trial.experiment_timestamp || "—"}</dd></div>
    <div><dt className="text-xs text-zinc-500">Status</dt><dd className="mt-1"><Badge tone={statusTone(trial)}>{trial.status}</Badge></dd></div>
    <div><dt className="text-xs text-zinc-500">Response</dt><dd className="mt-1">{actionLabel(trial.response_action) || "Not tagged"} {degreeLabel(trial.response_degree)}</dd></div>
  </dl>;
}

export function TrialsPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    managedExperiment, trials, positions, editingId, rowEdit, rowSaving, deletingId,
    selected, annotation, saving, exporting, clearing, running,
    setRowField, saveRowEdit, setEditingId, setRowEdit, deleteRow, beginRowEdit,
    chooseTrial, setSelected, setAnnotation, saveAnnotation, exportCsv, clearData,
  } = ctx;

  return <>
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-base font-semibold">{managedExperiment ? `${managedExperiment.title} / Trials` : "Trials"}</h2><p className="mt-1 text-sm text-zinc-500">{trials.length} trial{trials.length === 1 ? "" : "s"}</p></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={exportCsv} disabled={exporting || !managedExperiment}>{exporting ? "Exporting..." : "Export CSV"}</Button><Button variant="danger" onClick={clearData} disabled={clearing || running}>{clearing ? "Clearing..." : "Clear Data"}</Button></div>
      </div>
      <DataTable
        rows={trials}
        columns={columns}
        getRowId={trialKey}
        getInfoTitle={(trial) => `${trial.subject_id} · Trial ${trial.trial_no}`}
        getSearchText={(trial) => `${trial.trial_id ?? ""} ${trial.trial_no} ${trial.subject_id} ${trial.stimulation_waveform} ${trial.stimulation_frequency_hz} ${trial.stimulation_position} ${trial.status} ${actionLabel(trial.response_action) ?? ""}`}
        searchPlaceholder="Search trials by subject, stimulus, position, status, or response..."
        emptyTitle={managedExperiment ? "No trial records" : "No experiment selected"}
        emptyDescription={managedExperiment ? "No trials have been recorded for this experiment." : "Select an experiment to review its trials."}
        renderInfo={(trial) => <TrialInfo trial={trial} />}
        onRead={chooseTrial}
        onUpdate={beginRowEdit}
        onDelete={deleteRow}
        isUpdateDisabled={() => running || editingId !== null}
        isDeleteDisabled={(trial) => running || deletingId === trial.trial_id || editingId !== null}
      />
    </Card>

    <Dialog open={editingId !== null && rowEdit !== null} title={editingId !== null ? `Update Trial #${editingId}` : "Update Trial"} closeLabel="Close" onClose={() => { if (!rowSaving) { setEditingId(null); setRowEdit(null); } }} size="wide">
      {rowEdit ? <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveRowEdit(); }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Trial Number"><Input type="number" min="1" value={rowEdit.trial_no} onChange={(event) => setRowField("trial_no", event.target.value)} /></Field>
          <Field label="Subject ID"><Input value={rowEdit.subject_id} onChange={(event) => setRowField("subject_id", event.target.value)} /></Field>
          <Field label="Recorded Timestamp"><Input value={rowEdit.experiment_timestamp} onChange={(event) => setRowField("experiment_timestamp", event.target.value)} /></Field>
          <Field label="Waveform"><Select value={rowEdit.stimulation_waveform} onChange={(event) => setRowField("stimulation_waveform", event.target.value)}><option>SQUARE</option><option>PULSE</option><option>SINE</option><option>RAMP</option></Select></Field>
          <Field label="Frequency (Hz)"><Input type="number" step="any" min="0.001" value={rowEdit.stimulation_frequency_hz} onChange={(event) => setRowField("stimulation_frequency_hz", event.target.value)} /></Field>
          <Field label="Duty Cycle (%)"><Input type="number" step="any" min="0.1" max="99.9" value={rowEdit.stimulation_duty_cycle_pct} onChange={(event) => setRowField("stimulation_duty_cycle_pct", event.target.value)} /></Field>
          <Field label="Low Level (V)"><Input type="number" step="any" value={rowEdit.stimulation_low_level_v} onChange={(event) => setRowField("stimulation_low_level_v", event.target.value)} /></Field>
          <Field label="High Level (V)"><Input type="number" step="any" value={rowEdit.stimulation_high_level_v} onChange={(event) => setRowField("stimulation_high_level_v", event.target.value)} /></Field>
          <Field label="Status"><Select value={rowEdit.status} onChange={(event) => setRowField("status", event.target.value)}><option>COMPLETED</option><option>FAILED</option><option>ABORTED</option></Select></Field>
          <Field label="Position 1"><Select value={rowEdit.stimulation_position_id} onChange={(event) => setRowField("stimulation_position_id", event.target.value)}><option value="">Select...</option>{positions.map((position) => <option key={position.position_id} value={position.position_id} disabled={String(position.position_id) === rowEdit.stimulation_position_2_id}>{position.code}</option>)}</Select></Field>
          <Field label="Position 2"><Select value={rowEdit.stimulation_position_2_id} onChange={(event) => setRowField("stimulation_position_2_id", event.target.value)}><option value="">Select...</option>{positions.map((position) => <option key={position.position_id} value={position.position_id} disabled={String(position.position_id) === rowEdit.stimulation_position_id}>{position.code}</option>)}</Select></Field>
          <Field label="Response Latency (s)"><Input type="number" min="0" step="any" value={rowEdit.response_latency_s} onChange={(event) => setRowField("response_latency_s", event.target.value)} /></Field>
          <Field label="Response Action"><Select value={rowEdit.response_action} onChange={(event) => setRowField("response_action", event.target.value)}><option value="">Not tagged</option>{responseActions.map((action) => <option key={action.code} value={action.code}>{action.code} · {action.en}</option>)}</Select></Field>
          <Field label="Response Degree"><Select value={rowEdit.response_degree} onChange={(event) => setRowField("response_degree", event.target.value)}><option value="">Not tagged</option>{responseDegrees.map((degree) => <option key={degree.score} value={degree.score}>{degree.score} · {degree.level}</option>)}</Select></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={rowSaving} onClick={() => { setEditingId(null); setRowEdit(null); }}>Cancel</Button><Button type="submit" disabled={rowSaving}>{rowSaving ? "Saving..." : "Save Trial"}</Button></div>
      </form> : null}
    </Dialog>

    <Dialog open={selected !== null} title={selected ? `Trial ${selected.trial_no} · ${selected.subject_id}` : "Trial Details"} closeLabel="Close" onClose={() => setSelected(null)} size="wide">
      {selected ? <div className="grid gap-5">
        <div className="grid items-stretch gap-4 md:grid-cols-[minmax(240px,0.55fr)_minmax(0,1fr)]">
          <section className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-3"><span className="mb-2 text-xs font-semibold text-zinc-500">STIMULATION POSITION · {selected.stimulation_position}</span><TrialPositionPreview trial={selected} positions={positions} showDetails /></section>
          <section className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-3"><span className="mb-2 text-xs font-semibold text-zinc-500">VIDEO PLAYBACK</span><video className="block aspect-[4/3] w-full bg-zinc-100 object-contain" key={selected.trial_id} controls preload="metadata" src={`/backend/trials/${selected.trial_id}/video`} /></section>
        </div>
        <section className="border-t border-zinc-200 pt-5">
          <h3 className="mb-4 text-sm font-semibold">Response Annotation</h3>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Latency (s)"><Input type="number" min="0" step="any" value={annotation.latency} onChange={(event) => setAnnotation({ ...annotation, latency: event.target.value })} /></Field>
            <Field label="Action Code"><Select value={annotation.action} onChange={(event) => setAnnotation({ ...annotation, action: event.target.value })}><option value="">Not tagged</option>{annotation.action && !responseActions.some((item) => item.code === annotation.action) ? <option value={annotation.action}>{annotation.action} (Legacy)</option> : null}{responseActions.map((action) => <option key={action.code} value={action.code}>{action.code} · {action.en}</option>)}</Select></Field>
            <Field label="Degree"><Select value={annotation.degree} onChange={(event) => setAnnotation({ ...annotation, degree: event.target.value })}><option value="">Not tagged</option>{responseDegrees.map((degree) => <option key={degree.score} value={degree.score}>{degree.score} · {degree.level}</option>)}</Select></Field>
            <Button onClick={saveAnnotation} disabled={saving}>{saving ? "Saving..." : "Save Annotation"}</Button>
          </div>
        </section>
      </div> : null}
    </Dialog>
  </>;
}
