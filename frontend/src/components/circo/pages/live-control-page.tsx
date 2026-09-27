"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  Battery50Icon,
  CameraIcon,
  Cog6ToothIcon,
  VideoCameraIcon,
  WifiIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Input, Select } from "@/components/circo/ui";

type ActionId = "forward" | "backward" | "left" | "right";
type ActionConfig = {
  valid: boolean;
  pin: string;
  frequencyHz: string;
  durationMs: string;
  key: string;
};

const actionMeta: Record<ActionId, { label: string; icon: typeof ArrowUpIcon; position: string }> = {
  forward: { label: "前进", icon: ArrowUpIcon, position: "col-start-2 row-start-1" },
  backward: { label: "后退", icon: ArrowDownIcon, position: "col-start-2 row-start-3" },
  left: { label: "左转", icon: ArrowLeftIcon, position: "col-start-1 row-start-2" },
  right: { label: "右转", icon: ArrowRightIcon, position: "col-start-3 row-start-2" },
};

const defaultActions: Record<ActionId, ActionConfig> = {
  forward: { valid: true, pin: "D0", frequencyHz: "50", durationMs: "500", key: "W" },
  backward: { valid: false, pin: "D1", frequencyHz: "50", durationMs: "500", key: "S" },
  left: { valid: true, pin: "D2", frequencyHz: "50", durationMs: "500", key: "A" },
  right: { valid: true, pin: "D3", frequencyHz: "50", durationMs: "500", key: "D" },
};

const pins = Array.from({ length: 7 }, (_, index) => `D${index}`);
const shortcutKeys = ["W", "A", "S", "D", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

function hudButtonClass(active = false) {
  return `grid size-12 place-items-center rounded-2xl border text-white shadow-lg backdrop-blur-md transition ${active ? "border-cyan-300 bg-cyan-400/35 ring-2 ring-cyan-300/40" : "border-white/20 bg-black/35 hover:bg-black/55"}`;
}

function Crosshair() {
  return <div className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
    <span className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_3px_black]" />
    <span className="absolute bottom-0 left-1/2 h-5 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_3px_black]" />
    <span className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-white/90 shadow-[0_0_3px_black]" />
    <span className="absolute right-0 top-1/2 h-px w-5 -translate-y-1/2 bg-white/90 shadow-[0_0_3px_black]" />
    <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 shadow-[0_0_3px_black]" />
  </div>;
}

function RangeSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-sm text-white/80">
    <span className="flex items-center justify-between"><span>{label}</span><output className="font-mono text-xs text-white">{value}</output></span>
    <input className="accent-cyan-400" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

