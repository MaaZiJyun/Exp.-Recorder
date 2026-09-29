"use client";

import { Button, Dialog, Field, Input, Textarea } from "@/components/circo/primitives";
import type { RecorderContext } from "@/app/use-recorder";

export function ExperimentIndex({ ctx }: { ctx: RecorderContext }) {
  const {
    experiments,
    visibleExperiments,
    managedExperimentId,
    managedExperiment,
    editingExperiment,
    experimentEditorId,
    experimentDraft,
    experimentSaving,
    experimentDeleting,
    setExperimentDraft,
    setEditingExperiment,
    selectManagedExperiment,
    setExperimentEditorId,
    deleteExperiment,
    saveExperiment,
  } = ctx;

  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-base font-semibold">Experiments</h2>
          </div>
        </div>
        <div className="grid gap-2">
          {visibleExperiments.map((experiment) => (
            <button
              type="button"
              key={experiment.experiment_id}
              className={`grid min-h-14 w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${managedExperimentId === experiment.experiment_id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
              onClick={() => void selectManagedExperiment(experiment)}
            >
              <span className={`font-mono text-xs ${managedExperimentId === experiment.experiment_id ? "text-zinc-400" : "text-zinc-500"}`}>
                E{String(experiment.experiment_id).padStart(3, "0")}
              </span>
              <strong>{experiment.title}</strong>
              <small className={managedExperimentId === experiment.experiment_id ? "text-zinc-400" : "text-zinc-500"}>{experiment.trial_count} trials</small>
            </button>
          ))}
          {visibleExperiments.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm leading-6 text-zinc-500">
              {experiments.length === 0 ? (
                <>
                  No experiments yet
                  <br />
                  Use the button above to create the first one.
                </>
              ) : (
                "No matching experiments."
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex items-center">
          <h2 className="text-base font-semibold">Experiment Details</h2>
        </div>
        {managedExperiment ? (
          <>
            <div>
              <strong>{managedExperiment.title}</strong>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {managedExperiment.description || "No description"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setExperimentEditorId(managedExperiment.experiment_id);
                  setExperimentDraft({
                    title: managedExperiment.title,
                    description: managedExperiment.description ?? "",
                  });
                  setEditingExperiment(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void deleteExperiment()}
                disabled={
                  experimentDeleting || managedExperiment.trial_count > 0
                }
              >
                {experimentDeleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
            {managedExperiment.trial_count > 0 && (
              <p className="-mt-1 text-[10px] text-amber-700">
                Delete all trials in this experiment before deleting it.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            Select an experiment to view its details, or click New to create one.
          </p>
        )}
      </section>

      <Dialog
        open={editingExperiment}
        title={
          experimentEditorId === null ? "New Experiment" : "Edit Experiment"
        }
        closeLabel="Close"
        onClose={() => setEditingExperiment(false)}
      >
        <div className="grid gap-5">
          <Field label="TITLE">
            <Input
              value={experimentDraft.title}
              onChange={(event) =>
                setExperimentDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Experiment title"
              autoFocus
            />
          </Field>
          <Field
            label="DESCRIPTION"
            hint="Optional: record the experiment purpose, batch, or protocol notes."
          >
            <Textarea
              value={experimentDraft.description}
              onChange={(event) =>
                setExperimentDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Purpose, cohort, protocol notes…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditingExperiment(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void saveExperiment()}
              disabled={experimentSaving}
            >
              {experimentSaving ? "Saving…" : "Save Experiment"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
