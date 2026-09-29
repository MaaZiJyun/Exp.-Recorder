"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { Button, Dialog, Field, Input, Select } from "@/components/circo/primitives";
import type { RecorderContext } from "@/app/use-recorder";

export function ExperimentPlansPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    managedExperimentId,
    experimentPlans,
    planEditorOpen,
    planEditorId,
    planDraft,
    subjects,
    positions,
    defaultConfig,
    symmetricPlanDraft,
    setPlanDraft,
    setPlanEditorOpen,
    setPlanEditorId,
    editExperimentPlan,
    deleteExperimentPlan,
    saveExperimentPlan,
  } = ctx;

  return (
    <>
      <section className="min-h-[470px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4"><h2 className="text-base font-semibold">Experiment Plans</h2><Button onClick={() => { setPlanEditorId(null); setPlanDraft({ subject_ids: [], stimulation_position_id: "", stimulation_position_2_id: "", stimulation_waveform: defaultConfig.waveform, stimulation_high_level_v: defaultConfig.high_level_v, stimulation_low_level_v: defaultConfig.low_level_v, stimulation_duty_cycle_pct: defaultConfig.duty_cycle_pct, stimulation_frequency_hz: defaultConfig.frequency_hz, stimulation_duration_s: defaultConfig.duration_s, stimulation_count: defaultConfig.count, stimulation_interval_s: defaultConfig.interval_s, trial_count: "1" }); setPlanEditorOpen(true); }} disabled={!managedExperimentId}><PlusIcon className="size-4"/>Add Plan</Button></div>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>SUBJECT</th><th>POSITION PAIR</th><th>WAVEFORM</th><th>HIGH / LOW</th><th>DUTY CYCLE</th><th>FREQUENCY</th><th>DURATION / PULSES / INTERVAL</th><th>TRIALS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{experimentPlans.map((plan)=><tr key={plan.plan_id}><td>{plan.plan_id}</td><td>{plan.subject_id}</td><td>{plan.stimulation_position}</td><td>{plan.stimulation_waveform}</td><td>{plan.stimulation_high_level_v} / {plan.stimulation_low_level_v} V</td><td>{plan.stimulation_duty_cycle_pct}%</td><td>{plan.stimulation_frequency_hz} Hz</td><td>{plan.stimulation_duration_s}s / {plan.stimulation_count} / {plan.stimulation_interval_s}s</td><td>{plan.trial_count}</td><td>{plan.completed_trial_count >= plan.trial_count ? "Completed" : plan.completed_trial_count > 0 ? `In progress ${plan.completed_trial_count}/${plan.trial_count}` : "Pending"}</td><td><button type="button" onClick={() => editExperimentPlan(plan)}>Edit</button> <button type="button" className="row-delete" onClick={() => void deleteExperimentPlan(plan.plan_id)}>Delete</button></td></tr>)}</tbody></table></div>
      </section>

      <Dialog open={planEditorOpen} title={planEditorId === null ? "Add Experiment Plan" : "Edit Experiment Plan"} closeLabel="Close" onClose={() => setPlanEditorOpen(false)}>
        <div className="grid gap-4">
          <Field label="Subjects" hint={planEditorId === null ? "You can select multiple subjects." : "Select one subject when editing a single plan."}><div className="max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 text-sm">{subjects.map((subject) => <label key={subject.subject_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"><input type="checkbox" disabled={planEditorId !== null && planDraft.subject_ids.length > 0 && !planDraft.subject_ids.includes(subject.subject_id)} checked={planDraft.subject_ids.includes(subject.subject_id)} onChange={(event) => setPlanDraft((current) => ({ ...current, subject_ids: event.target.checked ? [...current.subject_ids, subject.subject_id] : current.subject_ids.filter((id) => id !== subject.subject_id) }))}/><span>{subject.subject_id}</span></label>)}</div></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label={symmetricPlanDraft ? "Position 1 (unordered)" : "Position (red)"}><Select value={planDraft.stimulation_position_id} onChange={(e) => setPlanDraft((v) => ({...v, stimulation_position_id:e.target.value}))}><option value="">Select a position…</option>{positions.map((p)=><option key={p.position_id} value={p.position_id}>{p.code}</option>)}</Select></Field><Field label={symmetricPlanDraft ? "Position 2 (unordered)" : "Position (black)"}><Select value={planDraft.stimulation_position_2_id} onChange={(e) => setPlanDraft((v) => ({...v, stimulation_position_2_id:e.target.value}))}><option value="">Select a position…</option>{positions.map((p)=><option key={p.position_id} value={p.position_id}>{p.code}</option>)}</Select></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Trial Count"><Input type="number" min="1" step="1" value={planDraft.trial_count} onChange={(e)=>setPlanDraft((v)=>({...v,trial_count:e.target.value}))}/></Field><Field label="Waveform"><Select value={planDraft.stimulation_waveform} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_waveform:e.target.value}))}><option>SQUARE</option><option>PULSE</option><option>SINE</option><option>RAMP</option></Select></Field><Field label="High Level (V)"><Input type="number" value={planDraft.stimulation_high_level_v} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_high_level_v:e.target.value}))}/></Field><Field label="Low Level (V)"><Input type="number" value={planDraft.stimulation_low_level_v} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_low_level_v:e.target.value}))}/></Field><Field label="Duty Cycle (%)"><Input type="number" value={planDraft.stimulation_duty_cycle_pct} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_duty_cycle_pct:e.target.value}))}/></Field><Field label="Frequency (Hz)"><Input type="number" value={planDraft.stimulation_frequency_hz} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_frequency_hz:e.target.value}))}/></Field><Field label="Stimulation Duration (s)"><Input type="number" value={planDraft.stimulation_duration_s} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_duration_s:e.target.value}))}/></Field><Field label="Pulse Count"><Input type="number" min="1" value={planDraft.stimulation_count} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_count:e.target.value}))}/></Field><Field label="Stimulation Interval (s)"><Input type="number" min="0" value={planDraft.stimulation_interval_s} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_interval_s:e.target.value}))}/></Field></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPlanEditorOpen(false)}>Cancel</Button><Button onClick={() => void saveExperimentPlan()} disabled={!managedExperimentId || planDraft.subject_ids.length === 0}>{planEditorId === null ? "Add Plan" : "Save Changes"}</Button></div>
        </div>
      </Dialog>
    </>
  );
}
