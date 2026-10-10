# Exp.-Recorder / Cyborg Lab

Exp.-Recorder 是一套本地运行的实验管理、视频记录与电刺激控制系统。当前 Web
界面以 **Cyborg Lab** 为名称，整合了实验资源管理、刺激方案编排、自动 Trial
执行、行为标注、硬件库存、XIAO ESP32S3 健康检查、固件管理和局域网实时控制。

核心实验流程：

> 选择实验与对象 → 录像基线 → 输出刺激 → 继续录像 → 回放并标注 → 保存 Trial

## 1. 系统组成

```text
浏览器
  │
  ├── Next.js 16 / React 19 Web 控制台（127.0.0.1:3001）
  │      ├── /backend/* 反向代理到 FastAPI
  │      └── Live Control 直接连接同一局域网内的控制板
  │
  └── FastAPI（127.0.0.1:8000）
         ├── SQLite：data/experiment.db
         ├── 视频：data/videos/
         ├── SIGLENT SDG1022X：USB-TMC 或 LAN SCPI
         └── XIAO ESP32S3 Sense：USB 串口控制与 MJPEG 视频
```

主要硬件：

- **SIGLENT SDG1022X**：产生方波、脉冲、正弦波或斜坡刺激信号。
- **XIAO ESP32S3 Sense**：采集摄像头 JPEG 帧，由电脑保存为无音轨 WebM。
- **局域网 XIAO 控制板**：支持设备发现、MJPEG 预览、方向控制和相机参数设置。
- **SQLite**：保存物种、对象、位置、实验、计划、Trial、硬件和软件记录。

## 2. 当前 WebApp 功能

侧边栏按 Resources、Filters 和 Operation 三组组织功能。

### Resources

| 页面 | 已实现功能 |
| --- | --- |
| **Species** | 新建、编辑、删除和搜索物种；保存物种代码、学名、参考图、喂食周期和休息周期。 |
| **Subjects** | 管理实验对象的尺寸、重量、性别、物种和备注；记录 Feed/Mark Tested 时间；根据物种周期显示 Normal、Hungry 或 Fatigued 状态。 |
| **Materials / Tools** | 当前为预留页面，尚未实现物料和工具库存。 |
| **Hardware** | 管理控制板与外设；扫描局域网在线状态；登记 camera、IMU、DAC、motor、sensor 及其接口、电压和状态。 |
| **Software** | 管理程序名称、版本、适用设备和源码地址；打开本地源码或网页仓库；通过 Arduino CLI 编译并烧录本地 XIAO ESP32S3 sketch。 |

Hardware 页面还提供 XIAO ESP32S3 健康检查：

- 自动识别 USB 设备、产品信息和硬件 MAC。
- 检查或烧录诊断固件，并执行 Hello World 验证。
- 依次测试 GPIO、PWM、UART、SPI；I²C 可在没有模块时跳过。
- 保存 Wi-Fi、Bluetooth、接口测试和已登记外设的检查结果。
- 实验设备正在使用的串口会被锁定，不能用于库存板烧录或健康检查。

> 健康检查和固件烧录可能覆盖控制板中已有程序，请先确认选择的是库存板而非正在执行实验的设备。

### Filters

| 页面 | 已实现功能 |
| --- | --- |
| **Positions** | 按物种管理刺激位置；复用物种参考图并在图上标记坐标；支持通用位置、搜索、预览和编辑。 |
| **Experiments** | 创建实验标题和说明，作为 Plans 与 Trials 的上级记录；已有 Trial 的实验不能直接删除。 |
| **Plans** | 为选定实验批量选择对象，配置两处刺激位置、波形、电平、占空比、频率、持续时间、次数、间隔和计划 Trial 数；显示 Pending/In Progress/Completed 进度。 |
| **Trials** | 按实验查看、搜索和编辑 Trial；播放视频和查看位置图；修改刺激参数、状态与行为标注；导出 CSV 或清理实验数据。 |

刺激位置必须是两个不同且已标记的点。系统保存两个位置外键，并将位置代码按电极
顺序组合，例如 `H1` 与 `A1` 保存为 `H1A1`。当高低电平绝对值相等且占空比为
50% 时，位置对按无序组合处理。

### Operation

#### Signal Generation

- 显示 SDG1022X 与 XIAO 相机连接状态，并支持重新连接。
- 选择实验、对象和实验计划，也可直接填写刺激与录像参数。
- 实时预览 USB 相机画面，支持镜像和 90° 旋转显示。
- 异步执行 Trial，持续显示运行状态和日志，不阻塞页面操作。
- 完成后立即回放视频和位置图；填写 latency、action、degree 后确认保存，或丢弃本次 Trial 及视频。
- 计划 Trial 保存后自动更新完成进度。

