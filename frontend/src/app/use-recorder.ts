"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initialForm } from "./constants";
import { api, numberOrNull } from "./lib";
import type {
  DefaultConfig,
  DeviceStatus,
  Experiment,
  ExperimentPlan,
  RowEdit,
  SpeciesRecord,
  StimulationPosition,
  SubjectPositionCombinationStatistic,
  SubjectRecord,
  TaskState,
  Trial,
  TrialForm,
} from "./types";

export type ManageTab =
  | "experiments"
  | "trials"
  | "subjects"
  | "positions"
  | "species"
  | "statistics";

export function useRecorder() {
  const [view, setView] = useState<"execute" | "manage">("execute");
  const [devices, setDevices] = useState<DeviceStatus | null>(null);
  const [task, setTask] = useState<TaskState>({
    task_id: null,
    status: "IDLE",
    result: null,
    logs: [],
  });
  const [trials, setTrials] = useState<Trial[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [runExperimentId, setRunExperimentId] = useState("");
  const [managedExperimentId, setManagedExperimentId] = useState<number | null>(
    null,
  );
  const [experimentQuery, setExperimentQuery] = useState("");
  const [experimentDraft, setExperimentDraft] = useState({
    title: "",
    description: "",
  });
  const [editingExperiment, setEditingExperiment] = useState(false);
  const [experimentEditorId, setExperimentEditorId] = useState<number | null>(
    null,
  );
  const [experimentSaving, setExperimentSaving] = useState(false);
  const [experimentDeleting, setExperimentDeleting] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>("experiments");
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [speciesRecords, setSpeciesRecords] = useState<SpeciesRecord[]>([]);
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [speciesEditorId, setSpeciesEditorId] = useState<number | null>(null);
  const [speciesDraft, setSpeciesDraft] = useState({
    code: "",
    scientific_name: "",
    image: "",
    feeding_cycle_h: "",
    rest_cycle_h: "",
  });
  const [subjectQuery, setSubjectQuery] = useState("");
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectEditorId, setSubjectEditorId] = useState<string | null>(null);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectDeleting, setSubjectDeleting] = useState<string | null>(null);
  const [positions, setPositions] = useState<StimulationPosition[]>([]);
  const [experimentPlans, setExperimentPlans] = useState<ExperimentPlan[]>([]);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const selectedPlanIdRef = useRef<number | null>(null);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [planEditorId, setPlanEditorId] = useState<number | null>(null);
  const [planDraft, setPlanDraft] = useState({ subject_ids: [] as string[], stimulation_position_id: "", stimulation_position_2_id: "", stimulation_waveform: "SQUARE", stimulation_high_level_v: "", stimulation_low_level_v: "", stimulation_duty_cycle_pct: "50", stimulation_frequency_hz: "", stimulation_duration_s: "0.5", stimulation_count: "1", stimulation_interval_s: "0", trial_count: "1" });
  const [
    subjectPositionCombinationStatistics,
    setSubjectPositionCombinationStatistics,
  ] = useState<SubjectPositionCombinationStatistic[]>([]);
  const [statisticsExperimentId, setStatisticsExperimentId] = useState<
    number | null
  >(null);
  const [positionQuery, setPositionQuery] = useState("");
  const [editingPosition, setEditingPosition] = useState(false);
  const [positionEditorId, setPositionEditorId] = useState<number | null>(null);
  const [positionSaving, setPositionSaving] = useState(false);
  const [positionDeleting, setPositionDeleting] = useState<number | null>(null);
  const [selectedPositionImageId, setSelectedPositionImageId] = useState<
    number | null
  >(null);
  const [positionDraft, setPositionDraft] = useState({
    code: "",
    description: "",
    image: "",
    mark: null as { x: number; y: number } | null,
    species: "",
  });
  const [subjectDraft, setSubjectDraft] = useState({
    subject_id: "",
    body_length_cm: "",
    body_weight_g: "",
    body_width_cm: "",
    mandibular_length_cm: "",
    gender: "",
    species: "",
    time_since_last_experiment_h: "",
    notes: "",
  });
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [form, setForm] = useState<TrialForm>(initialForm);
  const [defaultConfig, setDefaultConfig] = useState<DefaultConfig>({ waveform: initialForm.waveform, high_level_v: initialForm.high_level_v, low_level_v: initialForm.low_level_v, duty_cycle_pct: initialForm.duty_cycle_pct, frequency_hz: initialForm.frequency_hz, duration_s: initialForm.duration_s, count: initialForm.count, interval_s: initialForm.interval_s, position_id: "", position_2_id: "", baseline_duration_s: initialForm.baseline_duration_s, post_stim_duration_s: initialForm.post_stim_duration_s });
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Trial | null>(null);
  const [pendingTrial, setPendingTrial] = useState<Trial | null>(null);
  const [annotation, setAnnotation] = useState({
    latency: "",
    action: "",
    degree: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rowEdit, setRowEdit] = useState<RowEdit | null>(null);
  const [rowSaving, setRowSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [cameraMirrored, setCameraMirrored] = useState(false);
  const [cameraFlipped, setCameraFlipped] = useState(false);
  const previousTaskStatus = useRef(task.status);
  const filterRef = useRef("");
  const managedExperimentRef = useRef<number | null>(null);
  const logWindowRef = useRef<HTMLDivElement>(null);

  const loadTrials = useCallback(
    async (subject = "", experimentId: number | null = null) => {
      const params = new URLSearchParams();
      if (subject.trim()) params.set("subject_id", subject.trim());
      if (experimentId !== null)
        params.set("experiment_id", String(experimentId));
      params.set("limit", "100000");
      const query = params.size ? `?${params.toString()}` : "";
      setTrials(await api<Trial[]>(`/trials${query}`));
    },
    [],
  );

  const loadExperiments = useCallback(async () => {
    const records = await api<Experiment[]>("/experiments");
    setExperiments(records);
    setRunExperimentId(
      (current) =>
        current || (records[0] ? String(records[0].experiment_id) : ""),
    );
    return records;
  }, []);

  const loadSubjects = useCallback(async () => {
    const records = await api<SubjectRecord[]>("/subjects");
    setSubjects(records);
    return records;
  }, []);
  const loadSpecies = useCallback(async () => {
    const records = await api<SpeciesRecord[]>("/species");
    setSpeciesRecords(records);
    return records;
  }, []);
  const subjectStatus = (subject: SubjectRecord): "正常" | "饥饿" | "疲劳" => {
    const species = speciesRecords.find(
      (item) => item.code === subject.species,
    );
    const now = Date.now();
    const hoursSince = (value: string | null) =>
      value ? (now - new Date(value).getTime()) / 3600000 : null;
    const feedingHours = hoursSince(subject.time_since_last_feeding_h);
    const testHours = hoursSince(subject.time_since_last_experiment_h);
    if (
      feedingHours !== null &&
      species?.feeding_cycle_h != null &&
      feedingHours > species.feeding_cycle_h
    )
      return "饥饿";
    else if (
      testHours !== null &&
      species?.rest_cycle_h != null &&
      testHours < species.rest_cycle_h
    ) {
      return "疲劳";
    } else return "正常";
  };
  const saveSpecies = async () => {
    if (!speciesDraft.code.trim() || !speciesDraft.scientific_name.trim())
      return;
    const record = await api<SpeciesRecord>(
      speciesEditorId === null ? "/species" : `/species/${speciesEditorId}`,
      {
        method: speciesEditorId === null ? "POST" : "PUT",
        body: JSON.stringify({
          ...speciesDraft,
          image: speciesDraft.image || null,
          feeding_cycle_h: speciesDraft.feeding_cycle_h
            ? Number(speciesDraft.feeding_cycle_h)
            : null,
          rest_cycle_h: speciesDraft.rest_cycle_h
            ? Number(speciesDraft.rest_cycle_h)
            : null,
        }),
      },
    );
    setSpeciesRecords((current) =>
      speciesEditorId === null
        ? [...current, record]
        : current.map((item) =>
            item.species_id === record.species_id ? record : item,
          ),
    );
    setEditingSpecies(false);
  };
  const newSpecies = () => {
    setSpeciesEditorId(null);
    setSpeciesDraft({
      code: "",
      scientific_name: "",
      image: "",
      feeding_cycle_h: "",
      rest_cycle_h: "",
    });
    setEditingSpecies(true);
  };

  const loadPositions = useCallback(async () => {
    const records = await api<StimulationPosition[]>("/stimulation-positions");
    setPositions(records);
    setForm((current) => ({
      ...current,
      position_id:
        current.position_id &&
        records.some((item) => String(item.position_id) === current.position_id)
          ? current.position_id
          : "",
      position_2_id:
        current.position_2_id &&
        records.some(
          (item) => String(item.position_id) === current.position_2_id,
        )
          ? current.position_2_id
          : "",
    }));
    return records;
  }, []);

  const loadSubjectPositionCombinationStatistics = useCallback(
    async (experimentId: number) => {
      const records = await api<SubjectPositionCombinationStatistic[]>(
        `/statistics/subject-position-combinations?experiment_id=${experimentId}`,
      );
      setSubjectPositionCombinationStatistics(records);
      return records;
    },
    [],
  );
  const loadExperimentPlans = useCallback(async (experimentId: number) => {
    const records = await api<ExperimentPlan[]>(`/experiments/${experimentId}/plans`);
    setExperimentPlans(records);
    return records;
  }, []);
  const selectExperimentPlan = useCallback((plan: ExperimentPlan) => {
    selectedPlanIdRef.current = plan.plan_id;
    setSelectedPlanId(plan.plan_id);
    setForm((current) => ({ ...current, subject_id: plan.subject_id, position_id: String(plan.stimulation_position_id), position_2_id: String(plan.stimulation_position_2_id), waveform: plan.stimulation_waveform, high_level_v: String(plan.stimulation_high_level_v), low_level_v: String(plan.stimulation_low_level_v), duty_cycle_pct: String(plan.stimulation_duty_cycle_pct), frequency_hz: String(plan.stimulation_frequency_hz), duration_s: String(plan.stimulation_duration_s), count: String(plan.stimulation_count), interval_s: String(plan.stimulation_interval_s) }));
  }, []);
  const saveExperimentPlan = async () => {
    if (!managedExperimentId) return;
    await api(planEditorId === null ? `/experiments/${managedExperimentId}/plans` : `/experiments/${managedExperimentId}/plans/${planEditorId}`, { method: planEditorId === null ? "POST" : "PUT", body: JSON.stringify({
      ...planDraft, subject_ids: planDraft.subject_ids,
      stimulation_position_id: Number(planDraft.stimulation_position_id), stimulation_position_2_id: Number(planDraft.stimulation_position_2_id),
      stimulation_high_level_v: Number(planDraft.stimulation_high_level_v), stimulation_low_level_v: Number(planDraft.stimulation_low_level_v), stimulation_duty_cycle_pct: Number(planDraft.stimulation_duty_cycle_pct), stimulation_frequency_hz: Number(planDraft.stimulation_frequency_hz), stimulation_duration_s: Number(planDraft.stimulation_duration_s), stimulation_count: Number(planDraft.stimulation_count), stimulation_interval_s: Number(planDraft.stimulation_interval_s), trial_count: Number(planDraft.trial_count),
    }) });
    await loadExperimentPlans(managedExperimentId);
    setPlanEditorOpen(false);
    setPlanEditorId(null);
  };
  const editExperimentPlan = (plan: ExperimentPlan) => {
    setPlanEditorId(plan.plan_id);
    setPlanDraft({ subject_ids: [plan.subject_id], stimulation_position_id: String(plan.stimulation_position_id), stimulation_position_2_id: String(plan.stimulation_position_2_id), stimulation_waveform: plan.stimulation_waveform, stimulation_high_level_v: String(plan.stimulation_high_level_v), stimulation_low_level_v: String(plan.stimulation_low_level_v), stimulation_duty_cycle_pct: String(plan.stimulation_duty_cycle_pct), stimulation_frequency_hz: String(plan.stimulation_frequency_hz), stimulation_duration_s: String(plan.stimulation_duration_s), stimulation_count: String(plan.stimulation_count), stimulation_interval_s: String(plan.stimulation_interval_s), trial_count: String(plan.trial_count) });
    setPlanEditorOpen(true);
  };
  const deleteExperimentPlan = async (planId: number) => {
    if (!managedExperimentId || !window.confirm("删除这条实验计划？已有 Trial 不会被删除。")) return;
    await api(`/experiment-plans/${planId}`, { method: "DELETE" });
    await loadExperimentPlans(managedExperimentId);
  };
  const selectRunExperiment = useCallback(async (value: string) => {
    setRunExperimentId(value);
    if (!value) {
      selectedPlanIdRef.current = null;
      setSelectedPlanId(null);
      setExperimentPlans([]);
      return;
    }
    const plans = await loadExperimentPlans(Number(value));
    const selected = plans.find((plan) => plan.plan_id === selectedPlanIdRef.current && plan.completed_trial_count < plan.trial_count);
    const next = selected ?? plans.find((plan) => plan.completed_trial_count < plan.trial_count);
    if (next) selectExperimentPlan(next);
    else {
      selectedPlanIdRef.current = null;
      setSelectedPlanId(null);
    }
  }, [loadExperimentPlans, selectExperimentPlan]);

  const refresh = useCallback(async () => {
    try {
      const [deviceState, taskState] = await Promise.all([
        api<DeviceStatus>("/devices"),
        api<TaskState>("/trials/current"),
      ]);
      setDevices(deviceState);
      setTask(taskState);
      if (
        taskState.status === "COMPLETED" &&
        taskState.result &&
        taskState.result.trial_id === null
      ) {
        setPendingTrial((current) => current ?? taskState.result);
      }
      if (
        previousTaskStatus.current === "RUNNING" &&
        taskState.status !== "RUNNING"
      ) {
        if (taskState.status === "COMPLETED" && taskState.result) {
          setPendingTrial(taskState.result);
          setAnnotation({ latency: "", action: "", degree: "" });
        }
        await Promise.all([
          loadTrials(filterRef.current, managedExperimentRef.current),
          loadExperiments(),
          loadSubjects(),
          loadSpecies(),
          loadPositions(),
        ]);
        setNotice({
          kind: taskState.status === "COMPLETED" ? "success" : "error",
          text:
            taskState.status === "COMPLETED"
              ? "实验完成，请填写 RESPONSE ANNOTATION 后保存或丢弃。"
              : (taskState.result?.error_message ?? "实验失败。"),
        });
      }
      previousTaskStatus.current = taskState.status;
    } catch {
      setDevices(null);
    }
  }, [loadExperiments, loadPositions, loadSpecies, loadSubjects, loadTrials]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadExperiments()
        .then((records) => {
          const firstId = records[0]?.experiment_id ?? null;
          managedExperimentRef.current = firstId;
          setManagedExperimentId(firstId);
          if (records[0]) {
            setExperimentDraft({
              title: records[0].title,
              description: records[0].description ?? "",
            });
            void loadTrials("", firstId);
            void selectRunExperiment(String(firstId));
          }
        })
        .catch(() => {
          setExperiments([]);
          setTrials([]);
        });
      void loadSubjects().catch(() => setSubjects([]));
      void loadSpecies().catch(() => setSpeciesRecords([]));
      void loadPositions().catch(() => setPositions([]));
      void refresh();
      void api<Record<string, string | number>>("/config")
        .then((defaults) => {
          const parsedDefaults = Object.fromEntries(
            Object.entries(defaults).map(([key, value]) => [key, String(value)]),
          ) as DefaultConfig;
          setDefaultConfig((current) => ({ ...current, ...parsedDefaults }));
          setForm((current) => ({
            ...current,
            ...parsedDefaults,
          }));
        })
        .catch(() =>
          setNotice({ kind: "error", text: "无法读取后端默认配置。" }),
        );
    }, 0);
    const timer = window.setInterval(() => void refresh(), 900);
    const previewTimer = window.setInterval(
      () => setPreviewTick((value) => value + 1),
      160,
    );
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.clearInterval(previewTimer);
    };
  }, [loadExperiments, loadPositions, loadSpecies, loadSubjects, loadTrials, refresh, selectRunExperiment]);

  useEffect(() => {
    const logWindow = logWindowRef.current;
    if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
  }, [task.logs.length]);

  const connect = async () => {
    setConnecting(true);
    setNotice(null);
    try {
      const state = await api<DeviceStatus>("/devices/connect", {
        method: "POST",
      });
      setDevices(state);
      setNotice({
        kind:
          state.sdg_connected && state.camera_connected ? "success" : "error",
        text:
          state.sdg_connected && state.camera_connected
            ? "所有硬件已连接。"
            : [
                !state.sdg_connected &&
                  `SDG1022X: ${state.sdg_error || "连接失败"}`,
                !state.camera_connected &&
                  `XIAO: ${state.camera_error || "连接失败"}`,
              ]
                .filter(Boolean)
                .join("；"),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "连接失败",
      });
    } finally {
      setConnecting(false);
    }
  };

  const selectManagedExperiment = async (experiment: Experiment) => {
    managedExperimentRef.current = experiment.experiment_id;
    setManagedExperimentId(experiment.experiment_id);
    setExperimentDraft({
      title: experiment.title,
      description: experiment.description ?? "",
    });
    setEditingExperiment(false);
    setSelected(null);
    setEditingId(null);
    setRowEdit(null);
    filterRef.current = "";
    setFilter("");
    try {
      await Promise.all([loadTrials("", experiment.experiment_id), loadExperimentPlans(experiment.experiment_id)]);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "无法读取 Trial",
      });
    }
  };

  const newExperiment = () => {
    setExperimentEditorId(null);
    setExperimentDraft({ title: "", description: "" });
    setEditingExperiment(true);
  };

  const saveExperiment = async () => {
    if (!experimentDraft.title.trim()) {
      setNotice({ kind: "error", text: "Experiment 标题不能为空。" });
      return;
    }
    setExperimentSaving(true);
    try {
      const record = await api<Experiment>(
        experimentEditorId === null
          ? "/experiments"
          : `/experiments/${experimentEditorId}`,
        {
          method: experimentEditorId === null ? "POST" : "PUT",
          body: JSON.stringify({
            title: experimentDraft.title.trim(),
            description: experimentDraft.description.trim() || null,
          }),
        },
      );
      await loadExperiments();
      await selectManagedExperiment(record);
      setEditingExperiment(false);
      if (!runExperimentId) setRunExperimentId(String(record.experiment_id));
      setNotice({
        kind: "success",
        text: `Experiment “${record.title}” 已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setExperimentSaving(false);
    }
  };

  const deleteExperiment = async () => {
    const experiment = experiments.find(
      (item) => item.experiment_id === managedExperimentId,
    );
    if (
      !experiment ||
      !window.confirm(`确定删除 Experiment “${experiment.title}”？`)
    )
      return;
    setExperimentDeleting(true);
    try {
      await api(`/experiments/${experiment.experiment_id}`, {
        method: "DELETE",
      });
      const records = await loadExperiments();
      const next =
        records.find(
          (item) => item.experiment_id !== experiment.experiment_id,
        ) ?? null;
      setRunExperimentId((current) =>
        current === String(experiment.experiment_id)
          ? next
            ? String(next.experiment_id)
            : ""
          : current,
      );
      if (next) await selectManagedExperiment(next);
      else newExperiment();
      setNotice({
        kind: "success",
        text: `Experiment “${experiment.title}” 已删除。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setExperimentDeleting(false);
    }
  };

  const newSubject = () => {
    setSubjectEditorId(null);
    setSubjectDraft({
      subject_id: "",
      body_length_cm: "",
      body_weight_g: "",
      body_width_cm: "",
      mandibular_length_cm: "",
      gender: "",
      species: "",
      time_since_last_experiment_h: "",
      notes: "",
    });
    setEditingSubject(true);
  };

  const editSubject = (subject: SubjectRecord) => {
    setSubjectEditorId(subject.subject_id);
    setSubjectDraft({
      subject_id: subject.subject_id,
      body_length_cm: subject.body_length_cm?.toString() ?? "",
      body_weight_g: subject.body_weight_g?.toString() ?? "",
      body_width_cm: subject.body_width_cm?.toString() ?? "",
      mandibular_length_cm: subject.mandibular_length_cm?.toString() ?? "",
      gender: subject.gender ?? "",
      species: subject.species ?? "",
      time_since_last_experiment_h:
        subject.time_since_last_experiment_h?.toString() ?? "",
      notes: subject.notes ?? "",
    });
    setEditingSubject(true);
  };

  const saveSubject = async () => {
    if (!subjectDraft.subject_id.trim()) {
      setNotice({ kind: "error", text: "Subject ID 不能为空。" });
      return;
    }
    setSubjectSaving(true);
    try {
      const record = await api<SubjectRecord>(
        subjectEditorId === null
          ? "/subjects"
          : `/subjects/${encodeURIComponent(subjectEditorId)}`,
        {
          method: subjectEditorId === null ? "POST" : "PUT",
          body: JSON.stringify({
            subject_id: subjectDraft.subject_id.trim(),
            body_length_cm: numberOrNull(subjectDraft.body_length_cm),
            body_weight_g: numberOrNull(subjectDraft.body_weight_g),
            body_width_cm: numberOrNull(subjectDraft.body_width_cm),
            mandibular_length_cm: numberOrNull(
              subjectDraft.mandibular_length_cm,
            ),
            gender: subjectDraft.gender.trim() || null,
            species: subjectDraft.species.trim() || null,
            time_since_last_experiment_h: numberOrNull(
              subjectDraft.time_since_last_experiment_h,
            ),
            notes: subjectDraft.notes.trim() || null,
          }),
        },
      );
      await loadSubjects();
      setEditingSubject(false);
      if (form.subject_id === subjectEditorId)
        setField("subject_id", record.subject_id);
      setNotice({
        kind: "success",
        text: `Subject “${record.subject_id}” 已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSubjectSaving(false);
    }
  };

  const deleteSubject = async (subject: SubjectRecord) => {
    if (!window.confirm(`确定删除 Subject “${subject.subject_id}”？`)) return;
    setSubjectDeleting(subject.subject_id);
    try {
      await api(`/subjects/${encodeURIComponent(subject.subject_id)}`, {
        method: "DELETE",
      });
      await loadSubjects();
      setNotice({
        kind: "success",
        text: `Subject “${subject.subject_id}” 已删除。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setSubjectDeleting(null);
    }
  };

  const newPosition = () => {
    setPositionEditorId(null);
    setPositionDraft({
      code: "",
      description: "",
      image: "",
      mark: null,
      species: "",
    });
    setEditingPosition(true);
  };

  const editPosition = (position: StimulationPosition) => {
    setPositionEditorId(position.position_id);
    setPositionDraft({
      code: position.code,
      description: position.description ?? "",
      image: position.image ?? "",
      mark: position.mark,
      species: position.species ?? "",
    });
    setEditingPosition(true);
  };

  const savePosition = async () => {
    if (!positionDraft.code.trim()) {
      setNotice({ kind: "error", text: "Position code 不能为空。" });
      return;
    }
    setPositionSaving(true);
    try {
      const record = await api<StimulationPosition>(
        positionEditorId === null
          ? "/stimulation-positions"
          : `/stimulation-positions/${positionEditorId}`,
        {
          method: positionEditorId === null ? "POST" : "PUT",
          body: JSON.stringify({
            code: positionDraft.code.trim(),
            description: positionDraft.description.trim() || null,
            image: positionDraft.image || null,
            mark: positionDraft.mark,
            species: positionDraft.species.trim() || null,
          }),
        },
      );
      await loadPositions();
      setEditingPosition(false);
      setField("position_id", String(record.position_id));
      setSelectedPositionImageId(record.image_id);
      setNotice({
        kind: "success",
        text: `Position “${record.code}” 已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setPositionSaving(false);
    }
  };

  const deletePosition = async (position: StimulationPosition) => {
    if (!window.confirm(`确定删除 Position “${position.code}”？`)) return;
    setPositionDeleting(position.position_id);
    try {
      await api(`/stimulation-positions/${position.position_id}`, {
        method: "DELETE",
      });
      await loadPositions();
      setNotice({
        kind: "success",
        text: `Position “${position.code}” 已删除。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setPositionDeleting(null);
    }
  };

  const readPositionImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) {
      setNotice({
        kind: "error",
        text: "请选择 PNG、JPEG、WebP 或 GIF 图片。",
      });
      return;
    }
    if (file.size > 2_000_000) {
      setNotice({ kind: "error", text: "Position 图片不能超过 2 MB。" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setPositionDraft((current) => ({
        ...current,
        image: typeof reader.result === "string" ? reader.result : "",
        mark: null,
      }));
    reader.readAsDataURL(file);
  };

  const startTrial = async () => {
    setNotice(null);
    if (
      !runExperimentId ||
      !form.subject_id.trim() ||
      !form.position_id ||
      !form.position_2_id ||
      form.position_id === form.position_2_id ||
      !runPositionPreview
    ) {
      setNotice({
        kind: "error",
        text: "请选择同一张图片上两个不同且已设置 mark 的 Stimulation Position。",
      });
      return;
    }
    try {
      setPendingTrial(null);
      setSelected(null);
      await api("/trials", {
        method: "POST",
        body: JSON.stringify({
          experiment_id: Number(runExperimentId),
          plan_id: activeExperimentPlan?.plan_id ?? null,
          subject_id: form.subject_id,
          body_length_cm: numberOrNull(form.body_length_cm),
          body_weight_g: numberOrNull(form.body_weight_g),
          waveform: form.waveform,
          high_level_v: Number(form.high_level_v),
          low_level_v: Number(form.low_level_v),
          duty_cycle_pct: Number(form.duty_cycle_pct),
          frequency_hz: Number(form.frequency_hz),
          duration_s: Number(form.duration_s),
          count: Number(form.count),
          interval_s: Number(form.interval_s),
          position_id: Number(form.position_id),
          position_2_id: Number(form.position_2_id),
          baseline_duration_s: Number(form.baseline_duration_s),
          post_stim_duration_s: Number(form.post_stim_duration_s),
        }),
      });
      previousTaskStatus.current = "RUNNING";
      setTask((current) => ({ ...current, status: "RUNNING", result: null }));
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "无法开始实验",
      });
    }
  };

  const lookupSubject = async (subjectId = form.subject_id) => {
    if (!subjectId.trim()) return;
    try {
      const subject = await api<{
        body_length_cm: number | null;
        body_weight_g: number | null;
      }>(`/subjects/${encodeURIComponent(subjectId.trim())}`);
      setForm((current) => ({
        ...current,
        subject_id: subjectId,
        body_length_cm: subject.body_length_cm?.toString() ?? "",
        body_weight_g: subject.body_weight_g?.toString() ?? "",
      }));
    } catch {
      // A new subject is expected to return 404; retain the user's fields.
    }
  };

  const chooseTrial = (trial: Trial) => {
    setSelected(trial);
    setAnnotation({
      latency: trial.response_latency_s?.toString() ?? "",
      action: trial.response_action ?? "",
      degree: trial.response_degree?.toString() ?? "",
    });
  };

  const beginRowEdit = (trial: Trial) => {
    setEditingId(trial.trial_id);
    setRowEdit({
      subject_id: trial.subject_id,
      trial_no: String(trial.trial_no),
      experiment_timestamp: trial.experiment_timestamp ?? "",
      stimulation_position_id: trial.stimulation_position_id?.toString() ?? "",
      stimulation_position_2_id:
        trial.stimulation_position_2_id?.toString() ?? "",
      stimulation_waveform: trial.stimulation_waveform ?? "SQUARE",
      stimulation_high_level_v: String(
        trial.stimulation_high_level_v ?? trial.stimulation_voltage_v,
      ),
      stimulation_low_level_v: String(trial.stimulation_low_level_v ?? 0),
      stimulation_duty_cycle_pct: String(
        trial.stimulation_duty_cycle_pct ?? 50,
      ),
      stimulation_frequency_hz: String(trial.stimulation_frequency_hz),
      response_latency_s: trial.response_latency_s?.toString() ?? "",
      response_action: trial.response_action ?? "",
      response_degree: trial.response_degree?.toString() ?? "",
      status: trial.status,
    });
  };

  const setRowField = (key: keyof RowEdit, value: string) => {
    setRowEdit((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveRowEdit = async () => {
    if (editingId === null || !rowEdit) return;
    setRowSaving(true);
    try {
      await api(`/trials/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...rowEdit,
          trial_no: Number(rowEdit.trial_no),
          stimulation_position_id: Number(rowEdit.stimulation_position_id),
          stimulation_position_2_id: Number(rowEdit.stimulation_position_2_id),
          stimulation_high_level_v: Number(rowEdit.stimulation_high_level_v),
          stimulation_low_level_v: Number(rowEdit.stimulation_low_level_v),
          stimulation_duty_cycle_pct: Number(
            rowEdit.stimulation_duty_cycle_pct,
          ),
          stimulation_frequency_hz: Number(rowEdit.stimulation_frequency_hz),
          response_latency_s: numberOrNull(rowEdit.response_latency_s),
          response_action: rowEdit.response_action.trim() || null,
          response_degree: numberOrNull(rowEdit.response_degree),
        }),
      });
      await Promise.all([
        loadTrials(filterRef.current, managedExperimentRef.current),
        loadExperiments(),
        loadSubjects(),
        loadPositions(),
      ]);
      if (selected?.trial_id === editingId) setSelected(null);
      setEditingId(null);
      setRowEdit(null);
      setNotice({ kind: "success", text: `Trial #${editingId} 已更新。` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "更新失败",
      });
    } finally {
      setRowSaving(false);
    }
  };

  const deleteRow = async (trial: Trial) => {
    if (!window.confirm(`确定删除 Trial #${trial.trial_id}？录像文件将保留。`))
      return;
    setDeletingId(trial.trial_id);
    try {
      await api(`/trials/${trial.trial_id}`, { method: "DELETE" });
      if (selected?.trial_id === trial.trial_id) setSelected(null);
      if (editingId === trial.trial_id) {
        setEditingId(null);
        setRowEdit(null);
      }
      await Promise.all([
        loadTrials(filterRef.current, managedExperimentRef.current),
        loadExperiments(),
        loadSubjects(),
        loadPositions(),
      ]);
      setNotice({
        kind: "success",
        text: `Trial #${trial.trial_id} 已删除，录像文件已保留。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const saveAnnotation = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/trials/${selected.trial_id}/annotation`, {
        method: "PATCH",
        body: JSON.stringify({
          response_latency_s: numberOrNull(annotation.latency),
          response_action: annotation.action.trim() || null,
          response_degree: numberOrNull(annotation.degree),
        }),
      });
      await loadTrials(filterRef.current, managedExperimentRef.current);
      setNotice({
        kind: "success",
        text: `Trial #${selected.trial_id} 标注已保存。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePendingTrial = async () => {
    if (!pendingTrial) return;
    setSaving(true);
    try {
      await api("/trials/current/commit", {
        method: "POST",
        body: JSON.stringify({
          response_latency_s: numberOrNull(annotation.latency),
          response_action: annotation.action.trim() || null,
          response_degree: numberOrNull(annotation.degree),
        }),
      });
      setPendingTrial(null);
      setTask((current) => ({ ...current, status: "IDLE" }));
      await Promise.all([
        loadTrials(filterRef.current, managedExperimentRef.current),
        loadExperiments(),
        loadSubjects(),
        loadPositions(),
      ]);
      if (runExperimentId) await selectRunExperiment(runExperimentId);
      setNotice({ kind: "success", text: "Trial 标注已保存到数据库。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const discardPendingTrial = async () => {
    if (!pendingTrial || !window.confirm("丢弃本次 Trial？录像也会被删除。"))
      return;
    setSaving(true);
    try {
      await api("/trials/current/discard", { method: "POST" });
      setPendingTrial(null);
      setTask((current) => ({ ...current, status: "IDLE", result: null }));
      setNotice({ kind: "success", text: "本次 Trial 已丢弃。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "丢弃失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (filterRef.current.trim())
        params.set("subject_id", filterRef.current.trim());
      if (managedExperimentRef.current !== null)
        params.set("experiment_id", String(managedExperimentRef.current));
      const query = params.size ? `?${params.toString()}` : "";
      const response = await fetch(`/backend/trials/export${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`CSV 导出失败 (${response.status})`);
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? "exp-recorder.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ kind: "success", text: "CSV 已导出。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "CSV 导出失败",
      });
    } finally {
      setExporting(false);
    }
  };

  const clearData = async () => {
    const confirmed = window.confirm(
      "确定清空所有 Experiment、Trial 和 Subject 数据吗？此操作无法撤销。data/videos/ 中的视频文件会保留。",
    );
    if (!confirmed) return;
    setClearing(true);
    setNotice(null);
    try {
      const result = await api<{
        trials_deleted: number;
        subjects_deleted: number;
        experiments_deleted: number;
      }>("/data", {
        method: "DELETE",
      });
      setTrials([]);
      setExperiments([]);
      setRunExperimentId("");
      setManagedExperimentId(null);
      managedExperimentRef.current = null;
      setSelected(null);
      setTask({ task_id: null, status: "IDLE", result: null, logs: [] });
      previousTaskStatus.current = "IDLE";
      setNotice({
        kind: "success",
        text: `已清空 ${result.experiments_deleted} 个 Experiment、${result.trials_deleted} 条 Trial 和 ${result.subjects_deleted} 个 Subject；视频文件已保留。`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "清空失败",
      });
    } finally {
      setClearing(false);
    }
  };

  const setField = (key: keyof TrialForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const ready = Boolean(devices?.sdg_connected && devices?.camera_connected);
  const running = task.status === "RUNNING";
  const managedExperiment =
    experiments.find((item) => item.experiment_id === managedExperimentId) ??
    null;
  const normalizedExperimentQuery = experimentQuery.trim().toLowerCase();
  const visibleExperiments = normalizedExperimentQuery
    ? experiments.filter((experiment) =>
        `${experiment.experiment_id} ${experiment.title} ${experiment.description ?? ""}`
          .toLowerCase()
          .includes(normalizedExperimentQuery),
      )
    : experiments;
  const normalizedSubjectQuery = subjectQuery.trim().toLowerCase();
  const visibleSubjects = normalizedSubjectQuery
    ? subjects.filter((subject) =>
        `${subject.subject_id} ${subject.notes ?? ""}`
          .toLowerCase()
          .includes(normalizedSubjectQuery),
      )
    : subjects;
  const normalizedPositionQuery = positionQuery.trim().toLowerCase();
  const visiblePositions = normalizedPositionQuery
    ? positions.filter((position) =>
        `${position.code} ${position.description ?? ""}`
          .toLowerCase()
          .includes(normalizedPositionQuery),
      )
    : positions;
  const statisticSubjects = Array.from(
    new Set(
      subjectPositionCombinationStatistics.map((item) => item.subject_id),
    ),
  );
  const statisticPositionCombinations = Array.from(
    new Set(
      subjectPositionCombinationStatistics.map(
        (item) => item.position_combination,
      ),
    ),
  );
  const statisticMaximum = Math.max(
    1,
    ...subjectPositionCombinationStatistics.map((item) => item.trial_count),
  );
  const positionImages = positions.filter(
    (position, index, records) =>
      position.image_id !== null &&
      records.findIndex((item) => item.image_id === position.image_id) ===
        index,
  );
  const speciesImageOptions = speciesRecords.filter(
    (species) =>
      species.image &&
      (!positionDraft.species || species.code === positionDraft.species),
  );
  const activePositionImage =
    positionImages.find(
      (position) => position.image_id === selectedPositionImageId,
    ) ??
    positionImages[0] ??
    null;
  const runPositionOne = positions.find(
    (position) => String(position.position_id) === form.position_id,
  );
  const selectedSubjectSpecies = subjects.find(
    (subject) => subject.subject_id === form.subject_id,
  )?.species;
  const runPositions = positions.filter(
    (position) =>
      !position.species || position.species === selectedSubjectSpecies,
  );
  const runPositionTwo = positions.find(
    (position) => String(position.position_id) === form.position_2_id,
  );
  const runPositionPreview =
    runPositionOne?.image_id !== null &&
    runPositionOne?.image_id === runPositionTwo?.image_id
      ? runPositionOne
      : null;
  const activeExperimentPlan = experimentPlans.find((plan) => plan.plan_id === selectedPlanId) ?? null;
  const activePlanProgress = activeExperimentPlan
    ? Math.min(100, (activeExperimentPlan.completed_trial_count / activeExperimentPlan.trial_count) * 100)
    : 0;
  const symmetricPlanDraft =
    Math.abs(Math.abs(Number(planDraft.stimulation_high_level_v)) - Math.abs(Number(planDraft.stimulation_low_level_v))) < 1e-9 &&
    Math.abs(Number(planDraft.stimulation_duty_cycle_pct) - 50) < 1e-9;

  const changeSection = (section: string) => {
    setView("manage");
    if (section === "statistics") {
      const experimentId =
        managedExperimentId ?? experiments[0]?.experiment_id ?? null;
      setStatisticsExperimentId(experimentId);
      if (experimentId)
        void loadSubjectPositionCombinationStatistics(experimentId).catch(
          () => setSubjectPositionCombinationStatistics([]),
        );
    }
    if (section === "experiments" && managedExperimentId)
      void loadExperimentPlans(managedExperimentId);
    if (section === "trials" && managedExperimentId)
      void loadTrials("", managedExperimentId);
    setManageTab((section === "species" ? "subjects" : section) as ManageTab);
  };

  const changeWorkspace = (workspace: "execute" | "manage") => {
    setView(workspace);
    if (workspace === "execute") setSelected(null);
  };

  return {
    // state
    view,
    devices,
    task,
    trials,
    experiments,
    runExperimentId,
    managedExperimentId,
    experimentQuery,
    experimentDraft,
    editingExperiment,
    experimentEditorId,
    experimentSaving,
    experimentDeleting,
    manageTab,
    subjects,
    speciesRecords,
    editingSpecies,
    speciesEditorId,
    speciesDraft,
    subjectQuery,
    editingSubject,
    subjectEditorId,
    subjectSaving,
    subjectDeleting,
    positions,
    experimentPlans,
    taskListOpen,
    selectedPlanId,
    planEditorOpen,
    planEditorId,
    planDraft,
    subjectPositionCombinationStatistics,
    statisticsExperimentId,
    positionQuery,
    editingPosition,
    positionEditorId,
    positionSaving,
    positionDeleting,
    selectedPositionImageId,
    positionDraft,
    subjectDraft,
    configurationOpen,
    form,
    defaultConfig,
    filter,
    selected,
    pendingTrial,
    annotation,
    connecting,
    saving,
    clearing,
    exporting,
    editingId,
    rowEdit,
    rowSaving,
    deletingId,
    notice,
    previewTick,
    cameraMirrored,
    cameraFlipped,
    logWindowRef,
    // setters
    setView,
    setManageTab,
    setExperimentQuery,
    setExperimentDraft,
    setEditingExperiment,
    setExperimentEditorId,
    setExperimentSaving,
    setExperimentDeleting,
    setSubjectQuery,
    setEditingSubject,
    setSubjectEditorId,
    setSubjectDraft,
    setEditingSpecies,
    setSpeciesEditorId,
    setSpeciesDraft,
    setPositionQuery,
    setEditingPosition,
    setPositionEditorId,
    setPositionDraft,
    setPositionSaving,
    setPositionDeleting,
    setSelectedPositionImageId,
    setSelected,
    setAnnotation,
    setEditingId,
    setRowEdit,
    setRowSaving,
    setDeletingId,
    setNotice,
    setCameraMirrored,
    setCameraFlipped,
    setConfigurationOpen,
    setTaskListOpen,
    setPlanEditorOpen,
    setPlanEditorId,
    setPlanDraft,
    setStatisticsExperimentId,
    setSubjectPositionCombinationStatistics,
    setForm,
    // handlers
    loadTrials,
    loadExperiments,
    loadSubjects,
    loadSpecies,
    loadPositions,
    loadSubjectPositionCombinationStatistics,
    loadExperimentPlans,
    subjectStatus,
    saveSpecies,
    newSpecies,
    selectExperimentPlan,
    saveExperimentPlan,
    editExperimentPlan,
    deleteExperimentPlan,
    selectRunExperiment,
    refresh,
    connect,
    selectManagedExperiment,
    newExperiment,
    saveExperiment,
    deleteExperiment,
    newSubject,
    editSubject,
    saveSubject,
    deleteSubject,
    newPosition,
    editPosition,
    savePosition,
    deletePosition,
    readPositionImage,
    startTrial,
    lookupSubject,
    chooseTrial,
    beginRowEdit,
    setRowField,
    saveRowEdit,
    deleteRow,
    saveAnnotation,
    savePendingTrial,
    discardPendingTrial,
    exportCsv,
    clearData,
    setField,
    changeSection,
    changeWorkspace,
    // derived
    ready,
    running,
    managedExperiment,
    visibleExperiments,
    visibleSubjects,
    visiblePositions,
    statisticSubjects,
    statisticPositionCombinations,
    statisticMaximum,
    positionImages,
    speciesImageOptions,
    activePositionImage,
    runPositionOne,
    selectedSubjectSpecies,
    runPositions,
    runPositionTwo,
    runPositionPreview,
    activeExperimentPlan,
    activePlanProgress,
    symmetricPlanDraft,
  };
}

export type RecorderContext = ReturnType<typeof useRecorder>;
