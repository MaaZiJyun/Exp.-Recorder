"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Button, Input } from "@/components/circo/ui";
import type { RecorderContext } from "@/app/use-recorder";
import { Notice } from "./notice";
import { ExperimentIndex } from "./experiment-index";
import { ExperimentPlansPanel } from "./experiment-plans-panel";
import { TrialsPanel } from "./trials-panel";
import { SpeciesPanel, SubjectRecordsPanel } from "./subjects-panel";
import { PositionMapPanel, PositionCardsPanel } from "./positions-panel";
import { StatisticsPanel } from "./statistics-panel";

export function ManageView({ ctx }: { ctx: RecorderContext }) {
  const {
    manageTab,
    experimentQuery,
    subjectQuery,
    positionQuery,
    notice,
    setNotice,
    setExperimentQuery,
    setSubjectQuery,
    setPositionQuery,
    newExperiment,
    newSubject,
    newPosition,
    newSpecies,
  } = ctx;

  const showToolbar = manageTab !== "statistics" && manageTab !== "trials";

  return (
    <>
      <section className="flex w-full flex-col gap-3 sm:flex-row">
        {showToolbar && (
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="search"
              value={
                manageTab === "experiments"
                  ? experimentQuery
                  : manageTab === "subjects"
                    ? subjectQuery
                    : positionQuery
              }
              onChange={(event) =>
                manageTab === "experiments"
                  ? setExperimentQuery(event.target.value)
                  : manageTab === "subjects"
                    ? setSubjectQuery(event.target.value)
                    : setPositionQuery(event.target.value)
              }
              placeholder={
                manageTab === "experiments"
                  ? "搜索 Experiment 标题、描述或 ID…"
                  : manageTab === "subjects"
                    ? "搜索 Subject ID 或备注…"
                    : "搜索 Position code 或描述…"
              }
              className="pl-10"
            />
          </div>
        )}
        {showToolbar && (
          <Button
            onClick={
              manageTab === "experiments"
                ? newExperiment
                : manageTab === "subjects"
                  ? newSubject
                  : manageTab === "positions"
                    ? newPosition
                    : newSpecies
            }
            className="shrink-0"
          >
            <PlusIcon className="size-4" />
            {manageTab === "experiments"
              ? "新建 Experiment"
              : manageTab === "subjects"
                ? "新建 Subject"
                : manageTab === "positions"
                  ? "新建 Position"
                  : "新建 Species"}
          </Button>
        )}
      </section>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <section
        className={`dashboard-grid manage-layout ${manageTab === "statistics" ? "single-column-manage-layout" : ""}`}
      >
        <aside className="left-column">
          {manageTab === "experiments" || manageTab === "trials" ? (
            <ExperimentIndex ctx={ctx} />
          ) : manageTab === "subjects" ? (
            <SpeciesPanel ctx={ctx} />
          ) : manageTab === "positions" ? (
            <PositionMapPanel ctx={ctx} />
          ) : null}
        </aside>

        <section className="right-column">
          {manageTab === "experiments" ? (
            <ExperimentPlansPanel ctx={ctx} />
          ) : manageTab === "trials" ? (
            <TrialsPanel ctx={ctx} />
          ) : manageTab === "subjects" ? (
            <SubjectRecordsPanel ctx={ctx} />
          ) : manageTab === "positions" ? (
            <PositionCardsPanel ctx={ctx} />
          ) : manageTab === "statistics" ? (
            <StatisticsPanel ctx={ctx} />
          ) : null}
        </section>
      </section>
    </>
  );
}
