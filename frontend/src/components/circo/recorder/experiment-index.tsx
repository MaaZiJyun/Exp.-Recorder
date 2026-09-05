"use client";

import { Button, Dialog, Field, Input, Textarea } from "@/components/circo/ui";
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
      <section className="panel experiment-index-panel">
        <div className="experiment-index-heading">
          <div className="section-heading">
            <h2>Experiments</h2>
          </div>
        </div>
        <div className="experiment-list">
          {visibleExperiments.map((experiment) => (
            <button
              type="button"
              key={experiment.experiment_id}
              className={
                managedExperimentId === experiment.experiment_id
                  ? "active"
                  : ""
              }
              onClick={() => void selectManagedExperiment(experiment)}
            >
              <span className="experiment-number">
                E{String(experiment.experiment_id).padStart(3, "0")}
              </span>
              <strong>{experiment.title}</strong>
              <small>{experiment.trial_count} trials</small>
            </button>
          ))}
          {visibleExperiments.length === 0 && (
            <div className="empty-experiments">
              {experiments.length === 0 ? (
                <>
                  还没有 Experiment
                  <br />
                  点击顶部按钮创建第一个。
                </>
              ) : (
                "没有匹配的 Experiment。"
              )}
            </div>
          )}
        </div>
      </section>

      <section className="panel experiment-editor-panel">
        <div className="section-heading">
          <h2>Experiment Details</h2>
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
                编辑
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void deleteExperiment()}
                disabled={
                  experimentDeleting || managedExperiment.trial_count > 0
                }
              >
                {experimentDeleting ? "删除中…" : "删除"}
              </Button>
            </div>
            {managedExperiment.trial_count > 0 && (
              <p className="delete-hint">
                删除 Experiment 前需要先删除其中的 Trial。
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            选择一个 Experiment 查看详情，或点击 NEW 创建。
          </p>
        )}
      </section>

      <Dialog
        open={editingExperiment}
        title={
          experimentEditorId === null ? "New Experiment" : "Edit Experiment"
        }
        closeLabel="关闭"
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
            hint="可选：记录实验目的、批次或协议说明。"
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
              取消
            </Button>
            <Button
              onClick={() => void saveExperiment()}
              disabled={experimentSaving}
            >
              {experimentSaving ? "保存中…" : "保存 Experiment"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
