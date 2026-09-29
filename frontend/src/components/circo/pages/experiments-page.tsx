"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import type { RecorderContext } from "@/app/use-recorder";
import type { Experiment } from "@/app/types";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Notice } from "@/components/circo/recorder/notice";
import { Badge, Button, Card, Dialog, Field, Input, Textarea } from "@/components/circo/primitives";

const columns: DataTableColumn<Experiment>[] = [
  {
    key: "id",
    header: "ID",
    cell: (experiment) => `E${String(experiment.experiment_id).padStart(3, "0")}`,
    searchValue: (experiment) => experiment.experiment_id,
  },
  {
    key: "title",
    header: "Title",
    cell: (experiment) => <strong>{experiment.title}</strong>,
    searchValue: (experiment) => experiment.title,
  },
  {
    key: "description",
    header: "Description",
    cell: (experiment) => <span className="block max-w-xl truncate">{experiment.description || "—"}</span>,
    searchValue: (experiment) => experiment.description,
  },
  {
    key: "trials",
    header: "Trials",
    cell: (experiment) => <Badge tone={experiment.trial_count > 0 ? "info" : "neutral"}>{experiment.trial_count}</Badge>,
    sortValue: (experiment) => experiment.trial_count,
    searchValue: (experiment) => experiment.trial_count,
  },
  {
    key: "created",
    header: "Created",
    cell: (experiment) => new Date(experiment.created_at).toLocaleString(),
    sortValue: (experiment) => new Date(experiment.created_at),
    searchValue: (experiment) => experiment.created_at,
  },
];

function ExperimentInfo({ experiment }: { experiment: Experiment }) {
  return <dl className="grid gap-3">
    <div><dt className="text-xs text-zinc-500">Experiment ID</dt><dd className="mt-1 font-mono">E{String(experiment.experiment_id).padStart(3, "0")}</dd></div>
    <div><dt className="text-xs text-zinc-500">Title</dt><dd className="mt-1 font-medium">{experiment.title}</dd></div>
    <div><dt className="text-xs text-zinc-500">Description</dt><dd className="mt-1 whitespace-pre-wrap">{experiment.description || "No description"}</dd></div>
    <div><dt className="text-xs text-zinc-500">Trials</dt><dd className="mt-1"><Badge tone={experiment.trial_count > 0 ? "info" : "neutral"}>{experiment.trial_count}</Badge></dd></div>
    <div><dt className="text-xs text-zinc-500">Created</dt><dd className="mt-1">{new Date(experiment.created_at).toLocaleString()}</dd></div>
  </dl>;
}

export function ExperimentsPage({ ctx }: { ctx: RecorderContext }) {
  const {
    experiments,
    editingExperiment,
    experimentEditorId,
    experimentDraft,
    experimentSaving,
    experimentDeleting,
    notice,
    setNotice,
    setExperimentDraft,
    setEditingExperiment,
    setExperimentEditorId,
    selectManagedExperiment,
    newExperiment,
    saveExperiment,
    deleteExperiment,
  } = ctx;

  const editExperiment = (experiment: Experiment) => {
    setExperimentEditorId(experiment.experiment_id);
    setExperimentDraft({
      title: experiment.title,
      description: experiment.description ?? "",
    });
    setEditingExperiment(true);
  };

  return <div className="grid min-w-0 gap-6">
    <PageHeader
      eyebrow="Filters"
      title="Experiments"
      subtitle="Create and manage experiment records used by plans and trials."
    />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <Card>
      <SectionHeader
        title="Experiment Library"
        subtitle={`${experiments.length} experiment${experiments.length === 1 ? "" : "s"}`}
        action={<Button onClick={newExperiment}><PlusIcon className="size-4" />New Experiment</Button>}
      />
      <DataTable
        rows={experiments}
        columns={columns}
        getRowId={(experiment) => experiment.experiment_id}
        getInfoTitle={(experiment) => experiment.title}
        getSearchText={(experiment) => `${experiment.experiment_id} ${experiment.title} ${experiment.description ?? ""} ${experiment.created_at}`}
        searchPlaceholder="Search experiments by ID, title, or description..."
        emptyTitle="No experiments"
        emptyDescription="Create an experiment before preparing plans or recording trials."
        renderInfo={(experiment) => <ExperimentInfo experiment={experiment} />}
        onRead={selectManagedExperiment}
        onUpdate={editExperiment}
        onDelete={deleteExperiment}
        isDeleteDisabled={(experiment) => experimentDeleting || experiment.trial_count > 0}
      />
    </Card>

    <Dialog
      open={editingExperiment}
      title={experimentEditorId === null ? "New Experiment" : "Update Experiment"}
      closeLabel="Close"
      onClose={() => setEditingExperiment(false)}
    >
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void saveExperiment(); }}>
        <Field label="Title">
          <Input
            required
            value={experimentDraft.title}
            onChange={(event) => setExperimentDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Experiment title"
            autoFocus
          />
        </Field>
        <Field label="Description" hint="Optional: record the experiment purpose, batch, or protocol notes.">
          <Textarea
            value={experimentDraft.description}
            onChange={(event) => setExperimentDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Purpose, cohort, protocol notes..."
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditingExperiment(false)}>Cancel</Button>
          <Button type="submit" disabled={experimentSaving}>{experimentSaving ? "Saving..." : "Save Experiment"}</Button>
        </div>
      </form>
    </Dialog>
  </div>;
}
