"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Badge, Button, Dialog, Field, Input, Select, Textarea } from "@/components/circo/primitives";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { api } from "@/app/lib";
import type { RecorderContext } from "@/app/use-recorder";
import type { SpeciesRecord, SubjectRecord } from "@/app/types";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 py-2 last:border-0 dark:border-zinc-800"><dt className="text-zinc-500">{label}</dt><dd className="min-w-0 break-words text-right font-medium text-zinc-900 dark:text-zinc-100">{children}</dd></div>;
}

type SubjectStatus = "Normal" | "Hungry" | "Fatigued";

function SubjectStatusBadge({ status }: { status: SubjectStatus }) {
  return <Badge tone={status === "Normal" ? "success" : status === "Hungry" ? "danger" : "warning"}>{status.toUpperCase()}</Badge>;
}

const speciesColumns: DataTableColumn<SpeciesRecord>[] = [
  { key: "id", header: "ID", cell: (species) => species.species_id, searchValue: (species) => species.species_id },
  { key: "code", header: "Code", cell: (species) => <strong>{species.code}</strong>, searchValue: (species) => species.code },
  { key: "scientific_name", header: "Scientific Name", cell: (species) => <span className="italic">{species.scientific_name}</span>, searchValue: (species) => species.scientific_name },
  { key: "feeding_cycle", header: "Feeding Cycle", cell: (species) => species.feeding_cycle_h === null ? "—" : `${species.feeding_cycle_h} h`, searchValue: (species) => species.feeding_cycle_h },
  { key: "rest_cycle", header: "Rest Cycle", cell: (species) => species.rest_cycle_h === null ? "—" : `${species.rest_cycle_h} h`, searchValue: (species) => species.rest_cycle_h },
];

function SpeciesInfo({ species }: { species: SpeciesRecord }) {
  return <div className="grid gap-4">
    {species.image ? (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        <Image
          src={species.image}
          alt={`${species.scientific_name} reference`}
          width={640}
          height={480}
          unoptimized
          className="aspect-[4/3] h-auto w-full object-contain"
        />
      </div>
    ) : (
      <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-zinc-300 bg-white text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
        No reference image
      </div>
    )}
    <dl>
      <InfoRow label="ID">{species.species_id}</InfoRow>
      <InfoRow label="Code">{species.code}</InfoRow>
      <InfoRow label="Scientific Name"><span className="italic">{species.scientific_name}</span></InfoRow>
      <InfoRow label="Feeding Cycle">{species.feeding_cycle_h === null ? "—" : `${species.feeding_cycle_h} h`}</InfoRow>
      <InfoRow label="Rest Cycle">{species.rest_cycle_h === null ? "—" : `${species.rest_cycle_h} h`}</InfoRow>
    </dl>
  </div>;
}

function SubjectInfo({ subject, status }: { subject: SubjectRecord; status: SubjectStatus }) {
  return <dl>
    <InfoRow label="Subject ID">{subject.subject_id}</InfoRow>
    <InfoRow label="Species">{subject.species || "—"}</InfoRow>
    <InfoRow label="Gender">{subject.gender || "—"}</InfoRow>
    <InfoRow label="Status"><SubjectStatusBadge status={status} /></InfoRow>
    <InfoRow label="Body Length">{subject.body_length_cm === null ? "—" : `${subject.body_length_cm} cm`}</InfoRow>
    <InfoRow label="Body Width">{subject.body_width_cm === null ? "—" : `${subject.body_width_cm} cm`}</InfoRow>
    <InfoRow label="Mandible">{subject.mandibular_length_cm === null ? "—" : `${subject.mandibular_length_cm} cm`}</InfoRow>
    <InfoRow label="Body Weight">{subject.body_weight_g === null ? "—" : `${subject.body_weight_g} g`}</InfoRow>
    <InfoRow label="Last Feeding">{subject.time_since_last_feeding_h ?? "—"}</InfoRow>
    <InfoRow label="Last Experiment">{subject.time_since_last_experiment_h ?? "—"}</InfoRow>
    <InfoRow label="Trials">{subject.trial_count}</InfoRow>
    <InfoRow label="Created">{subject.created_at?.slice(0, 16) || "—"}</InfoRow>
    <InfoRow label="Notes">{subject.notes || "—"}</InfoRow>
  </dl>;
}

