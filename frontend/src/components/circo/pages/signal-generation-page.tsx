"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { Card, Field, Input, Select } from "@/components/circo/ui";

export function SignalGenerationPage({ ctx }: { ctx: RecorderContext }) {
  const { form, running, setField } = ctx;
  return <div className="grid gap-8">
    <PageHeader eyebrow="筛选" title="信号生发" subtitle="配置电刺激信号以及实验录像时间窗。" />
    <Card className="grid gap-7 p-6">
      <section><h2 className="mb-4 text-base font-semibold">刺激信号</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="WAVEFORM"><Select disabled={running} value={form.waveform} onChange={(event) => setField("waveform", event.target.value)}><option value="SQUARE">Square</option><option value="PULSE">Pulse</option><option value="SINE">Sine</option><option value="RAMP">Ramp</option></Select></Field>
        <Field label="FREQUENCY (Hz)"><Input disabled={running} type="number" step="any" min="0.001" value={form.frequency_hz} onChange={(event) => setField("frequency_hz", event.target.value)} /></Field>
        <Field label="HIGH LEVEL (V)"><Input disabled={running} type="number" step="any" value={form.high_level_v} onChange={(event) => setField("high_level_v", event.target.value)} /></Field>
        <Field label="LOW LEVEL (V)"><Input disabled={running} type="number" step="any" value={form.low_level_v} onChange={(event) => setField("low_level_v", event.target.value)} /></Field>
        <Field label="DUTY CYCLE (%)"><Input disabled={running} type="number" step="any" min="0.1" max="99.9" value={form.duty_cycle_pct} onChange={(event) => setField("duty_cycle_pct", event.target.value)} /></Field>
        <Field label="DURATION (s)"><Input disabled={running} type="number" step="any" min="0.001" value={form.duration_s} onChange={(event) => setField("duration_s", event.target.value)} /></Field>
        <Field label="COUNT"><Input disabled={running} type="number" step="1" min="1" value={form.count} onChange={(event) => setField("count", event.target.value)} /></Field>
        <Field label="INTERVAL (s)"><Input disabled={running} type="number" step="any" min="0" value={form.interval_s} onChange={(event) => setField("interval_s", event.target.value)} /></Field>
      </div></section>
      <section className="border-t border-zinc-200 pt-6"><h2 className="mb-4 text-base font-semibold">录像时间窗</h2><div className="grid gap-4 sm:grid-cols-2">
        <Field label="BASELINE (s)"><Input disabled={running} type="number" step="any" min="0" value={form.baseline_duration_s} onChange={(event) => setField("baseline_duration_s", event.target.value)} /></Field>
        <Field label="POST-STIM (s)"><Input disabled={running} type="number" step="any" min="0" value={form.post_stim_duration_s} onChange={(event) => setField("post_stim_duration_s", event.target.value)} /></Field>
      </div></section>
    </Card>
  </div>;
}
