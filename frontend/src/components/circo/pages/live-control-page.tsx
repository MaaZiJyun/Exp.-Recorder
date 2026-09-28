"use client";
/* eslint-disable @next/next/no-img-element -- A native img element is required for the MJPEG stream. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  Battery50Icon,
  CameraIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Board } from "@/app/types";
import { api } from "@/app/lib";
import { Input, Select } from "@/components/circo/ui";

type ActionId = "forward" | "back" | "left" | "right";
type ActionConfig = {
  valid: boolean;
  frequencyHz: string;
  durationMs: string;
  key: string;
};
type Endpoint = {
  ipAddress: string;
  controlPort: number;
  videoPort: number;
  mac: string;
  model: string | null;
};
type ControllerConfig = {
  model: string;
  networkMode: "station" | "access-point";
  controlPort: number;
  videoPort: number;
  durationMs: number;
  frequency: number;
  minDurationMs: number;
  maxDurationMs: number;
  minFrequency: number;
  maxFrequency: number;
  defaultPins: number[];
};
type CameraSettings = {
  ok: true;
  resolution: string;
  fps: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  hmirror: boolean;
  vflip: boolean;
  supportedResolutions: string[];
  limits: {
    fps: [number, number];
    brightness: [number, number];
    contrast: [number, number];
    sharpness: [number, number];
  };
};
type CameraSettingsPatch = Partial<
  Pick<
    CameraSettings,
    | "resolution"
    | "fps"
    | "brightness"
    | "contrast"
    | "sharpness"
    | "hmirror"
    | "vflip"
  >
>;
type DiscoveryResponse = {
  discovered: Array<{
    mac: string;
    ip_address: string;
    model: string | null;
    control_port: number | null;
    video_port: number | null;
  }>;
};

const actionMeta: Record<
  ActionId,
  { label: string; icon: typeof ArrowUpIcon; position: string; pair: string }
> = {
  forward: {
    label: "前进",
    icon: ArrowUpIcon,
    position: "col-start-2 row-start-1",
    pair: "Chnl1 ↔ Chnl4",
  },
  back: {
    label: "后退",
    icon: ArrowDownIcon,
    position: "col-start-2 row-start-3",
    pair: "Chnl1 ↔ Chnl4",
  },
  left: {
    label: "左转",
    icon: ArrowLeftIcon,
    position: "col-start-1 row-start-2",
    pair: "Chnl1 ↔ Chnl3",
  },
  right: {
    label: "右转",
    icon: ArrowRightIcon,
    position: "col-start-3 row-start-2",
    pair: "Chnl1 ↔ Chnl2",
  },
};
const defaultActions: Record<ActionId, ActionConfig> = {
  forward: { valid: true, frequencyHz: "50", durationMs: "500", key: "W" },
  back: { valid: false, frequencyHz: "50", durationMs: "500", key: "S" },
  left: { valid: true, frequencyHz: "50", durationMs: "500", key: "A" },
  right: { valid: true, frequencyHz: "50", durationMs: "500", key: "D" },
};
const channelLabels = [
  "Chnl1 · 公共端",
  "Chnl2 · 右",
  "Chnl3 · 左",
  "Chnl4 · 前/后",
];
const pinOptions = Array.from({ length: 11 }, (_, index) => index);
const shortcutKeys = [
  "W",
  "A",
  "S",
  "D",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
];

function normalizedMac(value: string) {
  return value.replace(/[^0-9a-f]/gi, "").toUpperCase();
}

async function imageBlobResolution(blob: Blob): Promise<string | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const resolution = `${bitmap.width}x${bitmap.height}`;
    bitmap.close();
    return resolution;
  } catch {
    return null;
  }
}

function hudButtonClass(active = false) {
  return `grid size-12 place-items-center rounded-xl border shadow-lg backdrop-blur-md transition ${active ? "border-white bg-white text-zinc-950 ring-2 ring-white/30" : "border-white/20 bg-zinc-950/55 text-white hover:bg-zinc-900/80"}`;
}
function Crosshair() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      <span className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_3px_black]" />
      <span className="absolute bottom-0 left-1/2 h-5 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_3px_black]" />
      <span className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-white/90 shadow-[0_0_3px_black]" />
      <span className="absolute right-0 top-1/2 h-px w-5 -translate-y-1/2 bg-white/90 shadow-[0_0_3px_black]" />
      <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 shadow-[0_0_3px_black]" />
    </div>
  );
}

function CameraRange({
  label,
  value,
  limits,
  disabled,
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  limits: [number, number];
  disabled: boolean;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-zinc-200">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <output className="font-mono text-xs text-zinc-50">{value}</output>
      </span>
      <input
        className="accent-zinc-100 disabled:opacity-50"
        type="range"
        min={limits[0]}
        max={limits[1]}
        value={value}
        disabled={disabled}
        onChange={(event) => onPreview(Number(event.target.value))}
        onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
        onKeyUp={(event) => onCommit(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export function LiveControlPage({ board }: { board: Board | null }) {
  const [now, setNow] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [actions, setActions] =
    useState<Record<ActionId, ActionConfig>>(defaultActions);
  const [channels, setChannels] = useState([7, 8, 9, 10]);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [controllerConfig, setControllerConfig] =
    useState<ControllerConfig | null>(null);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(
    null,
  );
  const [cameraSaving, setCameraSaving] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [streamVersion, setStreamVersion] = useState(() => String(Date.now()));
  const [photoCapturing, setPhotoCapturing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ url: string; resolution: string | null } | null>(null);
  const [connectionState, setConnectionState] = useState<
    "idle" | "discovering" | "connected" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [streamFailed, setStreamFailed] = useState(false);
  const connectionAttempt = useRef(0);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const discover = useCallback(async () => {
    const attempt = ++connectionAttempt.current;
    setConnectionState("discovering");
    setMessage(
      board ? `正在寻找 ${board.model} · ${board.mac}…` : "正在发现局域网主板…",
    );
    setEndpoint(null);
    setControllerConfig(null);
    setCameraSettings(null);
    setCameraMessage(null);
    setCameraError(false);
    setStreamFailed(false);
    setStreamVersion(String(Date.now()));
    try {
      const response = await api<DiscoveryResponse>("/boards/discover", {
        method: "POST",
      });
      const record = board
        ? response.discovered.find(
            (item) => normalizedMac(item.mac) === normalizedMac(board.mac),
          )
        : response.discovered[0];
      if (!record)
        throw new Error(
          board ? "未在当前局域网发现所选主板。" : "未发现可控制的在线主板。",
        );
      const provisional: Endpoint = {
        ipAddress: record.ip_address,
        controlPort: record.control_port ?? 80,
        videoPort: record.video_port ?? 81,
        mac: normalizedMac(record.mac),
        model: record.model ?? board?.model ?? null,
      };
      const configResponse = await fetch(
        `http://${provisional.ipAddress}:${provisional.controlPort}/config`,
        { cache: "no-store" },
      );
      if (!configResponse.ok)
        throw new Error(`读取板子配置失败 (${configResponse.status})`);
      const config = (await configResponse.json()) as ControllerConfig;
      if (attempt !== connectionAttempt.current) return;
      const resolved = {
        ...provisional,
        controlPort: config.controlPort,
        videoPort: config.videoPort,
        model: config.model || provisional.model,
      };
      setEndpoint(resolved);
      setControllerConfig(config);
      if (config.defaultPins.length === 4) setChannels(config.defaultPins);
      setActions(
        (current) =>
          Object.fromEntries(
            (Object.keys(current) as ActionId[]).map((id) => [
              id,
              {
                ...current[id],
                frequencyHz: String(config.frequency),
                durationMs: String(config.durationMs),
              },
            ]),
          ) as Record<ActionId, ActionConfig>,
      );
      setConnectionState("connected");
      setMessage(`已连接 ${resolved.model ?? "XIAO"} · ${resolved.ipAddress}`);
      try {
        const cameraResponse = await fetch(
          `http://${resolved.ipAddress}:${resolved.controlPort}/camera/settings`,
          { cache: "no-store" },
        );
        if (!cameraResponse.ok)
          throw new Error(`读取摄像头设置失败 (${cameraResponse.status})`);
        const settings = (await cameraResponse.json()) as CameraSettings;
        if (attempt === connectionAttempt.current) {
          setCameraSettings(settings);
          setCameraMessage("摄像头设置已同步。");
          setCameraError(false);
        }
      } catch (cameraError) {
        if (attempt === connectionAttempt.current) {
          setCameraMessage(
            cameraError instanceof Error
              ? cameraError.message
              : "读取摄像头设置失败",
          );
          setCameraError(true);
        }
      }
    } catch (error) {
      if (attempt !== connectionAttempt.current) return;
      setConnectionState("error");
      setMessage(error instanceof Error ? error.message : "主板连接失败");
    }
  }, [board]);
  useEffect(() => {
    const timer = window.setTimeout(() => void discover(), 0);
    return () => window.clearTimeout(timer);
  }, [discover]);

  const sendStop = useCallback(
    (keepalive = false) => {
      setActiveAction(null);
      if (endpoint)
        void fetch(
          `http://${endpoint.ipAddress}:${endpoint.controlPort}/command?name=stop`,
          { method: "POST", keepalive },
        ).catch(() => undefined);
    },
    [endpoint],
  );

  const startAction = useCallback(
    async (id: ActionId) => {
      const config = actions[id];
      if (!endpoint || !config.valid) return;
      if (new Set(channels).size !== 4) {
        setMessage("四个控制通道不能重复，请先在设置中修正。");
        return;
      }
      const query = new URLSearchParams({
        name: id,
        chnl1: String(channels[0]),
        chnl2: String(channels[1]),
        chnl3: String(channels[2]),
        chnl4: String(channels[3]),
        durationMs: config.durationMs,
        frequency: config.frequencyHz,
      });
      setActiveAction(id);
      try {
        const response = await fetch(
          `http://${endpoint.ipAddress}:${endpoint.controlPort}/command?${query}`,
          { method: "POST" },
        );
        if (!response.ok)
          throw new Error(
            (await response.text()) || `动作请求失败 (${response.status})`,
          );
      } catch (error) {
        setActiveAction(null);
        setMessage(error instanceof Error ? error.message : "动作发送失败");
      }
    },
    [actions, channels, endpoint],
  );

  const saveCameraSettings = useCallback(
    async (patch: CameraSettingsPatch) => {
      if (!endpoint) return;
      const query = new URLSearchParams();
      Object.entries(patch).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, String(value));
      });
      setCameraSaving(true);
      setCameraMessage("正在保存摄像头设置…");
      setCameraError(false);
      try {
        const response = await fetch(
          `http://${endpoint.ipAddress}:${endpoint.controlPort}/camera/settings?${query}`,
          { method: "POST" },
        );
        if (!response.ok) {
          const text = await response.text();
          try {
            const body = JSON.parse(text) as { error?: string };
            throw new Error(
              body.error || text || `摄像头设置失败 (${response.status})`,
            );
          } catch (error) {
            if (error instanceof SyntaxError)
              throw new Error(text || `摄像头设置失败 (${response.status})`);
            throw error;
          }
        }
        setCameraSettings((await response.json()) as CameraSettings);
        if (patch.resolution !== undefined) {
          setStreamFailed(false);
          setStreamVersion(String(Date.now()));
        }
        setCameraMessage("摄像头设置已生效。");
      } catch (error) {
        setCameraMessage(
          error instanceof Error ? error.message : "摄像头设置失败",
        );
        setCameraError(true);
      } finally {
        setCameraSaving(false);
      }
    },
    [endpoint],
  );

  const takePhoto = useCallback(async () => {
    if (!endpoint || photoCapturing) return;
    setPhotoCapturing(true);
    setPhotoError(null);
    let reconnectVersion: string | null = null;
    try {
      const response = await fetch(`http://${endpoint.ipAddress}:${endpoint.controlPort}/camera/capture`, { cache: "no-store" });
      if (response.headers.get("X-Stream-Reconnect-Required") === "true") {
        reconnectVersion = response.headers.get("X-Stream-Generation") ?? String(Date.now());
      }
      if (!response.ok) throw new Error((await response.text()) || `拍照失败 (${response.status})`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error(`拍照接口返回了非图片内容：${blob.type || "unknown"}`);
      const resolution = response.headers.get("X-Camera-Resolution") ?? await imageBlobResolution(blob);
      setPhoto({ url: URL.createObjectURL(blob), resolution });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "拍照失败");
    } finally {
      if (reconnectVersion !== null) {
        setStreamFailed(false);
        setStreamVersion(reconnectVersion);
      }
      setPhotoCapturing(false);
    }
  }, [endpoint, photoCapturing]);

  useEffect(() => {
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement;
    const findAction = (key: string) =>
      (Object.keys(actions) as ActionId[]).find(
        (id) =>
          actions[id].valid &&
          actions[id].key.toLowerCase() === key.toLowerCase(),
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (editable(event.target) || event.repeat) return;
      const id = findAction(event.key === " " ? "Space" : event.key);
      if (id) {
        event.preventDefault();
        void startAction(id);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        !editable(event.target) &&
        findAction(event.key === " " ? "Space" : event.key)
      )
        sendStop();
    };
    const onBlur = () => sendStop(true);
    const onVisibility = () => {
      if (document.hidden) sendStop(true);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [actions, sendStop, startAction]);
  useEffect(
    () => () => {
      if (endpoint)
        void fetch(
          `http://${endpoint.ipAddress}:${endpoint.controlPort}/command?name=stop`,
          { method: "POST", keepalive: true },
        ).catch(() => undefined);
    },
    [endpoint],
  );

  const dateText = useMemo(
    () =>
      now?.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }) ?? "----/--/--",
    [now],
  );
  const timeText = useMemo(
    () => now?.toLocaleTimeString("zh-CN", { hour12: false }) ?? "--:--:--",
    [now],
  );
  const streamUrl = endpoint
    ? `http://${endpoint.ipAddress}:${endpoint.videoPort}/stream?v=${encodeURIComponent(streamVersion)}`
    : null;
  const bounds = controllerConfig ?? {
    minDurationMs: 1,
    maxDurationMs: 4294967295,
    minFrequency: 1,
    maxFrequency: 500,
  };
  const duplicateChannels = new Set(channels).size !== 4;
  const updateAction = <K extends keyof ActionConfig>(
    id: ActionId,
    key: K,
    value: ActionConfig[K],
  ) => {
    setActions((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
    if (key === "valid" && value === false && activeAction === id) sendStop();
  };

  return (
    <section
      className="relative h-dvh min-h-[640px] overflow-hidden bg-zinc-950 text-white"
      aria-label="实时控制工作区"
    >
      <div className="absolute inset-0 bg-zinc-950">
        {streamUrl && !streamFailed ? (
          <img
            src={streamUrl}
            alt="主板摄像头实时画面"
            className="size-full object-contain"
            onError={() => setStreamFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(145deg,#27272a_0%,#09090b_58%,#18181b_100%)] text-center text-zinc-500">
            <div>
              <p className="mt-3 text-sm tracking-[.2em]">
                {connectionState === "discovering"
                  ? "DISCOVERING BOARD"
                  : streamFailed
                    ? "VIDEO STREAM UNAVAILABLE"
                    : "WAITING FOR CAMERA"}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="absolute left-5 top-5 z-10 px-4 py-3 sm:left-7 sm:top-7">
        <time className="block font-mono text-xl font-semibold tracking-wide">
          {timeText}
        </time>
        <span className="mt-1 block text-xs text-zinc-300">{dateText}</span>
      </div>
      <div className="absolute right-5 top-5 z-10 flex items-center gap-3 px-4 py-3 sm:right-7 sm:top-7">
        <Battery50Icon className="size-6" />
        <span className="font-mono text-sm" title="固件暂未提供电量接口">
          --%
        </span>
      </div>
      <div
        className={`absolute left-1/2 top-5 z-20 max-w-[55vw] -translate-x-1/2 rounded-full border px-4 py-2 text-center text-xs backdrop-blur-md ${connectionState === "connected" ? "border-green-500/40 bg-green-950/75 text-green-200" : connectionState === "error" ? "border-red-500/40 bg-red-950/75 text-red-200" : "border-zinc-700 bg-zinc-950/75 text-zinc-300"}`}
      >
        {message ?? "等待连接"}
      </div>
      <Crosshair />
      {activeAction && (
        <div className="absolute left-1/2 top-[60%] z-10 -translate-x-1/2 rounded-full border border-white/30 bg-zinc-950/75 px-4 py-2 text-xs font-medium text-white backdrop-blur-md">
          正在执行：{actionMeta[activeAction].label}
        </div>
      )}
      {photoCapturing && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-950/80 px-4 py-2 text-xs text-amber-200 backdrop-blur-md">
          正在以最大分辨率拍照，视频画面会短暂停顿…
        </div>
      )}
      {photoError && !photoCapturing && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full border border-red-500/40 bg-red-950/80 px-4 py-2 text-xs text-red-200 backdrop-blur-md">
          {photoError}
        </div>
      )}
      <div className="absolute bottom-6 left-5 z-20 flex gap-3 sm:bottom-8 sm:left-7">
        <button
          type="button"
          className={hudButtonClass(settingsOpen)}
          aria-label="设置"
          title="设置"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Cog6ToothIcon className="size-6" />
        </button>
        <button
          type="button"
          disabled={!endpoint || photoCapturing}
          className={`${hudButtonClass(photoCapturing)} disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="拍照"
          title="以摄像头最大分辨率拍照"
          onClick={() => void takePhoto()}
        >
          <CameraIcon className="size-6" />
        </button>
      </div>
      <div className="absolute bottom-5 right-5 z-20 grid grid-cols-3 grid-rows-3 gap-2 sm:bottom-7 sm:right-7">
        {(Object.keys(actionMeta) as ActionId[])
          .filter((id) => actions[id].valid)
          .map((id) => {
            const meta = actionMeta[id];
            const Icon = meta.icon;
            return (
              <button
                key={id}
                type="button"
                disabled={!endpoint || duplicateChannels}
                className={`${hudButtonClass(activeAction === id)} ${meta.position} disabled:cursor-not-allowed disabled:opacity-40`}
                aria-label={`${meta.label}，快捷键 ${actions[id].key}`}
                title={`${meta.label} · ${actions[id].key}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  void startAction(id);
                }}
                onPointerUp={() => sendStop()}
                onPointerCancel={() => sendStop()}
                onPointerLeave={() => {
                  if (activeAction === id) sendStop();
                }}
              >
                <Icon className="size-6" />
                <span className="sr-only">{meta.label}</span>
              </button>
            );
          })}
      </div>

      {photo && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl" role="dialog" aria-modal="true" aria-label="拍照结果">
            <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
              <div><h2 className="text-sm font-semibold">拍照结果</h2><p className="mt-1 text-xs text-zinc-400">实际分辨率：{photo.resolution ?? "未提供"}</p></div>
              <div className="flex items-center gap-2"><a className="inline-flex min-h-9 items-center rounded-lg bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-200" href={photo.url} download={`camera-${photo.resolution ?? "capture"}.jpg`}>下载照片</a><button type="button" className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="关闭照片" onClick={() => setPhoto(null)}><XMarkIcon className="size-5" /></button></div>
            </header>
            <div className="grid max-h-[75vh] place-items-center overflow-auto bg-black p-3"><img src={photo.url} alt={`摄像头照片 ${photo.resolution ?? ""}`} className="max-h-[70vh] max-w-full object-contain" /></div>
          </section>
        </div>
      )}

      <aside
        className={`absolute inset-y-0 left-0 z-40 w-[min(92vw,430px)] overflow-y-auto border-r border-zinc-800 bg-zinc-950/92 p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:p-7 ${settingsOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!settingsOpen}
      >
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-zinc-400">
              Live Control
            </p>
            <h2 className="mt-1 text-xl font-semibold">设置</h2>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="关闭设置"
            onClick={() => setSettingsOpen(false)}
          >
            <XMarkIcon className="size-6" />
          </button>
        </header>
        <section>
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
              Connection
            </h3>
            <button
              type="button"
              disabled={connectionState === "discovering"}
              className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-40"
              onClick={() => void discover()}
            >
              <ArrowPathIcon
                className={`size-4 ${connectionState === "discovering" ? "animate-spin" : ""}`}
              />
              重新发现
            </button>
          </div>
          <dl className="mt-4 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">目标主板</dt>
              <dd className="text-right">
                {board ? `${board.model} · ${board.mac}` : "自动选择"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">IP</dt>
              <dd>{endpoint?.ipAddress ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">网络模式</dt>
              <dd>{controllerConfig?.networkMode ?? "—"}</dd>
            </div>
          </dl>
        </section>
        <section className="mt-8">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
              Camera Settings
            </h3>
            {cameraSaving && (
              <span className="text-xs text-amber-300">保存中…</span>
            )}
          </div>
          {!cameraSettings ? (
            <p
              className={`mt-3 text-xs leading-5 ${cameraError ? "text-red-300" : "text-zinc-500"}`}
            >
              {cameraMessage ?? "连接主板后读取摄像头设置。"}
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-sm text-zinc-200">
                <span>Resolution</span>
                <Select
                  disabled={cameraSaving}
                  value={cameraSettings.resolution}
                  onChange={(event) => {
                    const resolution = event.target.value;
                    setCameraSettings((current) =>
                      current ? { ...current, resolution } : current,
                    );
                    void saveCameraSettings({ resolution });
                  }}
                >
                  {cameraSettings.supportedResolutions.map((resolution) => (
                    <option key={resolution} value={resolution}>
                      {resolution.replace("x", " × ")}
                    </option>
                  ))}
                </Select>
              </label>
              <CameraRange
                label="FPS"
                value={cameraSettings.fps}
                limits={cameraSettings.limits.fps}
                disabled={cameraSaving}
                onPreview={(fps) =>
                  setCameraSettings((current) =>
                    current ? { ...current, fps } : current,
                  )
                }
                onCommit={(fps) => void saveCameraSettings({ fps })}
              />
              <CameraRange
                label="Brightness"
                value={cameraSettings.brightness}
                limits={cameraSettings.limits.brightness}
                disabled={cameraSaving}
                onPreview={(brightness) =>
                  setCameraSettings((current) =>
                    current ? { ...current, brightness } : current,
                  )
                }
                onCommit={(brightness) =>
                  void saveCameraSettings({ brightness })
                }
              />
              <CameraRange
                label="Contrast"
                value={cameraSettings.contrast}
                limits={cameraSettings.limits.contrast}
                disabled={cameraSaving}
                onPreview={(contrast) =>
                  setCameraSettings((current) =>
                    current ? { ...current, contrast } : current,
                  )
                }
                onCommit={(contrast) => void saveCameraSettings({ contrast })}
              />
              <CameraRange
                label="Sharpness"
                value={cameraSettings.sharpness}
                limits={cameraSettings.limits.sharpness}
                disabled={cameraSaving}
                onPreview={(sharpness) =>
                  setCameraSettings((current) =>
                    current ? { ...current, sharpness } : current,
                  )
                }
                onCommit={(sharpness) => void saveCameraSettings({ sharpness })}
              />
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["hmirror", "H-Mirror"],
                    ["vflip", "V-Flip"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-200"
                  >
                    <span>{label}</span>
                    <input
                      className="size-4 accent-zinc-100 disabled:opacity-50"
                      type="checkbox"
                      disabled={cameraSaving}
                      checked={cameraSettings[key]}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setCameraSettings((current) =>
                          current ? { ...current, [key]: checked } : current,
                        );
                        void saveCameraSettings({ [key]: checked });
                      }}
                    />
                  </label>
                ))}
              </div>
              {cameraMessage && (
                <p
                  className={`text-xs ${cameraError ? "text-red-300" : "text-green-300"}`}
                >
                  {cameraMessage}
                </p>
              )}
            </div>
          )}
        </section>
        <section className="mt-8">
          <h3 className="border-b border-zinc-800 pb-3 text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
            Channel Settings
          </h3>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            D 编号是 XIAO 板载标签，不是 ESP32 原始 GPIO。四个通道必须互不重复。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {channelLabels.map((label, index) => (
              <label key={label} className="grid gap-1.5 text-xs text-zinc-300">
                <span>{label}</span>
                <Select
                  value={channels[index]}
                  onChange={(event) =>
                    setChannels((current) =>
                      current.map((pin, pinIndex) =>
                        pinIndex === index ? Number(event.target.value) : pin,
                      ),
                    )
                  }
                >
                  {pinOptions.map((pin) => (
                    <option key={pin} value={pin}>
                      D{pin}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
          {duplicateChannels && (
            <p className="mt-3 text-xs text-red-300">
              通道存在重复，动作控制已禁用。
            </p>
          )}
        </section>
        <section className="mt-8">
          <h3 className="border-b border-zinc-800 pb-3 text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
            Action Settings
          </h3>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Invalid
            动作不会显示按钮，也不会响应键盘。松开按键或窗口失焦会立即发送
            stop。
          </p>
          <div className="mt-4 grid gap-4">
            {(Object.keys(actionMeta) as ActionId[]).map((id) => {
              const config = actions[id];
              return (
                <article
                  key={id}
                  className={`rounded-xl border p-4 ${config.valid ? "border-zinc-700 bg-zinc-900/70" : "border-zinc-800 bg-zinc-950 opacity-60"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm">
                        {actionMeta[id].label}
                      </strong>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        API: {id} · {actionMeta[id].pair}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <span>{config.valid ? "Valid" : "Invalid"}</span>
                      <input
                        className="size-4 accent-zinc-100"
                        type="checkbox"
                        checked={config.valid}
                        onChange={(event) =>
                          updateAction(id, "valid", event.target.checked)
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1.5 text-xs text-zinc-300">
                        <span>频率 (Hz)</span>
                        <Input
                          type="number"
                          min={bounds.minFrequency}
                          max={bounds.maxFrequency}
                          step="any"
                          value={config.frequencyHz}
                          onChange={(event) =>
                            updateAction(id, "frequencyHz", event.target.value)
                          }
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-300">
                        <span>刺激时长 (ms)</span>
                        <Input
                          type="number"
                          min={bounds.minDurationMs}
                          max={bounds.maxDurationMs}
                          step="1"
                          value={config.durationMs}
                          onChange={(event) =>
                            updateAction(id, "durationMs", event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <label className="grid gap-1.5 text-xs text-zinc-300">
                      <span>Keyboard Shortcut</span>
                      <Select
                        value={config.key}
                        onChange={(event) =>
                          updateAction(id, "key", event.target.value)
                        }
                      >
                        {shortcutKeys.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </aside>
    </section>
  );
}
