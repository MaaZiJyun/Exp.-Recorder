"use client";

import { Button, Dialog, EmptyState } from "@/components/circo/primitives";
import { responseActions, responseDegrees } from "@/app/constants";
import { actionLabel, degreeLabel } from "@/app/lib";
import type { RecorderContext } from "@/app/use-recorder";
import { TrialPositionPreview } from "./trial-position-preview";

export function TrialsPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    managedExperiment,
    trials,
    positions,
    editingId,
    rowEdit,
    rowSaving,
    deletingId,
    selected,
    annotation,
    saving,
    exporting,
    clearing,
    running,
    setRowField,
    saveRowEdit,
    setEditingId,
    setRowEdit,
    deleteRow,
    beginRowEdit,
    chooseTrial,
    setSelected,
    setAnnotation,
    saveAnnotation,
    exportCsv,
    clearData,
  } = ctx;

  return (
    <>
      <section className="flex min-h-[470px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2>
              {managedExperiment
                ? `${managedExperiment.title} / Trials`
                : "Select an Experiment"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              className="min-h-9 px-3 text-xs"
              onClick={exportCsv}
              disabled={exporting || !managedExperiment}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              variant="danger"
              className="min-h-9 px-3 text-xs"
              onClick={clearData}
              disabled={clearing || running}
            >
              {clearing ? "Clearing…" : "Clear Data"}
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
                  <tr key={trial.trial_id} className="bg-zinc-50 align-top [&_input]:h-8 [&_input]:min-w-18 [&_input]:rounded-md [&_input]:border [&_input]:border-zinc-200 [&_input]:bg-white [&_input]:px-2 [&_input]:text-xs [&_select]:h-8 [&_select]:rounded-md [&_select]:border [&_select]:border-zinc-200 [&_select]:bg-white [&_select]:px-2 [&_select]:text-xs">
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
                      <div className="grid w-68 grid-cols-2 gap-1 [&>select]:col-span-2">
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
                      <div className="grid w-36 gap-1">
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
                      <div className="flex gap-1.5">
                        <Button
                          className="min-h-8 px-2 text-xs"
                          onClick={() => void saveRowEdit()}
                          disabled={rowSaving}
                        >
                          {rowSaving ? "…" : "Save"}
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
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={trial.trial_id}
                    onClick={() => chooseTrial(trial)}
                    className={
                      selected?.trial_id === trial.trial_id ? "selected" : ""
                    }
                  >
                    <td>
                      <strong>T{String(trial.trial_no).padStart(3, "0")}</strong>
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
                    <td>{trial.experiment_timestamp?.slice(0, 16) ?? "—"}</td>
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
                          <strong>{actionLabel(trial.response_action)}</strong>
                          <small>{degreeLabel(trial.response_degree)}</small>
                        </>
                      ) : (
                        <span className="text-zinc-400">Not tagged</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <Button
                          variant="secondary"
                          className="min-h-8 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginRowEdit(trial);
                          }}
                          disabled={running || editingId !== null}
                        >
                          Edit
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
                          {deletingId === trial.trial_id ? "…" : "Delete"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {trials.length === 0 && (
                <tr>
                  <td className="h-40 text-center text-zinc-500" colSpan={8}>
                    No trial records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={selected ? "border-t border-zinc-200 bg-zinc-50 p-5" : "hidden"}>
          {selected ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="mb-1 font-mono text-[9px] font-semibold tracking-widest text-zinc-500">RESPONSE ANNOTATION</p>
                  <h3 className="text-sm font-semibold">
                    {selected
                      ? `${selected.subject_id} · Trial ${selected.trial_no}`
                      : "Select a trial"}
                  </h3>
                </div>
                {selected && (
                  <button className="grid size-8 place-items-center rounded-md text-xl text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950" onClick={() => setSelected(null)}>×</button>
                )}
              </div>
              <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-500">
                    LATENCY <em>s</em>
                  </span>
                  <input className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
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
                <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-500">ACTION CODE</span>
                  <select className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
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
                <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-500">DEGREE</span>
                  <select className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
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
                <Button onClick={saveAnnotation} disabled={!selected || saving}>
                  {saving ? "Saving…" : "Save Annotation"}
                </Button>
              </div>
              <details className="mt-4 border-t border-zinc-200 pt-3 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-zinc-700">View response action codes and severity levels</summary>
                <div className="grid gap-4 pt-4">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Stimulus Response Action Codes</h4>
                    <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white">
                      <table>
                        <thead>
                          <tr>
                            <th>CODE</th>
                            <th>ACTION</th>
                            <th>ENGLISH</th>
                            <th>DEFINITION</th>
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
                    <h4 className="mb-2 text-sm font-semibold">Response Severity Levels</h4>
                    <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white">
                      <table>
                        <thead>
                          <tr>
                            <th>SCORE</th>
                            <th>LEVEL</th>
                            <th>CRITERIA</th>
                            <th>TYPICAL BEHAVIOR</th>
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
              title="Select a Trial"
              description="Select a record from the table above to view its video and enter a response annotation."
            />
          )}
        </div>
      </section>

      <Dialog
        open={selected !== null}
        title={
          selected
            ? `Playback · ${selected.subject_id} · Trial ${selected.trial_no}`
            : "Playback"
        }
        closeLabel="Close Playback"
        onClose={() => setSelected(null)}
        size="wide"
      >
        {selected && (
          <div className="grid items-stretch gap-4 md:grid-cols-[minmax(240px,0.55fr)_minmax(0,1fr)]">
            <section className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <span className="mb-2 block font-mono text-[10px] font-semibold tracking-wider text-zinc-500">
                STIMULATION POSITION · {selected.stimulation_position}
              </span>
              <TrialPositionPreview
                trial={selected}
                positions={positions}
                showDetails
              />
            </section>
            <section className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <span className="mb-2 block font-mono text-[10px] font-semibold tracking-wider text-zinc-500">VIDEO PLAYBACK</span>
              <video
                className="block aspect-[4/3] w-full bg-zinc-100 object-contain"
                key={selected.trial_id}
                controls
                preload="metadata"
                src={`/backend/trials/${selected.trial_id}/video`}
              />
            </section>
          </div>
        )}
      </Dialog>
    </>
  );
}
