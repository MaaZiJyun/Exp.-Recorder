"""Local FastAPI server exposing the experiment controller to Next.js."""

from __future__ import annotations

from collections import deque
from contextlib import asynccontextmanager
import csv
from datetime import datetime
import io
from pathlib import Path
import re
import threading
from concurrent.futures import ThreadPoolExecutor
import uuid
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from src import config as cfg
from src.core.models import Subject, StimulusConfig, TimingConfig, TrialConfig
from src.core.trial_runner import TrialRunner
from src.database.db_manager import DatabaseManager
from src.devices.sdg1022x import SDG1022XDriver
from src.devices.xiao_camera import XiaoCameraDriver


class TrialRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_id: Optional[int] = Field(default=None, ge=1)
    subject_id: str
    body_length_cm: Optional[float] = None
    body_weight_g: Optional[float] = None
    waveform: str = cfg.DEFAULT_WAVEFORM
    high_level_v: float = cfg.DEFAULT_HIGH_LEVEL_V
    low_level_v: float = cfg.DEFAULT_LOW_LEVEL_V
    duty_cycle_pct: float = cfg.DEFAULT_DUTY_CYCLE_PCT
    frequency_hz: float = cfg.DEFAULT_FREQUENCY_HZ
    duration_s: float = cfg.DEFAULT_DURATION_S
    count: int = cfg.DEFAULT_COUNT
    interval_s: float = cfg.DEFAULT_INTERVAL_S
    position_id: int = Field(ge=1)
    position_2_id: int = Field(ge=1)
    baseline_duration_s: float = cfg.DEFAULT_BASELINE_DURATION_S
    post_stim_duration_s: float = cfg.DEFAULT_POST_STIM_DURATION_S


class AnnotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    response_latency_s: Optional[float] = Field(default=None, ge=0)
    response_action: Optional[str] = Field(default=None, max_length=120)
    response_degree: Optional[float] = None


class ExperimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class SubjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    subject_id: str = Field(min_length=1, max_length=120)
    body_length_cm: Optional[float] = Field(default=None, ge=0)
    body_weight_g: Optional[float] = Field(default=None, ge=0)
    body_width_cm: Optional[float] = Field(default=None, ge=0)
    mandibular_length_cm: Optional[float] = Field(default=None, ge=0)
    gender: Optional[str] = Field(default=None, max_length=80)
    species: Optional[str] = Field(default=None, max_length=200)
    time_since_last_experiment_h: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)


