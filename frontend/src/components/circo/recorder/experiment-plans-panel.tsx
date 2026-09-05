"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { Button, Dialog, Field, Input, Select } from "@/components/circo/ui";
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
      <section className="panel history-panel">
        <div className="history-header"><div className="section-heading"><h2>Experiment Plans</h2></div><Button onClick={() => { setPlanEditorId(null); setPlanDraft({ subject_ids: [], stimulation_position_id: "", stimulation_position_2_id: "", stimulation_waveform: defaultConfig.waveform, stimulation_high_level_v: defaultConfig.high_level_v, stimulation_low_level_v: defaultConfig.low_level_v, stimulation_duty_cycle_pct: defaultConfig.duty_cycle_pct, stimulation_frequency_hz: defaultConfig.frequency_hz, stimulation_duration_s: defaultConfig.duration_s, stimulation_count: defaultConfig.count, stimulation_interval_s: defaultConfig.interval_s, trial_count: "1" }); setPlanEditorOpen(true); }} disabled={!managedExperimentId}><PlusIcon className="size-4"/>添加计划</Button></div>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>待测实验品</th><th>点位组合</th><th>波形</th><th>高/低电平</th><th>占空比</th><th>频率</th><th>时长/刺激次数/间隔</th><th>次数</th><th>状态</th><th>操作</th></tr></thead><tbody>{experimentPlans.map((plan)=><tr key={plan.plan_id}><td>{plan.plan_id}</td><td>{plan.subject_id}</td><td>{plan.stimulation_position}</td><td>{plan.stimulation_waveform}</td><td>{plan.stimulation_high_level_v} / {plan.stimulation_low_level_v} V</td><td>{plan.stimulation_duty_cycle_pct}%</td><td>{plan.stimulation_frequency_hz} Hz</td><td>{plan.stimulation_duration_s}s / {plan.stimulation_count} / {plan.stimulation_interval_s}s</td><td>{plan.trial_count}</td><td>{plan.completed_trial_count >= plan.trial_count ? "已完成" : plan.completed_trial_count > 0 ? `进行中 ${plan.completed_trial_count}/${plan.trial_count}` : "待执行"}</td><td><button type="button" onClick={() => editExperimentPlan(plan)}>编辑</button> <button type="button" className="row-delete" onClick={() => void deleteExperimentPlan(plan.plan_id)}>删除</button></td></tr>)}</tbody></table></div>
      </section>

      <Dialog open={planEditorOpen} title={planEditorId === null ? "Add Experiment Plan" : "Edit Experiment Plan"} closeLabel="关闭" onClose={() => setPlanEditorOpen(false)}>
        <div className="grid gap-4">
          <Field label="待测实验品" hint={planEditorId === null ? "可以同时选择多个实验品。" : "编辑单条计划时选择一个实验品。"}><div className="max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 text-sm">{subjects.map((subject) => <label key={subject.subject_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"><input type="checkbox" disabled={planEditorId !== null && planDraft.subject_ids.length > 0 && !planDraft.subject_ids.includes(subject.subject_id)} checked={planDraft.subject_ids.includes(subject.subject_id)} onChange={(event) => setPlanDraft((current) => ({ ...current, subject_ids: event.target.checked ? [...current.subject_ids, subject.subject_id] : current.subject_ids.filter((id) => id !== subject.subject_id) }))}/><span>{subject.subject_id}</span></label>)}</div></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label={symmetricPlanDraft ? "待测点位 1（无顺序）" : "待测点位（红）"}><Select value={planDraft.stimulation_position_id} onChange={(e) => setPlanDraft((v) => ({...v, stimulation_position_id:e.target.value}))}><option value="">选择点位…</option>{positions.map((p)=><option key={p.position_id} value={p.position_id}>{p.code}</option>)}</Select></Field><Field label={symmetricPlanDraft ? "待测点位 2（无顺序）" : "待测点位（黑）"}><Select value={planDraft.stimulation_position_2_id} onChange={(e) => setPlanDraft((v) => ({...v, stimulation_position_2_id:e.target.value}))}><option value="">选择点位…</option>{positions.map((p)=><option key={p.position_id} value={p.position_id}>{p.code}</option>)}</Select></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="次数（Trial）"><Input type="number" min="1" step="1" value={planDraft.trial_count} onChange={(e)=>setPlanDraft((v)=>({...v,trial_count:e.target.value}))}/></Field><Field label="波形"><Select value={planDraft.stimulation_waveform} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_waveform:e.target.value}))}><option>SQUARE</option><option>PULSE</option><option>SINE</option><option>RAMP</option></Select></Field><Field label="高电平 (V)"><Input type="number" value={planDraft.stimulation_high_level_v} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_high_level_v:e.target.value}))}/></Field><Field label="低电平 (V)"><Input type="number" value={planDraft.stimulation_low_level_v} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_low_level_v:e.target.value}))}/></Field><Field label="占空比 (%)"><Input type="number" value={planDraft.stimulation_duty_cycle_pct} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_duty_cycle_pct:e.target.value}))}/></Field><Field label="频率 (Hz)"><Input type="number" value={planDraft.stimulation_frequency_hz} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_frequency_hz:e.target.value}))}/></Field><Field label="刺激时长 (s)"><Input type="number" value={planDraft.stimulation_duration_s} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_duration_s:e.target.value}))}/></Field><Field label="刺激次数"><Input type="number" min="1" value={planDraft.stimulation_count} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_count:e.target.value}))}/></Field><Field label="刺激间隔 (s)"><Input type="number" min="0" value={planDraft.stimulation_interval_s} onChange={(e)=>setPlanDraft((v)=>({...v,stimulation_interval_s:e.target.value}))}/></Field></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPlanEditorOpen(false)}>取消</Button><Button onClick={() => void saveExperimentPlan()} disabled={!managedExperimentId || planDraft.subject_ids.length === 0}>{planEditorId === null ? "添加计划" : "保存修改"}</Button></div>
        </div>
      </Dialog>
    </>
  );
}
