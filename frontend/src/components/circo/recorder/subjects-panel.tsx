"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/circo/ui";
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
      <section className="panel history-panel subject-records-panel">
        <div className="history-header">
          <div className="section-heading">
            <h2>Species</h2>
          </div>
          <Button className="min-h-9 px-3 text-xs" onClick={newSpecies}>
            <PlusIcon className="size-4" />
            新建 Species
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
                      编辑
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() =>
                        void api(`/species/${species.species_id}`, {
                          method: "DELETE",
                        }).then(() => loadSpecies())
                      }
                    >
                      删除
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
        closeLabel="关闭"
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
              取消
            </Button>
            <Button onClick={() => void saveSpecies()}>保存 Species</Button>
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
      <section className="panel history-panel subject-records-panel">
        <div className="history-header">
          <div className="section-heading">
            <h2>Subject Records</h2>
          </div>
          <Button className="min-h-9 px-3 text-xs" onClick={newSubject}>
            <PlusIcon className="size-4" />
            新建 Subject
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
                  className={subjectStatus(subject) !== "正常" ? "subject-status-muted" : ""}
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
                  <td className={subjectStatus(subject) === "饥饿" ? "subject-status-hungry" : subjectStatus(subject) === "疲劳" ? "subject-status-fatigued" : ""}>{subjectStatus(subject)}</td>
                  <td>{subject.trial_count}</td>
                  <td>{subject.created_at?.slice(0, 16) ?? "—"}</td>
                  <td>
                    <div className="row-actions">
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
                        编辑
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
                        {subjectDeleting === subject.subject_id ? "…" : "删除"}
                      </button>
                    </div>
                    {subject.trial_count > 0 && <small>先删除关联 Trial</small>}
                  </td>
                </tr>
              ))}
              {visibleSubjects.length === 0 && (
                <tr>
                  <td className="empty-table" colSpan={12}>
                    {subjects.length === 0
                      ? "还没有 Subject。"
                      : "没有匹配的 Subject。"}
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
        closeLabel="关闭"
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
                <option value="">选择已注册物种…</option>
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
          <Field label="NOTES" hint="可选：记录样本批次、状态或其他说明。">
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
              取消
            </Button>
            <Button onClick={() => void saveSubject()} disabled={subjectSaving}>
              {subjectSaving ? "保存中…" : "保存 Subject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