class PositionMark(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class StimulationPositionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = Field(default=None, max_length=2000)
    image: Optional[str] = Field(default=None, max_length=3_000_000)
    mark: Optional[PositionMark] = None


_POSITION_IMAGE_PATTERN = re.compile(
    r"^data:image/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$"
)


def _validate_position_image(image: Optional[str]) -> Optional[str]:
    if not image:
        return None
    if not _POSITION_IMAGE_PATTERN.fullmatch(image):
        raise ValueError("Position image 必须是 PNG、JPEG、WebP 或 GIF 图片。")
    return image


def _position_mark(request: StimulationPositionRequest) -> Optional[dict[str, float]]:
    if request.mark is not None and not request.image:
        raise ValueError("设置 mark 前必须先选择图片。")
    return request.mark.model_dump() if request.mark is not None else None


def _validate_position_pair(
    position: dict[str, Any], position_2: dict[str, Any]
) -> None:
    if position["position_id"] == position_2["position_id"]:
        raise ValueError("两个 Stimulation Position 必须不同。")
    if (
        position.get("image_id") is None
        or position_2.get("image_id") is None
        or position.get("mark") is None
        or position_2.get("mark") is None
    ):
        raise ValueError("两个 Stimulation Position 都必须设置图片和 mark。")
    if position["image_id"] != position_2["image_id"]:
        raise ValueError("两个 Stimulation Position 必须使用同一张图片。")


class TrialUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_id: Optional[int] = Field(default=None, ge=1)
    subject_id: str = Field(min_length=1, max_length=120)
    trial_no: int = Field(ge=1)
    experiment_timestamp: str = Field(min_length=1, max_length=40)
    stimulation_position_id: int = Field(ge=1)
    stimulation_position_2_id: int = Field(ge=1)
    stimulation_waveform: str = Field(min_length=1, max_length=40)
    stimulation_high_level_v: float
    stimulation_low_level_v: float
    stimulation_duty_cycle_pct: float = Field(gt=0, lt=100)
    stimulation_frequency_hz: float = Field(gt=0)
    response_latency_s: Optional[float] = Field(default=None, ge=0)
    response_action: Optional[str] = Field(default=None, max_length=120)
    response_degree: Optional[float] = Field(default=None, ge=0, le=3)
    status: str = Field(pattern="^(RUNNING|COMPLETED|FAILED|ABORTED)$")


class ExperimentController:
    """Owns hardware connections and the single active trial task."""

    def __init__(self, mock: bool = False, db_path: Optional[Path] = None):
        self.mock = mock
        self.db = DatabaseManager(db_path=db_path)
        self.sdg = SDG1022XDriver(mock=mock)
        self.camera = XiaoCameraDriver(mock=mock)
        self._lock = threading.RLock()
        self._logs: deque[dict[str, str]] = deque(maxlen=250)
        self._task_id: Optional[str] = None
        self._task_status = "IDLE"
        self._task_result: Optional[dict[str, Any]] = None
        self.runner = TrialRunner(
            sdg_driver=self.sdg,
            camera_driver=self.camera,
            db_manager=self.db,
            status_callback=self._append_log,
            persist_results=False,
        )

    def _append_log(self, message: str) -> None:
        with self._lock:
            self._logs.append(
                {
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "message": message,
                }
            )

    def device_status(self) -> dict[str, Any]:
        return {
            "mock": self.mock,
            "sdg_connected": self.sdg.is_connected,
            "sdg_error": self.sdg.last_error,
            "camera_connected": self.camera.is_connected,
            "camera_recording": self.camera.is_recording,
            "camera_error": self.camera.last_error,
        }

    def connect_devices(self) -> dict[str, Any]:
        with self._lock:
            if self._task_status == "RUNNING":
                raise RuntimeError("实验运行中，不能重新连接硬件。")
        self._append_log("正在重新连接硬件…")
        self.sdg.disconnect()
        self.camera.disconnect()
        # The devices are independent. Connecting concurrently prevents a VISA
        # timeout from delaying camera detection (and vice versa).
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="hardware-connect") as pool:
            sdg_future = pool.submit(self.sdg.connect)
            camera_future = pool.submit(self.camera.connect)
            sdg_ok = sdg_future.result()
            camera_ok = camera_future.result()
        self._append_log(
            f"硬件连接完成：SDG1022X={'成功' if sdg_ok else '失败'}，"
            f"XIAO={'成功' if camera_ok else '失败'}。"
        )
        return self.device_status()

    def start_trial(self, request: TrialRequest) -> dict[str, Any]:
        with self._lock:
            if self._task_status == "RUNNING":
                raise RuntimeError("已有实验正在运行。")
            if self._task_status == "COMPLETED" and self._task_result and self._task_result.get("trial_id") is None:
                raise RuntimeError("请先保存或丢弃上一个待标注 Trial。")
            if not self.sdg.is_connected or not self.camera.is_connected:
                raise RuntimeError("硬件未就绪，请先连接两个设备。")
            if (
                request.experiment_id is not None
                and self.db.get_experiment(request.experiment_id) is None
            ):
                raise ValueError(f"Experiment ID {request.experiment_id} 不存在。")
            subject_id = request.subject_id.strip()
            if self.db.get_subject(subject_id) is None:
                raise ValueError(f"Subject {subject_id} 不存在，请先在 Manage > Subjects 中创建。")
            position = self.db.get_stimulation_position(request.position_id)
            position_2 = self.db.get_stimulation_position(request.position_2_id)
            if position is None or position_2 is None:
                raise ValueError("请选择数据库中已标记的 Stimulation Position。")
            _validate_position_pair(position, position_2)

            subject = Subject(
                subject_id=subject_id,
                body_length_cm=request.body_length_cm,
                body_weight_g=request.body_weight_g,
            )
            trial_config = TrialConfig(
                subject=subject,
                trial_no=self.db.get_next_trial_no(
                    subject.subject_id,
                    request.experiment_id,
                ),
                experiment_id=request.experiment_id,
                stimulus=StimulusConfig(
                    voltage_v=request.high_level_v - request.low_level_v,
                    waveform=request.waveform,
                    high_level_v=request.high_level_v,
                    low_level_v=request.low_level_v,
                    duty_cycle_pct=request.duty_cycle_pct,
                    frequency_hz=request.frequency_hz,
                    duration_s=request.duration_s,
                    count=request.count,
                    interval_s=request.interval_s,
                    position=f"{position['code']}{position_2['code']}",
                    position_id=position["position_id"],
                    position_2_id=position_2["position_id"],
                ),
                timing=TimingConfig(
                    baseline_duration_s=request.baseline_duration_s,
                    post_stim_duration_s=request.post_stim_duration_s,
                ),
            )
            trial_config.validate()
            self._task_id = uuid.uuid4().hex
            self._task_status = "RUNNING"
            self._task_result = None
            task_id = self._task_id

        def worker() -> None:
            result = self.runner.run_trial(trial_config)
            with self._lock:
                self._task_result = result.to_dict()
                self._task_status = result.status

        threading.Thread(target=worker, name=f"trial-{task_id[:8]}", daemon=True).start()
        return {"task_id": task_id, "status": "RUNNING", "trial_no": trial_config.trial_no}

    def current_task(self) -> dict[str, Any]:
        with self._lock:
            return {
                "task_id": self._task_id,
                "status": self._task_status,
                "result": self._task_result,
                "logs": list(self._logs),
            }

    def commit_pending_trial(self, annotation: AnnotationRequest) -> int:
        with self._lock:
            if self._task_status != "COMPLETED" or not self._task_result:
                raise RuntimeError("当前没有等待标注的 Trial。")
            result = dict(self._task_result)
            result["response_latency_s"] = annotation.response_latency_s
            result["response_action"] = annotation.response_action
            result["response_degree"] = annotation.response_degree
            trial_id = self.db.insert_trial(result)
            result["trial_id"] = trial_id
            self._task_result = result
            self._task_status = "IDLE"
            self._append_log(f"Trial recorded to database (Trial ID: {trial_id}).")
            return trial_id

    def discard_pending_trial(self) -> None:
        with self._lock:
            if self._task_status != "COMPLETED" or not self._task_result:
                raise RuntimeError("当前没有等待标注的 Trial。")
            video_file = self._task_result.get("video_file")
            if video_file:
                path = Path(video_file)
                if not path.is_absolute():
                    path = cfg.VIDEO_DIR / path.name
                try:
                    if path.resolve().parent == cfg.VIDEO_DIR.resolve() and path.is_file():
                        path.unlink()
                except OSError:
                    logger.warning("Unable to remove discarded video %s", path)
            self._task_result = None
            self._task_status = "IDLE"
            self._append_log("Pending Trial discarded.")

    def clear_data(self) -> dict[str, int]:
        with self._lock:
            if self._task_status == "RUNNING":
                raise RuntimeError("实验运行中，不能清空数据。")
            result = self.db.clear_all_data()
            self._task_id = None
            self._task_status = "IDLE"
            self._task_result = None
            self._logs.clear()
        return result

    def close(self) -> None:
        try:
            self.sdg.disconnect()
        finally:
            self.camera.disconnect()