自动 Trial 顺序为：

1. 检查信号源与相机连接。
2. 开始视频记录并等待 baseline。
3. 写入刺激时间标记并触发 SDG1022X。
4. 等待 post-stim 时段后停止录像。
5. 进入待确认状态，确认标注后才写入正式 Trial 记录。

#### Live Control

- 扫描并选择当前局域网内已登记的控制板。
- 显示 MJPEG 实时画面、接收帧率、十字准线和连接信息。
- 通过界面按钮或键盘快捷键执行前、后、左、右控制。
- 为每个方向配置有效状态、通道引脚、频率、持续时间和快捷键。
- 设置摄像头分辨率、FPS、亮度、对比度、锐度、水平镜像和垂直翻转。
- 以摄像头最大分辨率拍照、预览并下载 JPEG。
- 同一控制板的视频流在浏览器标签页之间使用独占锁，避免重复占用流。

#### Logs

显示当前实验任务的实时日志和 IDLE、RUNNING、COMPLETED、FAILED 状态。

## 3. 推荐使用流程

1. 在 **Species** 添加物种及参考图，并填写喂食、休息周期。
2. 在 **Subjects** 添加实验对象。
3. 在 **Positions** 为对应物种创建并标记至少两个刺激位置。
4. 在 **Experiments** 创建实验。
5. 在 **Plans** 为对象建立刺激计划和目标 Trial 数量。
6. 确认 XIAO 相机和 SDG1022X 已连接，进入 **Signal Generation**。
7. 选择实验计划，检查刺激参数与位置后开始 Trial。
8. Trial 完成后回放录像，填写反应标注并确认保存。
9. 在 **Trials** 复核记录、修改标注、播放视频或导出 CSV。

无硬件调试时可使用 `--mock`。Mock 模式可以验证 Web 和实验流程，但不会提供真实
相机画面、硬件输出或局域网控制板。

## 4. 环境要求

- Python 3.10 或更高版本
- Node.js 20.19 或更高版本
- npm
- 可选：`arduino-cli` 与 `esp32:esp32` core，用于 XIAO 健康检查和固件烧录

手动安装项目依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm --prefix frontend install
```

如需使用健康检查或 Software 页烧录功能：

```bash
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

烧录目标为 `esp32:esp32:XIAO_ESP32S3`。Software 记录必须指向包含 `.ino`
文件的本地目录或文件；HTTP(S) 地址只能用于打开源码网页，不能直接烧录。

## 5. 启动 WebApp

### macOS / Linux

脚本会创建 `.venv`、按需安装 Python 与前端依赖、启动前后端并打开浏览器：

```bash
# 真实硬件
./start.sh

# Mock 模式
./start.sh --mock

# 不自动打开浏览器
./start.sh --no-open
```

### Windows

双击 `start.bat`，或在 CMD / PowerShell 中运行：

```bat
rem 真实硬件
.\start.bat

rem Mock 模式
.\start.bat --mock

rem 不自动打开浏览器
.\start.bat --no-open
```

Windows 脚本使用独立的 `.venv-windows`。它会检查 Python、Node.js 和项目依赖；
缺少 Python 或 Node.js 时会尝试通过 Windows Package Manager（`winget`）安装。

启动后访问：

- Web 控制台：<http://127.0.0.1:3001>
- FastAPI 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/api/health>

按 `Ctrl+C` 会同时停止前后端。如需把 Next.js 代理到其他 API 地址，可在启动前设置
`EXP_RECORDER_API_URL`。

### 手动启动

分别打开两个终端：

```bash
# 终端 1：后端
.venv/bin/python main.py

# 终端 2：前端
npm --prefix frontend run dev
```

Mock 后端：

```bash
.venv/bin/python main.py --mock
```

Windows 手动启动时将 `.venv/bin/python` 换成
`.venv-windows\Scripts\python.exe`。

### CLI 模式

```bash
python3 main.py --cli
python3 main.py --cli --mock
```

## 6. XIAO ESP32S3 固件

仓库提供两套 Arduino sketch：

- `data/software/xiao_esp32s3_recorder/`：实验相机 USB MJPEG 固件。
- `data/software/xiao_esp32s3_healthcheck/`：库存板诊断与接口测试固件。

使用 Arduino IDE 手动烧录实验相机固件时：

1. 安装 **ESP32 by Espressif Systems** 开发板支持包。
2. 选择 `XIAO_ESP32S3`。
3. 开启 `PSRAM: OPI PSRAM` 和 `USB CDC On Boot: Enabled`。
4. 打开 `xiao_esp32s3_recorder.ino` 并上传。

实验相机不需要 microSD，视频帧通过 USB 传回电脑。

