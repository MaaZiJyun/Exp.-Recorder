"use client";

import { Badge, EmptyState, Select } from "@/components/circo/primitives";
import type { RecorderContext } from "@/app/use-recorder";

export function StatisticsPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    experiments,
    statisticsExperimentId,
    subjectPositionCombinationStatistics,
    statisticSubjects,
    statisticPositionCombinations,
    statisticMaximum,
    setStatisticsExperimentId,
    setSubjectPositionCombinationStatistics,
    loadSubjectPositionCombinationStatistics,
  } = ctx;

  return (
    <section className="min-h-[520px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">STATISTICS</span>
            <h2 className="text-base font-semibold">Trials by Subject and Position Combination</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Each trial is counted by its complete stimulation-position combination, such as H1A1.
          </p>
        </div>
        <div className="flex items-end gap-3 max-sm:flex-col max-sm:items-stretch">
          <label className="flex min-w-56 flex-col gap-1.5 max-sm:min-w-0">
            <span className="text-[10px] font-semibold tracking-wider text-zinc-500">EXPERIMENT</span>
            <Select
              value={statisticsExperimentId?.toString() ?? ""}
              onChange={(event) => {
                const experimentId = event.target.value
                  ? Number(event.target.value)
                  : null;
                setStatisticsExperimentId(experimentId);
                if (experimentId === null) {
                  setSubjectPositionCombinationStatistics([]);
                } else {
                  void loadSubjectPositionCombinationStatistics(
                    experimentId,
                  ).catch(() => setSubjectPositionCombinationStatistics([]));
                }
              }}
            >
              <option value="">Select an experiment…</option>
              {experiments.map((experiment) => (
                <option
                  key={experiment.experiment_id}
                  value={experiment.experiment_id}
                >
                  {experiment.title}
                </option>
              ))}
            </Select>
          </label>
          <Badge tone="info">MAX {statisticMaximum} TRIALS</Badge>
        </div>
      </div>
      {statisticSubjects.length > 0 && statisticPositionCombinations.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-zinc-200 px-5 pb-4">
            {statisticPositionCombinations.map(
              (combination, combinationIndex) => (
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-zinc-500" key={combination}>
                  <i
                    className="size-2.5 rounded-sm"
                    style={{
                      backgroundColor: `hsl(${(combinationIndex * 67) % 360} 45% 48%)`,
                    }}
                  />
                  {combination}
                </span>
              ),
            )}
          </div>
          <div className="overflow-x-auto px-5 pb-5 pt-6">
            <div
              className="flex h-90 items-stretch gap-4 border-b border-zinc-200 bg-[repeating-linear-gradient(to_top,transparent_0,transparent_59px,#f4f4f5_60px)] px-3"
              style={{
                minWidth: `${Math.max(
                  720,
                  statisticSubjects.length *
                    Math.max(96, statisticPositionCombinations.length * 34),
                )}px`,
              }}
            >
              {statisticSubjects.map((subjectId) => (
                <div className="grid min-w-20 flex-1 grid-rows-[minmax(0,1fr)_2.5rem] gap-2" key={subjectId}>
                  <div className="flex min-h-0 items-end justify-center gap-1 pt-5">
                    {statisticPositionCombinations.map(
                      (combination, combinationIndex) => {
                        const count =
                          subjectPositionCombinationStatistics.find(
                            (item) =>
                              item.subject_id === subjectId &&
                              item.position_combination === combination,
                          )?.trial_count ?? 0;
                        return (
                          <div
                            className="relative flex h-full max-w-9 flex-1 flex-col items-stretch justify-end"
                            key={combination}
                            title={`${subjectId} · ${combination}: ${count} trials`}
                          >
                            <span className="mb-1 text-center font-mono text-[9px] font-semibold text-zinc-500">{count}</span>
                            <i
                              className="min-h-0.5 shrink-0 rounded-t-sm opacity-90"
                              style={{
                                height: `${(count / statisticMaximum) * 100}%`,
                                backgroundColor: `hsl(${(combinationIndex * 67) % 360} 45% 48%)`,
                              }}
                            />
                          </div>
                        );
                      },
                    )}
                  </div>
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-center font-mono text-[10px] font-semibold text-zinc-950">{subjectId}</strong>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-4">
          <EmptyState
            title="No statistics yet"
            description="Create subjects and positions, then complete trials to populate this chart."
          />
        </div>
      )}
    </section>
  );
}
