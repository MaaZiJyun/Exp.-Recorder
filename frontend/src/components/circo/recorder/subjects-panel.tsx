"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/circo/primitives";
import { api } from "@/app/lib";
import type { RecorderContext } from "@/app/use-recorder";

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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CODE</th>
                <th>SCIENTIFIC NAME</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {speciesRecords.map((species) => (
                <tr key={species.species_id}>
                  <td>{species.code}</td>
                  <td>{species.scientific_name}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeciesEditorId(species.species_id);
                        setSpeciesDraft({
                          code: species.code,
                          scientific_name: species.scientific_name,
                          image: species.image ?? "",
                          feeding_cycle_h:
                            species.feeding_cycle_h?.toString() ?? "",
                          rest_cycle_h: species.rest_cycle_h?.toString() ?? "",
                        });
                        setEditingSpecies(true);
                      }}
                    >
                      Edit
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() =>
                        void api(`/species/${species.species_id}`, {
                          method: "DELETE",
                        }).then(() => loadSpecies())
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    visibleSubjects,
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SUBJECT ID</th>
                <th>LENGTH</th>
                <th>WIDTH</th>
                <th>MANDIBLE</th>
                <th>WEIGHT</th>
                <th>SPECIES</th>
                <th>STATUS</th>
                <th>TRIALS</th>
                <th>CREATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleSubjects.map((subject) => (
                <tr
                  key={subject.subject_id}
                  className={subjectStatus(subject) !== "Normal" ? "text-zinc-400" : ""}
                >
                  <td>
                    <strong>{subject.subject_id}</strong>
                  </td>
                  <td>
                    {subject.body_length_cm ?? "—"}
                    <small>{subject.body_length_cm !== null ? "cm" : ""}</small>
                  </td>
                  <td>
                    {subject.body_width_cm ?? "—"}
                    <small>{subject.body_width_cm !== null ? "cm" : ""}</small>
                  </td>
                  <td>
                    {subject.mandibular_length_cm ?? "—"}
                    <small>
                      {subject.mandibular_length_cm !== null ? "cm" : ""}
                    </small>
                  </td>
                  <td>
                    {subject.body_weight_g ?? "—"}
                    <small>{subject.body_weight_g !== null ? "g" : ""}</small>
                  </td>
                  <td>{subject.species || "—"}</td>
                  <td className={subjectStatus(subject) === "Hungry" ? "text-red-600" : subjectStatus(subject) === "Fatigued" ? "text-orange-500" : ""}>{subjectStatus(subject)}</td>
                  <td>{subject.trial_count}</td>
                  <td>{subject.created_at?.slice(0, 16) ?? "—"}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          void api(`/subjects/${subject.subject_id}/feed`, {
                            method: "POST",
                          }).then(() => loadSubjects())
                        }
                        disabled={running}
                      >
                        Feed
                      </button>
                      <button
                        onClick={() =>
                          void api(`/subjects/${subject.subject_id}/test`, {
                            method: "POST",
                          }).then(() => loadSubjects())
                        }
                        disabled={running}
                      >
                        Test
                      </button>
                      <button onClick={() => editSubject(subject)} disabled={running}>
                        Edit
                      </button>
                      <button
                        className="row-delete"
                        onClick={() => void deleteSubject(subject)}
                        disabled={
                          running ||
                          subject.trial_count > 0 ||
                          subjectDeleting === subject.subject_id
                        }
                      >
                        {subjectDeleting === subject.subject_id ? "…" : "Delete"}
                      </button>
                    </div>
                    {subject.trial_count > 0 && <small>Delete linked trials first</small>}
                  </td>
                </tr>
              ))}
              {visibleSubjects.length === 0 && (
                <tr>
                  <td className="h-40 text-center text-zinc-500" colSpan={12}>
                    {subjects.length === 0
                      ? "No subjects yet."
                      : "No matching subjects."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
