"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { Field, Select } from "@/components/circo/primitives";

export function ExperimentPicker({ ctx }: { ctx: RecorderContext }) {
  const { experiments, managedExperimentId, selectManagedExperiment } = ctx;

  return <Field label="Experiment">
    <Select
      value={managedExperimentId ?? ""}
      onChange={(event) => {
        const experiment = experiments.find((item) => item.experiment_id === Number(event.target.value));
        if (experiment) void selectManagedExperiment(experiment);
      }}
    >
      <option value="" disabled>Select an experiment...</option>
      {experiments.map((experiment) => <option key={experiment.experiment_id} value={experiment.experiment_id}>
        E{String(experiment.experiment_id).padStart(3, "0")} · {experiment.title}
      </option>)}
    </Select>
  </Field>;
}
