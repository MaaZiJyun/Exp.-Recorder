# 实验自动化控制系统 (Exp.-Recorder)

开发并运行于 **MacBook** 的实验自动化控制系统，统一控制：

- **SIGLENT SDG1022X**：产生可配置电刺激信号。
- **XIAO ESP32S3 Sense**：作为实验摄像设备，通过 USB 接收控制指令并将 MJPEG 视频帧传回 Mac。
- **SQLite**：保存每次实验的参数、时间戳、视频信息及实验结果。

核心目标：

> **一次操作完成：录像 → 电刺激 → 数据记录 → 视频保存 → 实验结果标注**

---

## 1. 系统架构与硬件清单

```
                 MacBook (macOS)
                        │
        [Next.js Web Control Panel :3000]
                        │
             [Python FastAPI :8000]
            ┌───────────┴───────────┐
            ↓ (USB / LAN SCPI)      ↓ (USB Control + MJPEG)
      SIGLENT SDG1022X         XIAO ESP32S3 Sense
            │                       (Camera only)
            ↓                           │
     Electrical Stimulus                ↓
     (电刺激脉冲/方波输出)      Mac: data/videos/*.webm
                        ↓               ↓
                 [SQLite Database: experiment.db]
```

### 硬件支持
1. **SIGLENT SDG1022X**：函数/任意波形发生器（支持 USB-TMC / VXI-11 / PyVISA 控制）。
2. **Seeed Studio XIAO ESP32S3 Sense**：使用 OV2640/OV5640 摄像头，不需要 microSD；通过 USB 将 JPEG 帧发送给 Mac，由 Python 编码为无音轨 WebM。
3. **SQLite**：本地自动保存实验 Trial 参数、时间戳、视频关联名与行为人工标注结果。

---

## 2. 目录结构

```
Exp.-Recorder/
├── frontend/                         # Next.js 16 + React 19 Web 控制台
│   ├── src/app/page.tsx              # 实验控制、历史记录与标注页面
│   ├── src/app/globals.css           # 响应式界面样式
│   └── next.config.ts                # 本地 Python API 反向代理
├── firmware/
│   └── xiao_esp32s3_recorder/
│       └── xiao_esp32s3_recorder.ino   # XIAO ESP32S3 Sense USB MJPEG 固件
├── src/
│   ├── config.py                      # 全局默认配置（串口号、默认刺激参数、基线时长等）
│   ├── api/
│   │   └── server.py                  # FastAPI、本地硬件控制与异步 Trial API
│   ├── database/
│   │   ├── schema.sql                 # SQLite DDL 表结构定义
│   │   └── db_manager.py              # SQLite 数据库管理与 CRUD 操作
│   ├── devices/
│   │   ├── sdg1022x.py                # SIGLENT SDG1022X SCPI 驱动（支持实机与 Mock 仿真）
│   │   └── xiao_camera.py             # XIAO ESP32S3 串口通信控制驱动
│   ├── core/
│   │   ├── models.py                  # Subject、StimulusConfig、TrialConfig 数据模型
│   │   └── trial_runner.py            # 实验流程调度状态机
│   └── ui/
│       └── cli.py                     # 命令行交互界面 (CLI)
├── tests/
│   ├── test_api.py                    # Web API 控制器测试
│   └── test_mock_trial.py             # 单元与自动化集成测试
├── main.py                            # Python API 入口（支持 --cli 和 --mock）
├── requirements.txt                   # Python 依赖清单
└── README.md
```

---

## 3. 快速上手

### 3.1 安装 Python 依赖
```bash
pip install -r requirements.txt
```

安装 Web 前端依赖（建议 Node.js 20.19 或更高版本，项目提供 `.nvmrc`）：

```bash
cd frontend
npm install
cd ..
```

### 3.2 烧录 XIAO ESP32S3 Sense 固件
1. 打开 Arduino IDE，安装 **ESP32 by Espressif Systems** 开发板支持包。
2. 开发板选择：`XIAO_ESP32S3`，开启 `PSRAM: OPI PSRAM` 和 `USB CDC On Boot: Enabled`。
3. 打开 `firmware/xiao_esp32s3_recorder/xiao_esp32s3_recorder.ino`。
4. 连接 XIAO 并点击上传；该固件不需要 microSD 卡。

---

## 4. 运行程序

### 方式 A：启动 Next.js Web 控制台（推荐）

在项目根目录执行一个命令即可。脚本会检查或安装依赖、同时启动 Python API 和 Next.js，并自动打开浏览器：

```bash
# 真实硬件
./start.sh

# 无硬件 Mock 模式
./start.sh --mock
```

按 `Ctrl+C` 会同时停止前后端。若不希望自动打开浏览器：

