"""Modern Native GUI for Experiment Automation Controller."""

import tkinter as tk
from tkinter import ttk, messagebox
import threading
import queue
from datetime import datetime

from src.core.models import Subject, StimulusConfig, TimingConfig, TrialConfig
from src.core.trial_runner import TrialRunner
from src.database.db_manager import DatabaseManager
from src.devices.sdg1022x import SDG1022XDriver
from src.devices.xiao_camera import XiaoCameraDriver
from src import config as cfg


RESPONSE_ACTIONS = (
    ("0", "静止", "Stationary"),
    ("1", "前进", "Forward"),
    ("2", "后退", "Backward"),
    ("3", "左转", "Turn Left"),
    ("4", "右转", "Turn Right"),
    ("5", "前左斜行", "Forward-Left"),
    ("6", "前右斜行", "Forward-Right"),
    ("7", "后左斜退", "Backward-Left"),
    ("8", "后右斜退", "Backward-Right"),
    ("9", "抬头", "Head Raising"),
)
RESPONSE_DEGREES = (
    ("0", "无反应"),
    ("1", "轻微反应"),
    ("2", "积极反应"),
    ("3", "过激反应"),
)
ACTION_OPTIONS = tuple(f"{code} · {zh} / {en}" for code, zh, en in RESPONSE_ACTIONS)
DEGREE_OPTIONS = tuple(f"{score} · {level}" for score, level in RESPONSE_DEGREES)