export function LiveControlPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [snapshotNotice, setSnapshotNotice] = useState(false);
  const [camera, setCamera] = useState({ resolution: "1920×1080", fps: "30", brightness: 0, contrast: 0, sharpness: 0, hmirror: false, vflip: false });
  const [actions, setActions] = useState<Record<ActionId, ActionConfig>>(defaultActions);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const editable = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
    const findAction = (key: string) => (Object.keys(actions) as ActionId[]).find((id) => actions[id].valid && actions[id].key.toLowerCase() === key.toLowerCase());
    const onKeyDown = (event: KeyboardEvent) => {
      if (editable(event.target) || event.repeat) return;
      const id = findAction(event.key === " " ? "Space" : event.key);
      if (id) {
        event.preventDefault();
        setActiveAction(id);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      const id = findAction(event.key === " " ? "Space" : event.key);
      if (id) setActiveAction((current) => current === id ? null : current);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [actions]);

  const dateText = useMemo(() => now?.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }) ?? "----/--/--", [now]);
  const timeText = useMemo(() => now?.toLocaleTimeString("zh-CN", { hour12: false }) ?? "--:--:--", [now]);

  const updateAction = <K extends keyof ActionConfig>(id: ActionId, key: K, value: ActionConfig[K]) => {
    setActions((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
    if (key === "valid" && value === false) setActiveAction((current) => current === id ? null : current);
  };

  const takeSnapshot = () => {
    setSnapshotNotice(true);
    window.setTimeout(() => setSnapshotNotice(false), 1400);
  };

  return <section className="relative h-dvh min-h-[640px] overflow-hidden bg-zinc-950 text-white" aria-label="实时控制工作区">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(56,189,248,0.14),transparent_26%),linear-gradient(145deg,#172126_0%,#080b0d_55%,#111827_100%)]" aria-label="Wi-Fi 摄像头画面占位">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute left-1/2 top-[42%] grid -translate-x-1/2 -translate-y-1/2 place-items-center gap-3 text-center text-white/25">
        <VideoCameraIcon className="size-14" />
        <div><p className="text-sm font-medium tracking-[.2em]">WIFI CAMERA FEED</p><p className="mt-1 text-xs">等待接入实时视频流</p></div>
      </div>
    </div>

    <div className="absolute left-5 top-5 z-10 px-4 py-3 sm:left-7 sm:top-7">
      <time className="block font-mono text-xl font-semibold tracking-wide">{timeText}</time>
      <span className="mt-1 block text-xs text-white/65">{dateText}</span>
    </div>

    <div className="absolute right-5 top-5 z-10 flex items-center gap-3 px-4 py-3 sm:right-7 sm:top-7">
      <Battery50Icon className="size-6" /><span className="font-mono text-sm">78%</span>
    </div>

    <Crosshair />

    {activeAction && <div className="absolute left-1/2 top-[60%] z-10 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-cyan-400/15 px-4 py-2 text-xs font-medium text-cyan-100 backdrop-blur-md">动作预览：{actionMeta[activeAction].label}</div>}
    {snapshotNotice && <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full border border-white/25 bg-black/60 px-4 py-2 text-xs backdrop-blur-md">已触发拍照（前端演示）</div>}

    <div className="absolute bottom-6 left-5 z-20 flex gap-3 sm:bottom-8 sm:left-7">
      <button type="button" className={hudButtonClass(settingsOpen)} aria-label="设置" title="设置" onClick={() => setSettingsOpen((open) => !open)}><Cog6ToothIcon className="size-6" /></button>
      <button type="button" className={hudButtonClass()} aria-label="拍照" title="拍照" onClick={takeSnapshot}><CameraIcon className="size-6" /></button>
    </div>

    <div className="absolute bottom-5 right-5 z-20 grid grid-cols-3 grid-rows-3 gap-2 sm:bottom-7 sm:right-7">
      {(Object.keys(actionMeta) as ActionId[]).filter((id) => actions[id].valid).map((id) => {
        const meta = actionMeta[id];
        const Icon = meta.icon;
        return <button key={id} type="button" className={`${hudButtonClass(activeAction === id)} ${meta.position}`} aria-label={`${meta.label}，快捷键 ${actions[id].key}`} title={`${meta.label} · ${actions[id].key}`} onPointerDown={() => setActiveAction(id)} onPointerUp={() => setActiveAction(null)} onPointerCancel={() => setActiveAction(null)} onPointerLeave={() => setActiveAction(null)}>
          <Icon className="size-6" /><span className="sr-only">{meta.label}</span>
        </button>;
      })}
    </div>

    <aside className={`absolute inset-y-0 left-0 z-40 w-[min(92vw,430px)] overflow-y-auto border-r border-white/15 bg-zinc-950/78 p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:p-7 ${settingsOpen ? "translate-x-0" : "-translate-x-full"}`} aria-hidden={!settingsOpen}>
      <header className="mb-7 flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300">Live Control</p><h2 className="mt-1 text-xl font-semibold">设置</h2></div><button type="button" className="grid size-10 place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white" aria-label="关闭设置" onClick={() => setSettingsOpen(false)}><XMarkIcon className="size-6" /></button></header>

      <section>
        <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase tracking-[.12em] text-white/90">Camera Settings</h3>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm text-white/80"><span>Resolution</span><Select value={camera.resolution} onChange={(event) => setCamera((value) => ({ ...value, resolution: event.target.value }))}><option>640×480</option><option>1280×720</option><option>1920×1080</option></Select></label>
          <label className="grid gap-1.5 text-sm text-white/80"><span>FPS</span><Select value={camera.fps} onChange={(event) => setCamera((value) => ({ ...value, fps: event.target.value }))}><option>15</option><option>24</option><option>30</option><option>60</option></Select></label>
          <RangeSetting label="Brightness" min={-2} max={2} value={camera.brightness} onChange={(brightness) => setCamera((value) => ({ ...value, brightness }))} />
          <RangeSetting label="Contrast" min={-2} max={2} value={camera.contrast} onChange={(contrast) => setCamera((value) => ({ ...value, contrast }))} />
          <RangeSetting label="Sharpness" min={-2} max={2} value={camera.sharpness} onChange={(sharpness) => setCamera((value) => ({ ...value, sharpness }))} />
          <div className="grid grid-cols-2 gap-3">{([['hmirror', 'H-Mirror'], ['vflip', 'V-Flip']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80"><span>{label}</span><input className="size-4 accent-cyan-400" type="checkbox" checked={camera[key]} onChange={(event) => setCamera((value) => ({ ...value, [key]: event.target.checked }))} /></label>)}</div>
        </div>
      </section>

      <section className="mt-9">
        <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase tracking-[.12em] text-white/90">Action Settings</h3>
        <p className="mt-3 text-xs leading-5 text-white/50">Invalid 动作不会显示方向按钮，也不会响应键盘快捷键。</p>
        <div className="mt-4 grid gap-4">
          {(Object.keys(actionMeta) as ActionId[]).map((id) => {
            const config = actions[id];
            return <article key={id} className={`rounded-2xl border p-4 transition ${config.valid ? "border-white/15 bg-white/7" : "border-white/8 bg-black/20 opacity-60"}`}>
              <div className="flex items-center justify-between"><strong className="text-sm">{actionMeta[id].label}</strong><label className="flex items-center gap-2 text-xs text-white/65"><span>{config.valid ? "Valid" : "Invalid"}</span><input className="size-4 accent-cyan-400" type="checkbox" checked={config.valid} onChange={(event) => updateAction(id, "valid", event.target.checked)} /></label></div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-xs text-white/65"><span>Pin</span><Select value={config.pin} onChange={(event) => updateAction(id, "pin", event.target.value)}>{pins.map((pin) => <option key={pin}>{pin}</option>)}</Select></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-xs text-white/65"><span>频率 (Hz)</span><Input type="number" min="0" step="any" value={config.frequencyHz} onChange={(event) => updateAction(id, "frequencyHz", event.target.value)} /></label>
                  <label className="grid gap-1.5 text-xs text-white/65"><span>刺激时长 (ms)</span><Input type="number" min="0" step="1" value={config.durationMs} onChange={(event) => updateAction(id, "durationMs", event.target.value)} /></label>
                </div>
                <label className="grid gap-1.5 text-xs text-white/65"><span>Keyboard Shortcut</span><Select value={config.key} onChange={(event) => updateAction(id, "key", event.target.value)}>{shortcutKeys.map((key) => <option key={key} value={key}>{key}</option>)}</Select></label>
              </div>
            </article>;
          })}
        </div>
      </section>
    </aside>
  </section>;
}