```bash
./start.sh --no-open
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。Next.js 会把 `/backend/*` 请求代理到 `http://127.0.0.1:8000`；如需使用其他 API 地址，可设置 `EXP_RECORDER_API_URL`。

**Web 控制台功能：**

- **设备状态监控**：实时显示 SDG1022X 与 XIAO ESP32S3 连接状态，支持一键重连。
- **实验对象与参数配置**：配置 Subject ID、体长、体重、波形、频率、高/低电平、占空比、脉冲数及录像时长。
- **一键自动化实验**：点击 `▶ 开始实验 (START TRIAL)` 自动完成录像启停、电刺激触发与数据库写入。
- **实时进度与日志**：浏览器轮询本地任务状态，实验执行不会阻塞页面。
- **历史记录与人工标注**：点击 Trial，可即时填入或更新 `Response Latency`、`Action`、`Degree`。
- **CSV 导出与数据清理**：可按当前 Subject 筛选导出完整 CSV；清空数据库记录时会保留 Mac 上的视频文件。

### 方式 B：命令行交互模式 (CLI)
```bash
python3 main.py --cli
# 或 Mock 模式
python3 main.py --cli --mock
```

---

## 5. 数据结构与视频命名规则

### 5.1 视频命名格式

视频直接保存在 Mac 的 `data/videos/`：

```
data/videos/{SubjectID}_T{TrialNo:03d}_{Timestamp}.webm
```
例如：
```
B07_T003_20260828_143216.webm
```

### 5.2 刺激位置（表 `stimulation_positions`）

在 Web 控制台的 **Manage > Positions** 中预先标记刺激位置。每条记录包含
`position_id`、唯一 `code`（例如 `A1`）、`description`、共享 `image_id` 和
图片内的 `mark` 坐标。图片按内容去重，同一图片只在数据库保存一次；管理页面
左侧会在共享底图上同时显示所有关联 Position 的 marks。开始实验时
必须从这些记录中选择两个不同的位置；Trial 同时保存两个位置外键，并按选择
顺序将 code 直接拼接为快照（例如 `H1` + `A1` 保存为 `H1A1`）。

### 5.3 SQLite 字段规范（表 `trials`）
- **Subject**: `subject_id`, `body_length_cm`, `body_weight_g`
- **Trial Metadata**: `trial_no`, `video_id`, `experiment_timestamp`, `video_file`, `status`
- **Stimulus Parameters**: `stimulation_time`, `stimulation_position_id`, `stimulation_position_2_id`, `stimulation_position`, `stimulation_waveform`, `stimulation_high_level_v`, `stimulation_low_level_v`, `stimulation_duty_cycle_pct`, `stimulation_voltage_v`, `stimulation_frequency_hz`, `stimulation_duration_s`, `stimulation_count`, `stimulation_interval_s`
- **Recording Durations**: `baseline_duration_s`, `post_stim_duration_s`
- **Manual Response Annotations**: `response_latency_s`, `response_action`, `response_degree`

---

## 6. 应对刺激反应标注标准

### 6.1 应对刺激反应动作编号

| 编号 | 动作 | 英文 | 定义 |
| ---: | --- | --- | --- |
| **0** | 静止 | Stationary | 无明显位移 |
| **1** | 前进 | Forward | 主要向前方移动 |
| **2** | 后退 | Backward | 主要向后方移动 |
| **3** | 左转 | Turn Left | 主要向左改变运动方向 |
| **4** | 右转 | Turn Right | 主要向右改变运动方向 |
| **5** | 前左斜行 | Forward-Left | 同时具有前进和左向运动分量 |
| **6** | 前右斜行 | Forward-Right | 同时具有前进和右向运动分量 |
| **7** | 后左斜退 | Backward-Left | 同时具有后退和左向运动分量 |
| **8** | 后右斜退 | Backward-Right | 同时具有后退和右向运动分量 |
| **9** | 抬头 | Head Raising | 头部明显抬起，但未形成明显位移 |

### 6.2 反应动作程度分级

| 评分 | 反应等级 | 判定标准 | 典型表现 |
| ---: | --- | --- | --- |
| **0** | 无反应 | 与静止对照组相比无明显行为变化 | 无明显动作 |
| **1** | 轻微反应 | 出现轻微、短暂的身体反应，但未产生明显的定向运动 | 抬头、身体轻微绷紧、触角轻微活动 |
| **2** | 积极反应 | 出现明显的、可重复的目标行为；运动速度与动态对照组接近 | 正常行走、转向、前进/后退等 |
| **3** | 过激反应 | 出现明显异常或非目标行为，可能表明刺激强度过高或产生强烈应激 | 抽搐、翻身、剧烈乱跑、挣扎、明显应激反应 |

## 7. 自动化测试
运行单元与流程仿真测试：
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

检查并构建前端：

```bash
cd frontend
npm run lint
npm run build
```