## 7. 数据与文件

### 主要数据表

| 数据表 | 内容 |
| --- | --- |
| `species` | 物种、参考图、喂食周期和休息周期。 |
| `subjects` | 实验对象的生物信息、最近喂食与实验时间。 |
| `boards` / `peripherals` | 控制板、健康检查结果和外设库存。 |
| `software` | 程序版本、源码地址和支持设备。 |
| `experiment` | 实验标题和说明。 |
| `stimulation_positions` | 物种刺激位置、参考图关联和归一化标记坐标。 |
| `experiment_plans` | 对象、位置组合、刺激参数和目标 Trial 数。 |
| `trials` | Trial 元数据、视频、刺激快照、运行状态和人工标注。 |
| `tracking_points` / `responses` | 逐帧跟踪点和分析摘要的 API 数据结构。 |

数据库位置：

```text
data/experiment.db
```

视频位置与命名格式：

```text
data/videos/{SubjectID}_T{TrialNo:03d}_{Timestamp}.webm
```

示例：

```text
data/videos/B07_T003_20260828_143216.webm
```

CSV 导出包含对象信息、实验与 Trial 元数据、刺激参数、录像时长及行为标注。

数据删除行为：

- 在 Trial 表中删除单条记录时，如果没有其他 Trial 引用同一文件，后端会同时删除该视频。
- `Clear Data` 会清空 experiments、plans、trials 和 subjects，但保留 `data/videos/` 中的视频文件。
- 清理操作不可撤销，执行前请备份 `data/experiment.db`。

## 8. 行为标注标准

### Action Code

| 编号 | 动作 | 英文 | 定义 |
| ---: | --- | --- | --- |
| 0 | 静止 | Stationary | 无明显位移。 |
| 1 | 前进 | Forward | 主要向前移动。 |
| 2 | 后退 | Backward | 主要向后移动。 |
| 3 | 左转 | Turn Left | 主要向左改变方向。 |
| 4 | 右转 | Turn Right | 主要向右改变方向。 |
| 5 | 前左斜行 | Forward-Left | 同时包含前进与左向分量。 |
| 6 | 前右斜行 | Forward-Right | 同时包含前进与右向分量。 |
| 7 | 后左斜退 | Backward-Left | 同时包含后退与左向分量。 |
| 8 | 后右斜退 | Backward-Right | 同时包含后退与右向分量。 |
| 9 | 抬头 | Head Raising | 明显抬头但没有明显位移。 |
| 10 | 抽动 / 甩动 | Shaking | 可见的身体抽动。 |
| 11 | 不适用 | Not Applicable | 反应无关或无法分类。 |

### Degree

| 评分 | 等级 | 判定标准 | 典型表现 |
| ---: | --- | --- | --- |
| 0 | No response | 与静止对照相比没有可见行为变化。 | 无明显动作。 |
| 1 | Mild response | 短暂轻微反应，没有明确的定向位移。 | 抬头、轻微紧张、触角活动。 |
| 2 | Active response | 出现清晰行为，速度接近活动对照。 | 正常行走、转向、前进或后退。 |
| 3 | Excessive response | 明显异常或非目标行为，可能表示刺激过强。 | 抽搐、翻身、剧烈奔跑或挣扎。 |
| 4 | Not applicable | 无法评估或不适用。 | 反应不明确。 |

## 9. 项目结构

```text
Exp.-Recorder/
├── frontend/
│   ├── src/app/                    # 页面入口、状态管理、类型与常量
│   ├── src/components/circo/       # 页面、表格、对话框与实验控制组件
│   ├── src/config/app-config.ts    # WebApp 名称与展示配置
│   └── next.config.ts              # /backend/* 到 FastAPI 的代理
├── data/
│   ├── experiment.db               # SQLite 数据库
│   ├── videos/                     # Trial 视频
│   └── software/                   # XIAO recorder 与 health-check sketch
├── src/
│   ├── api/server.py               # FastAPI 与后台任务
│   ├── core/                       # Trial 调度及视频写入
│   ├── database/                   # Schema、迁移与 CRUD
│   ├── devices/                    # SDG、XIAO、LAN 发现、健康检查与烧录
│   └── ui/                         # CLI / GUI 代码
├── tests/                          # 后端、设备、API 与流程测试
├── main.py                         # 后端和 CLI 入口
├── start.sh                        # macOS / Linux 启动脚本
├── start.bat                       # Windows 启动入口
├── start.ps1                       # Windows 环境检查与进程管理
└── requirements.txt
```

## 10. 测试与构建

运行 Python 测试：

```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

检查前端：

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

使用 Mock 模式进行人工流程验证：

```bash
./start.sh --mock
```
