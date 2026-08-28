"""Local FastAPI server exposing the experiment controller to Next.js."""

from __future__ import annotations

from collections import deque
from contextlib import asynccontextmanager
import csv
from datetime import datetime
import io
from pathlib import Path
import threading
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
    position: str = cfg.DEFAULT_STIM_POSITION
    baseline_duration_s: float = cfg.DEFAULT_BASELINE_DURATION_S
    post_stim_duration_s: float = cfg.DEFAULT_POST_STIM_DURATION_S


class AnnotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    response_latency_s: Optional[float] = Field(default=None, ge=0)
    response_action: Optional[str] = Field(default=None, max_length=120)
    response_degree: Optional[float] = None


class TrialUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject_id: str = Field(min_length=1, max_length=120)
    trial_no: int = Field(ge=1)
    experiment_timestamp: str = Field(min_length=1, max_length=40)
    stimulation_position: str = Field(max_length=120)
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
        sdg_ok = self.sdg.connect()
        camera_ok = self.camera.connect()
        self._append_log(
            f"硬件连接完成：SDG1022X={'成功' if sdg_ok else '失败'}，"
            f"XIAO={'成功' if camera_ok else '失败'}。"
        )
        return self.device_status()

    def start_trial(self, request: TrialRequest) -> dict[str, Any]:
        with self._lock:
            if self._task_status == "RUNNING":
                raise RuntimeError("已有实验正在运行。")
            if not self.sdg.is_connected or not self.camera.is_connected:
                raise RuntimeError("硬件未就绪，请先连接两个设备。")

            subject = Subject(
                subject_id=request.subject_id.strip(),
                body_length_cm=request.body_length_cm,
                body_weight_g=request.body_weight_g,
            )
            trial_config = TrialConfig(
                subject=subject,
                trial_no=self.db.get_next_trial_no(subject.subject_id),
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
                    position=request.position.strip(),
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
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
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
            "position": cfg.DEFAULT_STIM_POSITION,
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

    @app.get("/api/subjects/{subject_id}")
    def subject(subject_id: str) -> dict[str, Any]:
        record = controller.db.get_subject(subject_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        return record

    @app.get("/api/trials")
    def trials(
        subject_id: Optional[str] = None,
        limit: int = Query(default=50, ge=1, le=200),
    ) -> list[dict[str, Any]]:
        return controller.db.list_trials(subject_id=subject_id, limit=limit)

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

    @app.get("/api/trials/export")
    def export_trials(subject_id: Optional[str] = None) -> Response:
        rows = controller.db.list_trials(subject_id=subject_id, limit=100_000)
        columns = [
            "trial_id", "subject_id", "body_length_cm", "body_weight_g", "trial_no",
            "video_id", "experiment_timestamp", "video_file", "stimulation_time",
            "stimulation_position", "stimulation_waveform", "stimulation_high_level_v",
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
        values = request.model_dump()
        values["subject_id"] = subject_id
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
