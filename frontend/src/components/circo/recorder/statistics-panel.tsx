"use client";

import { Badge, EmptyState, Select } from "@/components/circo/ui";
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
    <section className="panel statistics-panel">
      <div className="history-header">
        <div>
          <div className="section-heading">
            <span>STATISTICS</span>
            <h2>Trials by Subject and Position Combination</h2>
          </div>
          <p className="statistics-description">
            每个 Trial 按完整刺激点组合计数，例如 H1A1。
          </p>
        </div>
        <div className="statistics-controls">
          <label className="statistics-experiment-select">
            <span>EXPERIMENT</span>
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
              <option value="">选择 Experiment…</option>
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
          <div className="statistics-legend">
            {statisticPositionCombinations.map(
              (combination, combinationIndex) => (
                <span key={combination}>
                  <i
                    style={{
                      backgroundColor: `hsl(${(combinationIndex * 67) % 360} 45% 48%)`,
                    }}
                  />
                  {combination}
                </span>
              ),
            )}
          </div>
          <div className="statistics-chart-scroll">
            <div
              className="statistics-chart"
              style={{
                minWidth: `${Math.max(
                  720,
                  statisticSubjects.length *
                    Math.max(96, statisticPositionCombinations.length * 34),
                )}px`,
              }}
            >
              {statisticSubjects.map((subjectId) => (
                <div className="statistics-subject" key={subjectId}>
                  <div className="statistics-bars">
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
                            className="statistics-bar-slot"
                            key={combination}
                            title={`${subjectId} · ${combination}: ${count} trials`}
                          >
                            <span>{count}</span>
                            <i
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
                  <strong>{subjectId}</strong>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-4">
          <EmptyState
            title="暂无统计数据"
            description="创建 Subject、Position 并完成 Trial 后，统计图会显示在这里。"
          />
        </div>
      )}
    </section>
  );
}