export function SpeciesPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    speciesRecords,
    editingSpecies,
    speciesEditorId,
    speciesDraft,
    newSpecies,
    setSpeciesEditorId,
    setSpeciesDraft,
    setEditingSpecies,
    saveSpecies,
    loadSpecies,
  } = ctx;

  const editSpecies = (species: SpeciesRecord) => {
    setSpeciesEditorId(species.species_id);
    setSpeciesDraft({
      code: species.code,
      scientific_name: species.scientific_name,
      image: species.image ?? "",
      feeding_cycle_h: species.feeding_cycle_h?.toString() ?? "",
      rest_cycle_h: species.rest_cycle_h?.toString() ?? "",
    });
    setEditingSpecies(true);
  };

  const deleteSpecies = async (species: SpeciesRecord) => {
    if (!window.confirm(`Delete species “${species.code}”?`)) return;
    await api(`/species/${species.species_id}`, { method: "DELETE" });
    await loadSpecies();
  };

  return (
    <>
      <section className="min-h-[470px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center">
            <h2 className="text-base font-semibold">Species</h2>
          </div>
          <Button className="min-h-9 px-3 text-xs" onClick={newSpecies}>
            <PlusIcon className="size-4" />
            New Species
          </Button>
        </div>
        <div className="p-5">
          <DataTable
            rows={speciesRecords}
            columns={speciesColumns}
            getRowId={(species) => species.species_id}
            getInfoTitle={(species) => species.code}
            getSearchText={(species) => `${species.species_id} ${species.code} ${species.scientific_name} ${species.feeding_cycle_h ?? ""} ${species.rest_cycle_h ?? ""}`}
            searchPlaceholder="Search species by code or scientific name..."
            emptyTitle="No species"
            emptyDescription="Create a species before assigning subjects."
            renderInfo={(species) => <SpeciesInfo species={species} />}
            onUpdate={editSpecies}
            onDelete={deleteSpecies}
          />
        </div>
      </section>

      <Dialog
        open={editingSpecies}
        title={speciesEditorId === null ? "New Species" : "Edit Species"}
        closeLabel="Close"
        onClose={() => setEditingSpecies(false)}
      >
        <div className="grid gap-4">
          <Field label="CODE">
            <Input
              value={speciesDraft.code}
              onChange={(event) =>
                setSpeciesDraft((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="SCIENTIFIC NAME">
            <Input
              value={speciesDraft.scientific_name}
              onChange={(event) =>
                setSpeciesDraft((current) => ({
                  ...current,
                  scientific_name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="FEEDING CYCLE (h)">
            <Input
              type="number"
              min="0"
              value={speciesDraft.feeding_cycle_h}
              onChange={(event) =>
                setSpeciesDraft((current) => ({
                  ...current,
                  feeding_cycle_h: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="REST CYCLE (h)">
            <Input
              type="number"
              min="0"
              value={speciesDraft.rest_cycle_h}
              onChange={(event) =>
                setSpeciesDraft((current) => ({
                  ...current,
                  rest_cycle_h: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="IMAGE">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () =>
                  setSpeciesDraft((current) => ({
                    ...current,
                    image:
                      typeof reader.result === "string" ? reader.result : "",
                  }));
                reader.readAsDataURL(file);
              }}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditingSpecies(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveSpecies()}>Save Species</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function SubjectRecordsPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    subjects,
    speciesRecords,
    running,
    subjectDeleting,
    editingSubject,
    subjectEditorId,
    subjectDraft,
    subjectSaving,
    subjectStatus,
    newSubject,
    editSubject,
    deleteSubject,
    saveSubject,
    loadSubjects,
    setSubjectDraft,
    setEditingSubject,
  } = ctx;

  const subjectColumns: DataTableColumn<SubjectRecord>[] = [
    { key: "subject_id", header: "Subject ID", cell: (subject) => <strong>{subject.subject_id}</strong>, searchValue: (subject) => subject.subject_id },
    { key: "length", header: "Length", cell: (subject) => subject.body_length_cm === null ? "—" : `${subject.body_length_cm} cm`, searchValue: (subject) => subject.body_length_cm },
    { key: "weight", header: "Weight", cell: (subject) => subject.body_weight_g === null ? "—" : `${subject.body_weight_g} g`, searchValue: (subject) => subject.body_weight_g },
    { key: "species", header: "Species", cell: (subject) => subject.species || "—", searchValue: (subject) => subject.species },
    {
      key: "status",
      header: "Status",
      cell: (subject) => {
        const status = subjectStatus(subject);
        return <SubjectStatusBadge status={status} />;
      },
      searchValue: (subject) => subjectStatus(subject),
    },
    { key: "trials", header: "Trials", cell: (subject) => subject.trial_count, searchValue: (subject) => subject.trial_count },
    { key: "created", header: "Created", cell: (subject) => subject.created_at?.slice(0, 16) ?? "—", searchValue: (subject) => subject.created_at },
  ];

  return (
    <>
      <section className="min-h-[470px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center">
            <h2 className="text-base font-semibold">Subject Records</h2>
          </div>
          <Button className="min-h-9 px-3 text-xs" onClick={newSubject}>
            <PlusIcon className="size-4" />
            New Subject
          </Button>
        </div>
        <div className="p-5">
          <DataTable
            rows={subjects}
            columns={subjectColumns}
            getRowId={(subject) => subject.subject_id}
            getInfoTitle={(subject) => subject.subject_id}
            getSearchText={(subject) => `${subject.subject_id} ${subject.species ?? ""} ${subject.gender ?? ""} ${subjectStatus(subject)} ${subject.notes ?? ""}`}
            searchPlaceholder="Search subjects by ID, species, status, or notes..."
            emptyTitle="No subjects"
            emptyDescription="Create a subject to begin recording experiments."
            renderInfo={(subject) => <SubjectInfo subject={subject} status={subjectStatus(subject)} />}
            onUpdate={editSubject}
            isUpdateDisabled={() => running}
            onDelete={deleteSubject}
            isDeleteDisabled={(subject) => running || subject.trial_count > 0 || subjectDeleting === subject.subject_id}
            actions={[
              {
                key: "feed",
                label: "Feed",
                disabled: () => running,
                onSelect: async (subject) => {
                  await api(`/subjects/${encodeURIComponent(subject.subject_id)}/feed`, { method: "POST" });
                  await loadSubjects();
                },
              },
              {
                key: "test",
                label: "Mark Tested",
                disabled: () => running,
                onSelect: async (subject) => {
                  await api(`/subjects/${encodeURIComponent(subject.subject_id)}/test`, { method: "POST" });
                  await loadSubjects();
                },
              },
            ]}
          />
        </div>
      </section>

      <Dialog
        open={editingSubject}
        title={subjectEditorId === null ? "New Subject" : "Edit Subject"}
        closeLabel="Close"
        onClose={() => setEditingSubject(false)}
      >
        <div className="grid gap-5">
          <Field label="SUBJECT ID">
            <Input
              value={subjectDraft.subject_id}
              onChange={(event) =>
                setSubjectDraft((current) => ({
                  ...current,
                  subject_id: event.target.value,
                }))
              }
              placeholder="Subject ID"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="BODY LENGTH (cm)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.body_length_cm}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    body_length_cm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="BODY WEIGHT (g)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.body_weight_g}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    body_weight_g: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="BODY WIDTH (cm)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.body_width_cm}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    body_width_cm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="MANDIBULAR LENGTH (cm)">
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.mandibular_length_cm}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    mandibular_length_cm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="GENDER">
              <Input
                value={subjectDraft.gender}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    gender: event.target.value,
                  }))
                }
                placeholder="e.g. Female"
              />
            </Field>
            <Field label="SPECIES">
              <Select
                value={subjectDraft.species}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    species: event.target.value,
                  }))
                }
              >
                <option value="">Select a registered species…</option>
                {speciesRecords.map((species) => (
                  <option key={species.species_id} value={species.code}>
                    {species.code} · {species.scientific_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="TIME SINCE LAST EXPERIMENT (h)"
              className="sm:col-span-2"
            >
              <Input
                type="number"
                min="0"
                step="any"
                value={subjectDraft.time_since_last_experiment_h}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    time_since_last_experiment_h: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label="NOTES" hint="Optional: record the specimen batch, status, or other notes.">
            <Textarea
              value={subjectDraft.notes}
              onChange={(event) =>
                setSubjectDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Subject notes…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditingSubject(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveSubject()} disabled={subjectSaving}>
              {subjectSaving ? "Saving…" : "Save Subject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