class ExperimentAppGUI(tk.Tk):
    def __init__(self, mock: bool = False):
        super().__init__()
        self.title("Exp.-Recorder | 实验自动化控制系统")
        self.geometry("1180x750")
        self.minsize(1000, 650)

        self.mock = mock
        self._ui_events = queue.Queue()
        self._connecting = False
        self._trial_running = False
        self.db = DatabaseManager()
        self.sdg = SDG1022XDriver(mock=mock)
        self.camera = XiaoCameraDriver(mock=mock)
        self.runner = TrialRunner(
            sdg_driver=self.sdg,
            camera_driver=self.camera,
            db_manager=self.db,
            status_callback=self.log_status
        )

        self._setup_style()
        self._build_ui()
        self._refresh_trial_history()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(50, self._drain_ui_events)
        
        # Connect hardware asynchronously so UI renders instantly
        self.after(200, self.connect_hardware)

    def _setup_style(self):
        style = ttk.Style(self)
        # Use native macOS Aqua theme if available, otherwise default
        available_themes = style.theme_names()
        if "aqua" in available_themes:
            style.theme_use("aqua")
        elif "clam" in available_themes:
            style.theme_use("clam")

        style.configure("TLabel", font=("Helvetica", 11))
        style.configure("TButton", font=("Helvetica", 11))
        style.configure("Header.TLabel", font=("Helvetica", 13, "bold"), foreground="#1976D2")
        style.configure("Status.TLabel", font=("Helvetica", 11, "bold"))
        style.configure("Start.TButton", font=("Helvetica", 13, "bold"))

    def _build_ui(self):
        # Top banner
        header_frame = ttk.Frame(self, padding=(15, 8))
        header_frame.pack(side=tk.TOP, fill=tk.X)
        ttk.Label(
            header_frame,
            text="🔬 实验自动化控制系统 (Exp.-Recorder)",
            style="Header.TLabel"
        ).pack(side=tk.LEFT)

        # Main content area: Left Panel + Right Panel
        container = ttk.Frame(self, padding=10)
        container.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        left_frame = ttk.Frame(container, width=440)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 10))

        right_frame = ttk.Frame(container)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # ----------------- Left Frame Components -----------------
        # 1. Device Connection Box
        dev_box = ttk.LabelFrame(left_frame, text=" 硬件连接状态 (Hardware) ", padding=10)
        dev_box.pack(fill=tk.X, pady=(0, 8))

        self.lbl_sdg = ttk.Label(dev_box, text="SDG1022X: 检测中...", foreground="#666666", style="Status.TLabel")
        self.lbl_sdg.grid(row=0, column=0, sticky=tk.W, pady=3)
        self.lbl_cam = ttk.Label(dev_box, text="XIAO ESP32S3: 检测中...", foreground="#666666", style="Status.TLabel")
        self.lbl_cam.grid(row=1, column=0, sticky=tk.W, pady=3)

        self.btn_conn = ttk.Button(dev_box, text="🔄 重新连接", command=self.connect_hardware)
        self.btn_conn.grid(row=0, column=1, rowspan=2, padx=15, sticky=tk.E)

        # 2. Subject Box
        subj_box = ttk.LabelFrame(left_frame, text=" 实验对象 (Subject Info) ", padding=10)
        subj_box.pack(fill=tk.X, pady=(0, 8))

        ttk.Label(subj_box, text="Subject ID:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.ent_subj_id = ttk.Entry(subj_box, width=16)
        self.ent_subj_id.insert(0, "B01")
        self.ent_subj_id.grid(row=0, column=1, sticky=tk.W, pady=2)
        self.ent_subj_id.bind("<FocusOut>", self._on_subject_id_change)

        ttk.Label(subj_box, text="体长 (Length cm):").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.ent_subj_len = ttk.Entry(subj_box, width=16)
        self.ent_subj_len.grid(row=1, column=1, sticky=tk.W, pady=2)

        ttk.Label(subj_box, text="体重 (Weight g):").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.ent_subj_wt = ttk.Entry(subj_box, width=16)
        self.ent_subj_wt.grid(row=2, column=1, sticky=tk.W, pady=2)

        # 3. Stimulus & Timing Box
        stim_box = ttk.LabelFrame(left_frame, text=" 刺激与时间参数 (Stimulus & Timing) ", padding=10)
        stim_box.pack(fill=tk.X, pady=(0, 8))

        fields = [
            ("电压 Voltage (V):", "ent_voltage", str(cfg.DEFAULT_VOLTAGE_V)),
            ("频率 Frequency (Hz):", "ent_freq", str(cfg.DEFAULT_FREQUENCY_HZ)),
            ("持续时间 Duration (s):", "ent_dur", str(cfg.DEFAULT_DURATION_S)),
            ("脉冲次数 Count:", "ent_count", str(cfg.DEFAULT_COUNT)),
            ("间隔时间 Interval (s):", "ent_interval", str(cfg.DEFAULT_INTERVAL_S)),
            ("刺激部位 Position:", "ent_pos", cfg.DEFAULT_STIM_POSITION),
            ("前置基线 Baseline (s):", "ent_baseline", str(cfg.DEFAULT_BASELINE_DURATION_S)),
            ("后置录像 Post-stim (s):", "ent_post", str(cfg.DEFAULT_POST_STIM_DURATION_S)),
        ]

        for idx, (label_text, attr_name, default_val) in enumerate(fields):
            ttk.Label(stim_box, text=label_text).grid(row=idx, column=0, sticky=tk.W, pady=2)
            entry = ttk.Entry(stim_box, width=16)
            entry.insert(0, default_val)
            entry.grid(row=idx, column=1, sticky=tk.W, pady=2)
            setattr(self, attr_name, entry)

        # 4. START BUTTON
        self.btn_start = tk.Button(
            left_frame,
            text="▶ 开始实验 (START TRIAL)",
            font=("Helvetica", 14, "bold"),
            bg="#2E7D32",
            fg="white",
            activebackground="#1B5E20",
            activeforeground="white",
            relief=tk.RAISED,
            cursor="hand2",
            command=self.start_trial_threaded
        )
        self.btn_start.pack(fill=tk.X, ipady=6, pady=6)

        # 5. Live log output
        log_box = ttk.LabelFrame(left_frame, text=" 运行日志 (Log) ", padding=6)
        log_box.pack(fill=tk.BOTH, expand=True)

        self.txt_log = tk.Text(log_box, height=7, font=("Courier", 11), bg="#F8F9FA", fg="#212529")
        log_scroll = ttk.Scrollbar(log_box, orient=tk.VERTICAL, command=self.txt_log.yview)
        self.txt_log.configure(yscrollcommand=log_scroll.set)
        log_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.txt_log.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # ----------------- Right Frame Components -----------------
        hist_box = ttk.LabelFrame(right_frame, text=" 历史记录与人工标注 (Trials & Annotation) ", padding=10)
        hist_box.pack(fill=tk.BOTH, expand=True)

        # Filter bar
        filter_bar = ttk.Frame(hist_box)
        filter_bar.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(filter_bar, text="按 Subject 筛选:").pack(side=tk.LEFT, padx=5)
        self.ent_filter_subj = ttk.Entry(filter_bar, width=12)
        self.ent_filter_subj.pack(side=tk.LEFT, padx=5)
        ttk.Button(filter_bar, text="🔍 筛选 / 刷新", command=self._refresh_trial_history).pack(side=tk.LEFT, padx=5)

        # Treeview Frame
        tree_frame = ttk.Frame(hist_box)
        tree_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        cols = ("ID", "Subject", "Trial", "Video ID", "Voltage", "Freq", "Stim Time", "Status", "Latency(s)", "Action", "Degree")
        self.tree_trials = ttk.Treeview(tree_frame, columns=cols, show="headings", height=14)
        for c in cols:
            self.tree_trials.heading(c, text=c)
            self.tree_trials.column(c, width=65, anchor=tk.CENTER)
        self.tree_trials.column("Video ID", width=190)
        self.tree_trials.column("Stim Time", width=140)

        tree_scroll = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.tree_trials.yview)
        self.tree_trials.configure(yscrollcommand=tree_scroll.set)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_trials.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.tree_trials.bind("<<TreeviewSelect>>", self._on_tree_select)

        # Annotation Sub-panel
        anno_frame = ttk.LabelFrame(hist_box, text=" 视频行为标注 (Video Response Annotation) ", padding=10)
        anno_frame.pack(fill=tk.X, pady=(10, 0))

        ttk.Label(anno_frame, text="选中 Trial ID:").grid(row=0, column=0, sticky=tk.W)
        self.lbl_selected_trial = ttk.Label(anno_frame, text="-", font=("Helvetica", 12, "bold"), foreground="#1976D2")
        self.lbl_selected_trial.grid(row=0, column=1, sticky=tk.W, padx=5)

        ttk.Label(anno_frame, text="响应时延 Latency (s):").grid(row=0, column=2, sticky=tk.W, padx=10)
        self.ent_resp_latency = ttk.Entry(anno_frame, width=10)
        self.ent_resp_latency.grid(row=0, column=3, sticky=tk.W)

        ttk.Label(anno_frame, text="响应动作 Action:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.ent_resp_action = ttk.Combobox(anno_frame, width=24, values=ACTION_OPTIONS, state="readonly")
        self.ent_resp_action.grid(row=1, column=1, sticky=tk.W, pady=5)

        ttk.Label(anno_frame, text="响应程度 Degree:").grid(row=1, column=2, sticky=tk.W, padx=10, pady=5)
        self.ent_resp_degree = ttk.Combobox(anno_frame, width=12, values=DEGREE_OPTIONS, state="readonly")
        self.ent_resp_degree.grid(row=1, column=3, sticky=tk.W, pady=5)

        ttk.Button(anno_frame, text="💾 保存标注结果", command=self._save_annotation).grid(row=1, column=4, padx=15)

    def log_status(self, msg: str):
        """Thread-safe status callback used by TrialRunner workers."""
        self._ui_events.put(("log", msg))

    def _append_log(self, msg: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.txt_log.insert(tk.END, f"[{timestamp}] {msg}\n")
        self.txt_log.see(tk.END)

    def _drain_ui_events(self):
        try:
            while True:
                event, payload = self._ui_events.get_nowait()
                if event == "log":
                    self._append_log(payload)
                elif event == "connection":
                    self._update_conn_ui(*payload)
                elif event == "trial_finished":
                    self._on_trial_finished(payload)
        except queue.Empty:
            pass
        self.after(50, self._drain_ui_events)

    def connect_hardware(self):
        if self._connecting or self._trial_running:
            return
        self._connecting = True
        self.lbl_sdg.config(text="SDG1022X: 正在连接...", foreground="#E65100")
        self.lbl_cam.config(text="XIAO ESP32S3: 正在连接...", foreground="#E65100")
        self.btn_conn.config(state=tk.DISABLED)

        def _conn_thread():
            self.sdg.disconnect()
            self.camera.disconnect()
            sdg_ok = self.sdg.connect()
            cam_ok = self.camera.connect()
            self._ui_events.put(("connection", (sdg_ok, cam_ok)))

        threading.Thread(target=_conn_thread, daemon=True).start()

    def _update_conn_ui(self, sdg_ok: bool, cam_ok: bool):
        self._connecting = False
        self.btn_conn.config(state=tk.NORMAL)
        self.lbl_sdg.config(
            text=f"SDG1022X: {'● 已连接' if sdg_ok else '○ 未连接'}{' (Mock)' if self.mock else ''}",
            foreground="#2E7D32" if sdg_ok else "#C62828"
        )
        self.lbl_cam.config(
            text=f"XIAO ESP32S3: {'● 已连接' if cam_ok else '○ 未连接'}{' (Mock)' if self.mock else ''}",
            foreground="#2E7D32" if cam_ok else "#C62828"
        )
        if sdg_ok and cam_ok:
            self.log_status("所有硬件连接成功，系统就绪。")
        else:
            self.log_status(f"硬件连接状态: SDG1022X={sdg_ok}, XIAO={cam_ok}")

    def _on_subject_id_change(self, event=None):
        subj_id = self.ent_subj_id.get().strip()
        if not subj_id:
            return
        subj = self.db.get_subject(subj_id)
        if subj:
            if subj.get("body_length_cm") is not None:
                self.ent_subj_len.delete(0, tk.END)
                self.ent_subj_len.insert(0, str(subj["body_length_cm"]))
            if subj.get("body_weight_g") is not None:
                self.ent_subj_wt.delete(0, tk.END)
                self.ent_subj_wt.insert(0, str(subj["body_weight_g"]))

    def start_trial_threaded(self):
        if self._trial_running:
            return
        if not self.sdg.is_connected or not self.camera.is_connected:
            messagebox.showwarning("硬件未就绪", "请先连接 SDG1022X 和 XIAO ESP32S3。")
            return
        subj_id = self.ent_subj_id.get().strip()
        if not subj_id:
            messagebox.showwarning("提示", "请输入 Subject ID")
            return

        try:
            body_len = float(self.ent_subj_len.get().strip()) if self.ent_subj_len.get().strip() else None
            body_wt = float(self.ent_subj_wt.get().strip()) if self.ent_subj_wt.get().strip() else None
            voltage = float(self.ent_voltage.get().strip())
            freq = float(self.ent_freq.get().strip())
            dur = float(self.ent_dur.get().strip())
            count = int(self.ent_count.get().strip())
            interval = float(self.ent_interval.get().strip())
            pos = self.ent_pos.get().strip()
            baseline = float(self.ent_baseline.get().strip())
            post_stim = float(self.ent_post.get().strip())
        except ValueError as e:
            messagebox.showerror("参数错误", f"输入格式不正确: {e}")
            return

        subject = Subject(subject_id=subj_id, body_length_cm=body_len, body_weight_g=body_wt)
        trial_no = self.db.get_next_trial_no(subj_id)
        stimulus = StimulusConfig(
            voltage_v=voltage,
            frequency_hz=freq,
            duration_s=dur,
            count=count,
            interval_s=interval,
            position=pos
        )
        timing = TimingConfig(baseline_duration_s=baseline, post_stim_duration_s=post_stim)
        trial_config = TrialConfig(subject=subject, trial_no=trial_no, stimulus=stimulus, timing=timing)
        try:
            trial_config.validate()
        except ValueError as e:
            messagebox.showerror("参数错误", str(e))
            return

        self._trial_running = True
        self.btn_start.config(state=tk.DISABLED, text="⏳ 实验执行中...", bg="#757575")
        self.btn_conn.config(state=tk.DISABLED)

        def _worker():
            result = self.runner.run_trial(trial_config)
            self._ui_events.put(("trial_finished", result))

        threading.Thread(target=_worker, daemon=True).start()

    def _on_trial_finished(self, result):
        self._trial_running = False
        self.btn_start.config(state=tk.NORMAL, text="▶ 开始实验 (START TRIAL)", bg="#2E7D32")
        self.btn_conn.config(state=tk.NORMAL)
        self._refresh_trial_history()
        if result.status != "COMPLETED":
            messagebox.showerror("实验失败", result.error_message or "实验未完成。")

    def _on_close(self):
        if self._trial_running:
            if not messagebox.askyesno("实验正在运行", "实验仍在运行，确定要关闭程序吗？"):
                return
        self.sdg.disconnect()
        self.camera.disconnect()
        self.destroy()

    def _refresh_trial_history(self):
        for row in self.tree_trials.get_children():
            self.tree_trials.delete(row)
        subj_filter = self.ent_filter_subj.get().strip() or None
        trials = self.db.list_trials(subject_id=subj_filter, limit=50)
        for t in trials:
            self.tree_trials.insert("", tk.END, values=(
                t["trial_id"],
                t["subject_id"],
                t["trial_no"],
                t["video_id"],
                f"{t['stimulation_voltage_v']}V",
                f"{t['stimulation_frequency_hz']}Hz",
                t["stimulation_time"] or "-",
                t["status"],
                t["response_latency_s"] if t["response_latency_s"] is not None else "-",
                t["response_action"] or "-",
                t["response_degree"] if t["response_degree"] is not None else "-"
            ))

    def _on_tree_select(self, event):
        selected = self.tree_trials.selection()
        if not selected:
            return
        item = self.tree_trials.item(selected[0])
        values = item["values"]
        trial_id = values[0]
        self.lbl_selected_trial.config(text=str(trial_id))
        self.ent_resp_latency.delete(0, tk.END)
        self.ent_resp_action.set("")
        self.ent_resp_degree.set("")
        if values[8] != "-":
            self.ent_resp_latency.insert(0, str(values[8]))
        if values[9] != "-":
            action = str(values[9])
            option = next((item for item in ACTION_OPTIONS if item.startswith(f"{action} ·")), "")
            self.ent_resp_action.set(option)
        if values[10] != "-":
            degree = str(values[10]).removesuffix(".0")
            option = next((item for item in DEGREE_OPTIONS if item.startswith(f"{degree} ·")), "")
            self.ent_resp_degree.set(option)

    def _save_annotation(self):
        trial_id_str = self.lbl_selected_trial.cget("text")
        if trial_id_str == "-":
            messagebox.showwarning("提示", "请先在上方表格中选择一个 Trial")
            return
        trial_id = int(trial_id_str)
        try:
            latency = float(self.ent_resp_latency.get().strip()) if self.ent_resp_latency.get().strip() else None
            action_value = self.ent_resp_action.get().strip()
            degree_value = self.ent_resp_degree.get().strip()
            action = action_value.split(" ·", 1)[0] if action_value else None
            degree = float(degree_value.split(" ·", 1)[0]) if degree_value else None
            
            self.db.update_trial_response(
                trial_id=trial_id,
                response_latency_s=latency,
                response_action=action,
                response_degree=degree
            )
            self.log_status(f"Updated annotation for Trial #{trial_id}")
            self._refresh_trial_history()
            messagebox.showinfo("成功", f"Trial #{trial_id} 标注保存成功！")
        except ValueError as e:
            messagebox.showerror("格式错误", f"输入格式错误: {e}")
