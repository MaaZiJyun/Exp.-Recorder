"use client";

import { Button, Dialog, EmptyState } from "@/components/circo/ui";
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
                <Button onClick={saveAnnotation} disabled={!selected || saving}>
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
    </>
  );
}