def create_app(mock: bool = False, db_path: Optional[Path] = None) -> FastAPI:
    controller = ExperimentController(mock=mock, db_path=db_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        controller.close()

    app = FastAPI(
        title="Exp.-Recorder API",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.controller = controller
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/config")
    def defaults() -> dict[str, Any]:
        return {
            "waveform": cfg.DEFAULT_WAVEFORM,
            "high_level_v": cfg.DEFAULT_HIGH_LEVEL_V,
            "low_level_v": cfg.DEFAULT_LOW_LEVEL_V,
            "duty_cycle_pct": cfg.DEFAULT_DUTY_CYCLE_PCT,
            "frequency_hz": cfg.DEFAULT_FREQUENCY_HZ,
            "duration_s": cfg.DEFAULT_DURATION_S,
            "count": cfg.DEFAULT_COUNT,
            "interval_s": cfg.DEFAULT_INTERVAL_S,
            "baseline_duration_s": cfg.DEFAULT_BASELINE_DURATION_S,
            "post_stim_duration_s": cfg.DEFAULT_POST_STIM_DURATION_S,
        }

    @app.get("/api/devices")
    def devices() -> dict[str, Any]:
        return controller.device_status()

    @app.get("/api/camera/frame")
    def camera_frame() -> Response:
        frame = controller.camera.capture_frame()
        if frame is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=controller.camera.last_error or "Camera preview is not available",
            )
        return Response(content=frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @app.post("/api/devices/connect")
    def connect_devices() -> dict[str, Any]:
        try:
            return controller.connect_devices()
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @app.get("/api/subjects")
    def subjects() -> list[dict[str, Any]]:
        return controller.db.list_subjects()

    @app.post("/api/subjects", status_code=status.HTTP_201_CREATED)
    def create_subject(request: SubjectRequest) -> dict[str, Any]:
        if controller.db.get_subject(request.subject_id) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subject ID already exists")
        controller.db.upsert_subject(
            request.subject_id,
            request.body_length_cm,
            request.body_weight_g,
            request.notes or None,
            request.body_width_cm,
            request.mandibular_length_cm,
            request.gender or None,
            request.species or None,
            request.time_since_last_experiment_h,
        )
        return controller.db.get_subject(request.subject_id) or {}

    @app.get("/api/subjects/{subject_id}")
    def subject(subject_id: str) -> dict[str, Any]:
        record = controller.db.get_subject(subject_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        return record

    @app.put("/api/subjects/{subject_id}")
    def update_subject(subject_id: str, request: SubjectRequest) -> dict[str, Any]:
        if controller.current_task()["status"] == "RUNNING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="实验运行中，不能编辑 Subject。")
        try:
            updated = controller.db.update_subject(
                subject_id,
                request.subject_id,
                request.body_length_cm,
                request.body_weight_g,
                request.notes or None,
                request.body_width_cm,
                request.mandibular_length_cm,
                request.gender or None,
                request.species or None,
                request.time_since_last_experiment_h,
            )
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subject ID already exists") from exc
            raise
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        return controller.db.get_subject(request.subject_id) or {}

    @app.delete("/api/subjects/{subject_id}")
    def delete_subject(subject_id: str) -> dict[str, bool]:
        if controller.current_task()["status"] == "RUNNING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="实验运行中，不能删除 Subject。")
        record = controller.db.get_subject(subject_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        if record["trial_count"]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="请先删除该 Subject 的所有 Trial。")
        controller.db.delete_subject(subject_id)
        return {"deleted": True}

    @app.get("/api/stimulation-positions")
    def stimulation_positions() -> list[dict[str, Any]]:
        return controller.db.list_stimulation_positions()

    @app.get("/api/statistics/subject-position-combinations")
    def subject_position_combination_statistics(
        experiment_id: Optional[int] = Query(default=None, ge=1),
    ) -> list[dict[str, Any]]:
        return controller.db.list_subject_position_combination_statistics(experiment_id)

    @app.post("/api/stimulation-positions", status_code=status.HTTP_201_CREATED)
    def create_stimulation_position(request: StimulationPositionRequest) -> dict[str, Any]:
        try:
            position_id = controller.db.create_stimulation_position(
                request.code.upper(),
                request.description or None,
                _validate_position_image(request.image),
                _position_mark(request),
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Position code already exists") from exc
            raise
        return controller.db.get_stimulation_position(position_id) or {}

    @app.put("/api/stimulation-positions/{position_id}")
    def update_stimulation_position(
        position_id: int, request: StimulationPositionRequest
    ) -> dict[str, Any]:
        if controller.current_task()["status"] == "RUNNING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="实验运行中，不能编辑 Position。")
        try:
            updated = controller.db.update_stimulation_position(
                position_id,
                request.code.upper(),
                request.description or None,
                _validate_position_image(request.image),
                _position_mark(request),
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Position code already exists") from exc
            raise
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")
        return controller.db.get_stimulation_position(position_id) or {}

    @app.delete("/api/stimulation-positions/{position_id}")
    def delete_stimulation_position(position_id: int) -> dict[str, bool]:
        if controller.current_task()["status"] == "RUNNING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="实验运行中，不能删除 Position。")
        record = controller.db.get_stimulation_position(position_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")
        if record["trial_count"]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该 Position 已被 Trial 使用，不能删除。")
        controller.db.delete_stimulation_position(position_id)
        return {"deleted": True}

    @app.get("/api/experiments")
    def experiments() -> list[dict[str, Any]]:
        return controller.db.list_experiments()

    @app.post("/api/experiments", status_code=status.HTTP_201_CREATED)
    def create_experiment(request: ExperimentRequest) -> dict[str, Any]:
        experiment_id = controller.db.insert_experiment(
            request.title,
            request.description or None,
        )
        return controller.db.get_experiment(experiment_id) or {}

    @app.get("/api/experiments/{experiment_id}")
    def experiment(experiment_id: int) -> dict[str, Any]:
        record = controller.db.get_experiment(experiment_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
        return record

    @app.put("/api/experiments/{experiment_id}")
    def update_experiment(experiment_id: int, request: ExperimentRequest) -> dict[str, Any]:
        updated = controller.db.update_experiment(
            experiment_id,
            request.title,
            request.description or None,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
        return controller.db.get_experiment(experiment_id) or {}

    @app.delete("/api/experiments/{experiment_id}")
    def delete_experiment(experiment_id: int) -> dict[str, bool]:
        record = controller.db.get_experiment(experiment_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
        if record["trial_count"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="请先删除该 Experiment 中的所有 Trial。",
            )
        controller.db.delete_experiment(experiment_id)
        return {"deleted": True}

    @app.get("/api/trials")
    def trials(
        subject_id: Optional[str] = None,
        experiment_id: Optional[int] = Query(default=None, ge=1),
        limit: int = Query(default=50, ge=1, le=200),
    ) -> list[dict[str, Any]]:
        return controller.db.list_trials(
            subject_id=subject_id,
            experiment_id=experiment_id,
            limit=limit,
        )

    @app.get("/api/trials/{trial_id}/video")
    def trial_video(trial_id: int) -> FileResponse:
        record = next((item for item in controller.db.list_trials(limit=100_000) if item["trial_id"] == trial_id), None)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trial not found")
        stored_path = Path(record["video_file"])
        video_path = (stored_path if stored_path.is_absolute() else cfg.VIDEO_DIR / stored_path.name).resolve()
        video_root = cfg.VIDEO_DIR.resolve()
        if video_path.parent != video_root or not video_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found")
        media_type = "video/webm" if video_path.suffix.lower() == ".webm" else "video/x-msvideo"
        return FileResponse(video_path, media_type=media_type, filename=video_path.name)

    @app.get("/api/pending-trial/video")
    def pending_trial_video() -> FileResponse:
        current = controller.current_task()
        if current["status"] != "COMPLETED" or not current["result"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending Trial")
        stored_path = Path(current["result"].get("video_file", ""))
        video_path = (stored_path if stored_path.is_absolute() else cfg.VIDEO_DIR / stored_path.name).resolve()
        if video_path.parent != cfg.VIDEO_DIR.resolve() or not video_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found")
        return FileResponse(video_path, media_type="video/webm", filename=video_path.name)

    @app.get("/api/trials/export")
    def export_trials(
        subject_id: Optional[str] = None,
        experiment_id: Optional[int] = Query(default=None, ge=1),
    ) -> Response:
        rows = controller.db.list_trials(
            subject_id=subject_id,
            experiment_id=experiment_id,
            limit=100_000,
        )
        columns = [
            "trial_id", "experiment_id", "subject_id", "body_length_cm",
            "body_weight_g", "body_width_cm", "mandibular_length_cm",
            "gender", "species", "time_since_last_experiment_h", "trial_no",
            "video_id", "experiment_timestamp", "video_file", "stimulation_time",
            "stimulation_position_id", "stimulation_position_2_id", "stimulation_position",
            "stimulation_waveform", "stimulation_high_level_v",
            "stimulation_low_level_v", "stimulation_duty_cycle_pct",
            "stimulation_voltage_v", "stimulation_frequency_hz", "stimulation_duration_s",
            "stimulation_count", "stimulation_interval_s", "baseline_duration_s",
            "post_stim_duration_s", "response_latency_s", "response_action",
            "response_degree", "status", "error_message",
        ]
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        filename = f"exp-recorder-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
        return Response(
            content="\ufeff" + output.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @app.post("/api/trials", status_code=status.HTTP_202_ACCEPTED)
    def start_trial(request: TrialRequest) -> dict[str, Any]:
        try:
            return controller.start_trial(request)
        except (RuntimeError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @app.get("/api/trials/current")
    def current_trial() -> dict[str, Any]:
        return controller.current_task()

    @app.post("/api/trials/current/commit")
    def commit_pending_trial(request: AnnotationRequest) -> dict[str, Any]:
        try:
            trial_id = controller.commit_pending_trial(request)
            return {"trial_id": trial_id}
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @app.post("/api/trials/current/discard")
    def discard_pending_trial() -> dict[str, bool]:
        try:
            controller.discard_pending_trial()
            return {"discarded": True}
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @app.patch("/api/trials/{trial_id}/annotation")
    def annotate_trial(trial_id: int, request: AnnotationRequest) -> dict[str, bool]:
        updated = controller.db.update_trial_response(
            trial_id=trial_id,
            response_latency_s=request.response_latency_s,
            response_action=request.response_action,
            response_degree=request.response_degree,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trial not found")
        return {"updated": True}

    @app.put("/api/trials/{trial_id}")
    def update_trial(trial_id: int, request: TrialUpdateRequest) -> dict[str, bool]:
        if controller.current_task()["status"] == "RUNNING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="实验运行中，不能编辑记录。")
        subject_id = request.subject_id.strip()
        controller.db.upsert_subject(subject_id)
        position = controller.db.get_stimulation_position(request.stimulation_position_id)
        position_2 = controller.db.get_stimulation_position(request.stimulation_position_2_id)
        if position is None or position_2 is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="请选择数据库中已标记的 Stimulation Position。",
            )
        try:
            _validate_position_pair(position, position_2)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        values = request.model_dump(exclude_unset=True)
        values["subject_id"] = subject_id
        values["stimulation_position"] = f"{position['code']}{position_2['code']}"
        values["stimulation_voltage_v"] = request.stimulation_high_level_v - request.stimulation_low_level_v
        updated = controller.db.update_trial(trial_id, values)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trial not found")
        return {"updated": True}

    @app.delete("/api/trials/{trial_id}")
    def delete_trial(trial_id: int) -> dict[str, bool]:
        if controller.current_task()["status"] == "RUNNING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="实验运行中，不能删除记录。")
        deleted = controller.db.delete_trial(trial_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trial not found")
        return {"deleted": True}

    @app.delete("/api/data")
    def clear_data() -> dict[str, int]:
        try:
            return controller.clear_data()
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return app
