"use client";
/* eslint-disable @next/next/no-img-element -- A native img element is required for the MJPEG stream. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  Battery50Icon,
  BugAntIcon,
  CameraIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Behavior, Board, SpeciesRecord, StimulationChannel } from "@/app/types";
import { api } from "@/app/lib";
import { Select } from "@/components/circo/primitives";

type SettingsSectionId = "connection" | "control" | "channels" | "camera" | "shortcuts";
type ControlMethod = "buttons" | "keyboard" | "gamepad";
type SavedControlSettings = {
  speciesId: number;
  controlMethod: ControlMethod;
};
type ChannelOverride = {
  pin1: number;
  pin2: number;
  frequencyHz: string;
  durationMs: string;
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
  maxFpsByResolution: Record<string, number>;
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
type StreamStats = {
  active: boolean;
  stream_id: number;
  frames_sent: number;
};
type WifiNetwork = {
  ssid: string;
  rssi: number | null;
};
type WifiConnectionState = {
  ok: boolean;
  connectionState: string;
  accessPoint: {
    active: boolean;
    ssid: string;
    ip: string;
  } | null;
  station: {
    connected: boolean;
    ssid: string;
    ip: string;
  } | null;
  error: string | null;
};
type WifiAccessPointSettings = {
  ok: boolean;
  supportedBands: string[];
  band: string;
  channel: number;
  actualChannel: number;
  minChannel: number;
  maxChannel: number;
  restartPending: boolean;
  stationOverridesChannel: boolean;
};
type DiscoveryResponse = {
  discovered: Array<{
    mac: string;
    ip_address: string;
    model: string | null;
    control_port: number | null;
    video_port: number | null;
  }>;
};

const CONTROL_SETTINGS_STORAGE_KEY = "exp-recorder:live-control-settings";
const channelPinOptions = Array.from({ length: 9 }, (_, index) => index);

const actionMeta: Record<
  string,
  { label: string }
> = {
  forward: {
    label: "Forward",
  },
  back: {
    label: "Back",
  },
  left: {
    label: "Left",
  },
  right: {
    label: "Right",
  },
};
const gamepadButtonNames: Record<number, string> = {
  0: "A / Cross",
  1: "B / Circle",
  2: "X / Square",
  3: "Y / Triangle",
  4: "LB / L1",
  5: "RB / R1",
  6: "LT / L2",
  7: "RT / R2",
  8: "Back / Share",
  9: "Start / Options",
  10: "Left Stick Press",
  11: "Right Stick Press",
  12: "D-pad Up",
  13: "D-pad Down",
  14: "D-pad Left",
  15: "D-pad Right",
  16: "Home",
};

function normalizedMac(value: string) {
  return value.replace(/[^0-9a-f]/gi, "").toUpperCase();
}

function displayMac(value: string) {
  return normalizedMac(value).match(/.{1,2}/g)?.join(":") ?? value;
}

function requestStimulationStop(endpoint: Endpoint, keepalive = false) {
  return fetch(
    `http://${endpoint.ipAddress}:${endpoint.controlPort}/stimulation/stop`,
    { method: "POST", keepalive },
  );
}

function behaviorMeta(name: string) {
  const normalizedName = name.trim().toLowerCase();
  return actionMeta[normalizedName] ?? {
    label: name,
  };
}

function gamepadShortcut(gamepad: Gamepad): string | null {
  for (const index of [12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16]) {
    const button = gamepad.buttons[index];
    if (button?.pressed || (button?.value ?? 0) > 0.55) return `Gamepad:Button${index}`;
  }

  const horizontal = gamepad.axes[0] ?? 0;
  const vertical = gamepad.axes[1] ?? 0;
  const deadZone = 0.55;
  if (Math.abs(horizontal) < deadZone && Math.abs(vertical) < deadZone) return null;
  if (Math.abs(horizontal) > Math.abs(vertical)) {
    return horizontal < 0 ? "Gamepad:LeftStickLeft" : "Gamepad:LeftStickRight";
  }
  return vertical < 0 ? "Gamepad:LeftStickUp" : "Gamepad:LeftStickDown";
}

function shortcutLabel(shortcut: string) {
  const buttonMatch = /^Gamepad:Button(\d+)$/.exec(shortcut);
  if (buttonMatch) {
    const index = Number(buttonMatch[1]);
    return `Gamepad · ${gamepadButtonNames[index] ?? `Button ${index}`}`;
  }
  const stickLabels: Record<string, string> = {
    "Gamepad:LeftStickUp": "Gamepad · Left Stick Up",
    "Gamepad:LeftStickDown": "Gamepad · Left Stick Down",
    "Gamepad:LeftStickLeft": "Gamepad · Left Stick Left",
    "Gamepad:LeftStickRight": "Gamepad · Left Stick Right",
  };
  return stickLabels[shortcut] ?? shortcut;
}

function keyboardShortcut(event: KeyboardEvent) {
  if (event.key === " ") return "Space";
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

function isControlMethod(value: unknown): value is ControlMethod {
  return value === "buttons" || value === "keyboard" || value === "gamepad";
}

function controlMethodLabel(method: ControlMethod) {
  return method === "buttons"
    ? "On-screen Buttons"
    : method === "keyboard"
      ? "Keyboard"
      : "USB Gamepad";
}

function channelOverrideValue(
  channel: StimulationChannel,
  override?: ChannelOverride,
): ChannelOverride {
  return override ?? {
    pin1: channel.channel_pin_1,
    pin2: channel.channel_pin_2,
    frequencyHz: String(channel.channel_freq_hz),
    durationMs: String(channel.channel_stim_duration_ms),
  };
}

function parseWifiNetworks(payload: unknown): WifiNetwork[] {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && "networks" in payload &&
        Array.isArray(payload.networks)
      ? payload.networks
      : [];
  const unique = new Map<string, WifiNetwork>();
  records.forEach((record) => {
    if (!record || typeof record !== "object" || !("ssid" in record)) return;
    const ssid = String(record.ssid).trim();
    if (!ssid) return;
    const value = "rssi" in record ? Number(record.rssi) : Number.NaN;
    const network = { ssid, rssi: Number.isFinite(value) ? value : null };
    const current = unique.get(ssid);
    if (!current || (network.rssi ?? -Infinity) > (current.rssi ?? -Infinity)) {
      unique.set(ssid, network);
    }
  });
  return Array.from(unique.values()).sort(
    (left, right) => (right.rssi ?? -Infinity) - (left.rssi ?? -Infinity),
  );
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

export function LiveControlPage({
  board,
  refreshToken,
}: {
  board: Board | null;
  refreshToken: number;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedSettingsSection, setExpandedSettingsSection] =
    useState<SettingsSectionId | null>(null);
  const [activeBehaviorId, setActiveBehaviorId] = useState<number | null>(null);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [shortcutOverrides, setShortcutOverrides] = useState<Record<number, string>>({});
  const [listeningBehaviorId, setListeningBehaviorId] = useState<number | null>(null);
  const [shortcutCaptureError, setShortcutCaptureError] = useState<string | null>(null);
  const [channels, setChannels] = useState<StimulationChannel[]>([]);
  const [channelOverrides, setChannelOverrides] = useState<Record<number, ChannelOverride>>({});
  const [speciesRecords, setSpeciesRecords] = useState<SpeciesRecord[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(null);
  const [controlMethod, setControlMethod] = useState<ControlMethod>("buttons");
  const [controlSettingsMessage, setControlSettingsMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [availableBoards, setAvailableBoards] = useState<Endpoint[]>([]);
  const [boardPickerOpen, setBoardPickerOpen] = useState(board === null);
  const [connectingMac, setConnectingMac] = useState<string | null>(null);
  const [controllerConfig, setControllerConfig] =
    useState<ControllerConfig | null>(null);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(
    null,
  );
  const [cameraSaving, setCameraSaving] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [wifiSettings, setWifiSettings] = useState<WifiConnectionState | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiSaving, setWifiSaving] = useState(false);
  const [wifiPolling, setWifiPolling] = useState(false);
  const [wifiMessage, setWifiMessage] = useState<string | null>(null);
  const [wifiError, setWifiError] = useState(false);
  const [accessPointSettings, setAccessPointSettings] =
    useState<WifiAccessPointSettings | null>(null);
  const [accessPointChannel, setAccessPointChannel] = useState("6");
  const [accessPointSaving, setAccessPointSaving] = useState(false);
  const [accessPointMessage, setAccessPointMessage] = useState<string | null>(null);
  const [accessPointError, setAccessPointError] = useState(false);
  const [streamVersion, setStreamVersion] = useState(() => String(Date.now()));
  const [frameRate, setFrameRate] = useState<{ url: string | null; value: number | null }>({ url: null, value: null });
  const previousStreamStats = useRef<{ streamId: number; framesSent: number; timestamp: number } | null>(null);
  const [streamOwnerUrl, setStreamOwnerUrl] = useState<string | null>(null);
  const [streamLockUnavailable, setStreamLockUnavailable] = useState(false);
  const [photoCapturing, setPhotoCapturing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ url: string; resolution: string | null } | null>(null);
  const [connectionState, setConnectionState] = useState<
    "idle" | "discovering" | "connected" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);
  const [streamFailed, setStreamFailed] = useState(false);
  const connectionAttempt = useRef(0);
  const requestedBoardRefresh = useRef<string | null>(null);
  const stimulationRequest = useRef(0);
  const activeBehaviorTimer = useRef<number | null>(null);
  const heldBehaviorId = useRef<number | null>(null);
  const controlSequence = useRef(0);
  const activeStartRequest = useRef<Promise<void> | null>(null);
  const quickActionNoticeTimer = useRef<number | null>(null);
  const gamepadSupported =
    typeof navigator !== "undefined" && typeof navigator.getGamepads === "function";
  const controlSpeciesId =
    selectedSpeciesId !== null &&
    speciesRecords.some((species) => species.species_id === selectedSpeciesId)
      ? selectedSpeciesId
      : speciesRecords[0]?.species_id ?? null;
  const controlChannels = useMemo(
    () => channels.filter((channel) => channel.species_id === controlSpeciesId),
    [channels, controlSpeciesId],
  );
  const enabledBehaviors = useMemo(
    () => behaviors.filter(
      (behavior) =>
        behavior.species_id === controlSpeciesId && behavior.status === "on",
    ),
    [behaviors, controlSpeciesId],
  );
  const usingBoardAccessPoint = Boolean(
    endpoint &&
      (endpoint.ipAddress === "192.168.4.1" ||
        (wifiSettings?.accessPoint?.active &&
          endpoint.ipAddress === wifiSettings.accessPoint.ip)),
  );
  const shortcutForBehavior = useCallback(
    (behavior: Behavior) =>
      shortcutOverrides[behavior.id] ?? behavior.default_shortcut,
    [shortcutOverrides],
  );
  const captureShortcut = useCallback(
    (behaviorId: number, shortcut: string) => {
      const duplicate = enabledBehaviors.find(
        (behavior) =>
          behavior.id !== behaviorId &&
          shortcutForBehavior(behavior).toLowerCase() === shortcut.toLowerCase(),
      );
      if (duplicate) {
        setShortcutCaptureError(
          `${shortcutLabel(shortcut)} is already assigned to ${duplicate.name}.`,
        );
      } else {
        setShortcutOverrides((current) => ({ ...current, [behaviorId]: shortcut }));
        setShortcutCaptureError(null);
      }
      setListeningBehaviorId(null);
    },
    [enabledBehaviors, shortcutForBehavior],
  );

  const clearActiveBehavior = useCallback(() => {
    if (activeBehaviorTimer.current !== null) {
      window.clearTimeout(activeBehaviorTimer.current);
      activeBehaviorTimer.current = null;
    }
    setActiveBehaviorId(null);
  }, []);

  const showQuickActionNotice = useCallback((notice: string) => {
    if (quickActionNoticeTimer.current !== null) {
      window.clearTimeout(quickActionNoticeTimer.current);
    }
    setQuickActionNotice(notice);
    quickActionNoticeTimer.current = window.setTimeout(() => {
      quickActionNoticeTimer.current = null;
      setQuickActionNotice(null);
    }, 2200);
  }, []);

  const updateChannelOverride = useCallback(
    (channel: StimulationChannel, patch: Partial<ChannelOverride>) => {
      setChannelOverrides((current) => ({
        ...current,
        [channel.id]: {
          ...channelOverrideValue(channel, current[channel.id]),
          ...patch,
        },
      }));
    },
    [],
  );

  const resetChannelOverride = useCallback((channelId: number) => {
    setChannelOverrides((current) => {
      const next = { ...current };
      delete next[channelId];
      return next;
    });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(CONTROL_SETTINGS_STORAGE_KEY);
        if (!stored) return;
        const saved = JSON.parse(stored) as Partial<SavedControlSettings>;
        if (Number.isSafeInteger(saved.speciesId) && Number(saved.speciesId) > 0) {
          setSelectedSpeciesId(Number(saved.speciesId));
        }
        if (isControlMethod(saved.controlMethod)) {
          setControlMethod(saved.controlMethod);
        }
      } catch {
        window.localStorage.removeItem(CONTROL_SETTINGS_STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  const rememberControlSettings = useCallback(() => {
    if (controlSpeciesId === null) {
      setControlSettingsMessage({
        tone: "danger",
        text: "Select a species before saving these settings.",
      });
      return;
    }
    try {
      const settings: SavedControlSettings = {
        speciesId: controlSpeciesId,
        controlMethod,
      };
      window.localStorage.setItem(
        CONTROL_SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      );
      setControlSettingsMessage({
        tone: "success",
        text: "Current control settings will be restored next time.",
      });
    } catch {
      setControlSettingsMessage({
        tone: "danger",
        text: "The browser could not save these settings.",
      });
    }
  }, [controlMethod, controlSpeciesId]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api<StimulationChannel[]>("/stimulation-channels"),
      api<SpeciesRecord[]>("/species"),
      api<Behavior[]>("/behaviors"),
    ])
      .then(([channelRecords, species, behaviorRecords]) => {
        if (active) {
          setChannels(channelRecords);
          setSpeciesRecords(species);
          setBehaviors(behaviorRecords);
        }
      })
      .catch(() => {
        if (active) {
          setChannels([]);
          setSpeciesRecords([]);
          setBehaviors([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const connectToBoard = useCallback(async (target: Endpoint) => {
    const attempt = ++connectionAttempt.current;
    setConnectingMac(target.mac);
    setConnectionState("discovering");
    setMessage(`Connecting to ${target.model ?? "XIAO"} · ${target.ipAddress}…`);
    stimulationRequest.current += 1;
    clearActiveBehavior();
    if (endpoint) {
      void requestStimulationStop(endpoint, true).catch(() => undefined);
    }
    setEndpoint(null);
    setControllerConfig(null);
    setCameraSettings(null);
    setCameraMessage(null);
    setCameraError(false);
    setStreamFailed(false);
    setStreamVersion(String(Date.now()));
    try {
      const configResponse = await fetch(
        `http://${target.ipAddress}:${target.controlPort}/config`,
        { cache: "no-store" },
      );
      if (!configResponse.ok)
        throw new Error(`Failed to load board configuration (${configResponse.status})`);
      const config = (await configResponse.json()) as ControllerConfig;
      if (attempt !== connectionAttempt.current) return;
      const resolved = {
        ...target,
        controlPort: config.controlPort,
        videoPort: config.videoPort,
        model: config.model || target.model,
      };
      setEndpoint(resolved);
      setControllerConfig(config);
      setConnectionState("connected");
      // setMessage(`Connected to ${resolved.model ?? "XIAO"} · ${resolved.ipAddress}`);
      setBoardPickerOpen(false);
      try {
        const cameraResponse = await fetch(
          `http://${resolved.ipAddress}:${resolved.controlPort}/camera/settings`,
          { cache: "no-store" },
        );
        if (!cameraResponse.ok)
          throw new Error(`Failed to load camera settings (${cameraResponse.status})`);
        const settings = (await cameraResponse.json()) as CameraSettings;
        if (attempt === connectionAttempt.current) {
          setCameraSettings(settings);
          setCameraMessage("Camera settings synchronized.");
          setCameraError(false);
        }
      } catch (cameraError) {
        if (attempt === connectionAttempt.current) {
          setCameraMessage(
            cameraError instanceof Error
              ? cameraError.message
              : "Failed to load camera settings",
          );
          setCameraError(true);
        }
      }
    } catch (error) {
      if (attempt !== connectionAttempt.current) return;
      setConnectionState("error");
      setMessage(error instanceof Error ? error.message : "Board connection failed");
      setBoardPickerOpen(true);
    } finally {
      if (attempt === connectionAttempt.current) setConnectingMac(null);
    }
  }, [clearActiveBehavior, endpoint]);

  const discover = useCallback(async (autoConnectMac?: string | null) => {
    const attempt = ++connectionAttempt.current;
    stimulationRequest.current += 1;
    clearActiveBehavior();
    if (endpoint) {
      void requestStimulationStop(endpoint, true).catch(() => undefined);
    }
    setConnectionState("discovering");
    setMessage("Discovering controllable boards on the LAN…");
    setBoardPickerOpen(true);
    setConnectingMac(null);
    setAvailableBoards([]);
    try {
      const response = await api<DiscoveryResponse>("/boards/discover", {
        method: "POST",
      });
      if (attempt !== connectionAttempt.current) return;
      const discovered = response.discovered.map((record) => ({
        ipAddress: record.ip_address,
        controlPort: record.control_port ?? 80,
        videoPort: record.video_port ?? 81,
        mac: normalizedMac(record.mac),
        model: record.model,
      }));
      setAvailableBoards(discovered);
      if (autoConnectMac) {
        const target = discovered.find(
          (item) => normalizedMac(item.mac) === normalizedMac(autoConnectMac),
        );
        if (!target) {
          setConnectionState("idle");
          setMessage("The previously selected board was not found. Select an available board.");
          return;
        }
        await connectToBoard(target);
        return;
      }
      setConnectionState(endpoint ? "connected" : "idle");
      setMessage(
        discovered.length
          ? `Found ${discovered.length} controllable board${discovered.length === 1 ? "" : "s"}. Select one to continue.`
          : "No controllable online boards were found.",
      );
    } catch (error) {
      if (attempt !== connectionAttempt.current) return;
      setAvailableBoards([]);
      setConnectionState(endpoint ? "connected" : "error");
      setMessage(error instanceof Error ? error.message : "Board discovery failed");
    }
  }, [clearActiveBehavior, connectToBoard, endpoint]);

  useEffect(() => {
    const targetMac = board?.mac ?? null;
    const refreshRequest = `${refreshToken}:${targetMac ?? "none"}`;
    if (requestedBoardRefresh.current === refreshRequest) return;
    requestedBoardRefresh.current = refreshRequest;
    const timer = window.setTimeout(() => void discover(targetMac), 0);
    return () => window.clearTimeout(timer);
  }, [board?.mac, discover, refreshToken]);

  const sendStop = useCallback(
    (keepalive = false) => {
      const pendingStart = activeStartRequest.current;
      heldBehaviorId.current = null;
      const stopSequence = ++controlSequence.current;
      stimulationRequest.current += 1;
      clearActiveBehavior();
      if (endpoint) {
        void requestStimulationStop(endpoint, keepalive).catch(() => undefined);
        if (pendingStart) {
          void pendingStart.finally(() => {
            if (
              controlSequence.current === stopSequence &&
              heldBehaviorId.current === null
            ) {
              void requestStimulationStop(endpoint, keepalive).catch(() => undefined);
            }
          });
        }
      }
    },
    [clearActiveBehavior, endpoint],
  );

  const cycleControlMethod = useCallback(() => {
    sendStop();
    setListeningBehaviorId(null);
    setControlSettingsMessage(null);
    const nextMethod =
      controlMethod === "buttons"
        ? "keyboard"
        : controlMethod === "keyboard"
          ? "gamepad"
          : "buttons";
    setControlMethod(nextMethod);
    showQuickActionNotice(`Mode · ${controlMethodLabel(nextMethod)}`);
  }, [controlMethod, sendStop, showQuickActionNotice]);

  const cycleSpecies = useCallback(() => {
    if (!speciesRecords.length) return;
    sendStop();
    setListeningBehaviorId(null);
    setControlSettingsMessage(null);
    const currentIndex = speciesRecords.findIndex(
      (species) => species.species_id === controlSpeciesId,
    );
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % speciesRecords.length;
    const nextSpecies = speciesRecords[nextIndex];
    setSelectedSpeciesId(nextSpecies.species_id);
    showQuickActionNotice(
      `Protocol · ${nextSpecies.code} · ${nextSpecies.scientific_name}`,
    );
  }, [controlSpeciesId, sendStop, showQuickActionNotice, speciesRecords]);

  const startBehavior = useCallback(
    async (behavior: Behavior) => {
      if (!endpoint || behavior.status !== "on" || behavior.species_id !== controlSpeciesId || boardPickerOpen) return;
      const channel = channels.find(
        (item) =>
          item.id === behavior.channel_id && item.species_id === controlSpeciesId,
      );
      const settings = channel
        ? channelOverrideValue(channel, channelOverrides[channel.id])
        : null;
      const pin1 = Number(settings?.pin1);
      const pin2 = Number(settings?.pin2);
      const frequency = Number(settings?.frequencyHz);
      const duration = Number(settings?.durationMs);
      if (
        !channel ||
        !channel.channel_name.trim() ||
        !Number.isInteger(pin1) ||
        !Number.isInteger(pin2) ||
        pin1 < 0 ||
        pin1 > 8 ||
        pin2 < 0 ||
        pin2 > 8 ||
        pin1 === pin2 ||
        !Number.isFinite(frequency) ||
        frequency < (controllerConfig?.minFrequency ?? 1) ||
        frequency > (controllerConfig?.maxFrequency ?? 500) ||
        !Number.isFinite(duration) ||
        !Number.isInteger(duration) ||
        duration < (controllerConfig?.minDurationMs ?? 1) ||
        duration > (controllerConfig?.maxDurationMs ?? 4294967295)
      ) {
        setMessage("Select a valid channel for this behavior and check its pins, frequency, and duration.");
        return;
      }
      const requestId = ++stimulationRequest.current;
      clearActiveBehavior();
      setActiveBehaviorId(behavior.id);
      try {
        const response = await fetch(
          `http://${endpoint.ipAddress}:${endpoint.controlPort}/stimulation/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pin1,
              pin2,
              frequencyHz: frequency,
              durationMs: duration,
            }),
          },
        );
        if (!response.ok)
          throw new Error(
            (await response.text()) || `Behavior request failed (${response.status})`,
          );
        if (requestId !== stimulationRequest.current) return;
        activeBehaviorTimer.current = window.setTimeout(() => {
          if (requestId !== stimulationRequest.current) return;
          activeBehaviorTimer.current = null;
          setActiveBehaviorId(null);
        }, duration);
      } catch (error) {
        if (requestId === stimulationRequest.current) {
          clearActiveBehavior();
          setMessage(error instanceof Error ? error.message : "Failed to send behavior");
        }
      }
    },
    [boardPickerOpen, channelOverrides, channels, clearActiveBehavior, controllerConfig, controlSpeciesId, endpoint],
  );

  const pressBehavior = useCallback(
    (behavior: Behavior) => {
      if (heldBehaviorId.current === behavior.id) return;
      heldBehaviorId.current = behavior.id;
      controlSequence.current += 1;
      const request = startBehavior(behavior);
      activeStartRequest.current = request;
      void request.finally(() => {
        if (activeStartRequest.current === request) {
          activeStartRequest.current = null;
        }
      });
    },
    [startBehavior],
  );

  const releaseBehavior = useCallback(
    (behaviorId: number, keepalive = false) => {
      if (heldBehaviorId.current !== behaviorId) return;
      sendStop(keepalive);
    },
    [sendStop],
  );

  const saveCameraSettings = useCallback(
    async (patch: CameraSettingsPatch) => {
      if (!endpoint) return;
      const query = new URLSearchParams();
      Object.entries(patch).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, String(value));
      });
      setCameraSaving(true);
      setCameraMessage("Saving camera settings…");
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
              body.error || text || `Camera settings update failed (${response.status})`,
            );
          } catch (error) {
            if (error instanceof SyntaxError)
              throw new Error(text || `Camera settings update failed (${response.status})`);
            throw error;
          }
        }
        setCameraSettings((await response.json()) as CameraSettings);
        if (patch.resolution !== undefined) {
          setStreamFailed(false);
          setStreamVersion(String(Date.now()));
        }
        setCameraMessage("Camera settings applied.");
      } catch (error) {
        setCameraMessage(
          error instanceof Error ? error.message : "Camera settings update failed",
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
      if (!response.ok) throw new Error((await response.text()) || `Capture failed (${response.status})`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error(`The capture endpoint returned non-image content: ${blob.type || "unknown"}`);
      const resolution = response.headers.get("X-Camera-Resolution") ?? await imageBlobResolution(blob);
      setPhoto({ url: URL.createObjectURL(blob), resolution });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Capture failed");
    } finally {
      if (reconnectVersion !== null) {
        setStreamFailed(false);
        setStreamVersion(reconnectVersion);
      }
      setPhotoCapturing(false);
    }
  }, [endpoint, photoCapturing]);

  const loadWifiSettings = useCallback(async (quiet = false) => {
    if (!endpoint) return null;
    if (!quiet) {
      setWifiMessage("Loading Wi-Fi status…");
      setWifiError(false);
    }
    try {
      const response = await fetch(
        `http://${endpoint.ipAddress}:${endpoint.controlPort}/wifi/settings`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(
          (await response.text()) || `Wi-Fi status request failed (${response.status})`,
        );
      }
      const settings = (await response.json()) as WifiConnectionState;
      setWifiSettings(settings);
      setWifiError(settings.connectionState === "failed");
      if (settings.connectionState === "connected" && settings.station?.connected) {
        setWifiMessage(
          `Connected to ${settings.station.ssid} at ${settings.station.ip}. Join that network before the board hotspot closes.`,
        );
      } else if (settings.connectionState === "failed") {
        setWifiMessage(settings.error || "The board could not connect to that Wi-Fi network.");
      } else if (settings.connectionState === "connecting") {
        setWifiMessage("The board is connecting. Stimulation and camera controls remain available.");
      } else if (!quiet) {
        setWifiMessage("Wi-Fi status synchronized.");
      }
      return settings;
    } catch (error) {
      if (!quiet) {
        setWifiMessage(error instanceof Error ? error.message : "Failed to load Wi-Fi status.");
        setWifiError(true);
      }
      return null;
    }
  }, [endpoint]);

  const loadAccessPointSettings = useCallback(async () => {
    if (!endpoint) return null;
    try {
      const response = await fetch(
        `http://${endpoint.ipAddress}:${endpoint.controlPort}/wifi/access-point`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            `Access point settings request failed (${response.status})`,
        );
      }
      const settings = (await response.json()) as WifiAccessPointSettings;
      setAccessPointSettings(settings);
      setAccessPointChannel(String(settings.channel));
      setAccessPointError(false);
      setAccessPointMessage(null);
      return settings;
    } catch (error) {
      setAccessPointMessage(
        error instanceof Error
          ? error.message
          : "Failed to load access point settings.",
      );
      setAccessPointError(true);
      return null;
    }
  }, [endpoint]);

  const saveAccessPointSettings = useCallback(async () => {
    if (!endpoint || !accessPointSettings || accessPointSaving) return;
    const channel = Number(accessPointChannel);
    if (
      !Number.isInteger(channel) ||
      channel < accessPointSettings.minChannel ||
      channel > accessPointSettings.maxChannel
    ) {
      setAccessPointMessage(
        `Choose a channel from ${accessPointSettings.minChannel} to ${accessPointSettings.maxChannel}.`,
      );
      setAccessPointError(true);
      return;
    }
    sendStop(true);
    setAccessPointSaving(true);
    setAccessPointMessage(`Saving hotspot channel ${channel}…`);
    setAccessPointError(false);
    try {
      const response = await fetch(
        `http://${endpoint.ipAddress}:${endpoint.controlPort}/wifi/access-point`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel }),
        },
      );
      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            `Access point settings update failed (${response.status})`,
        );
      }
      setAccessPointSettings((current) =>
        current ? { ...current, channel, restartPending: true } : current,
      );
      setAccessPointMessage(
        accessPointSettings.stationOverridesChannel
          ? `Channel ${channel} was saved. The connected router currently controls the actual shared radio channel.`
          : `Channel ${channel} was saved. The hotspot is restarting; reconnect to ${wifiSettings?.accessPoint?.ssid ?? "the board hotspot"}.`,
      );
    } catch (error) {
      setAccessPointMessage(
        error instanceof Error
          ? error.message
          : "Failed to update access point settings.",
      );
      setAccessPointError(true);
    } finally {
      setAccessPointSaving(false);
    }
  }, [accessPointChannel, accessPointSaving, accessPointSettings, endpoint, sendStop, wifiSettings]);

  const scanWifiNetworks = useCallback(async () => {
    if (!endpoint || wifiScanning) return;
    setWifiScanning(true);
    setWifiMessage("Scanning nearby Wi-Fi networks…");
    setWifiError(false);
    try {
      const response = await fetch(
        `http://${endpoint.ipAddress}:${endpoint.controlPort}/wifi/networks`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(
          (await response.text()) || `Wi-Fi scan failed (${response.status})`,
        );
      }
      const networks = parseWifiNetworks(await response.json());
      setWifiNetworks(networks);
      setWifiMessage(
        networks.length
          ? `Found ${networks.length} Wi-Fi network${networks.length === 1 ? "" : "s"}.`
          : "No named Wi-Fi networks were found. You can enter a hidden SSID manually.",
      );
    } catch (error) {
      setWifiMessage(error instanceof Error ? error.message : "Wi-Fi scan failed.");
      setWifiError(true);
    } finally {
      setWifiScanning(false);
    }
  }, [endpoint, wifiScanning]);

  const saveWifiSettings = useCallback(async () => {
    const ssid = wifiSsid.trim();
    if (!endpoint || !ssid || wifiSaving || wifiPolling) return;
    sendStop(true);
    setWifiSaving(true);
    setWifiMessage(`Sending credentials for ${ssid}…`);
    setWifiError(false);
    try {
      const response = await fetch(
        `http://${endpoint.ipAddress}:${endpoint.controlPort}/wifi/settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssid, password: wifiPassword }),
        },
      );
      if (!response.ok) {
        throw new Error(
          (await response.text()) || `Wi-Fi settings update failed (${response.status})`,
        );
      }
      setWifiPassword("");
      setWifiMessage(`Connecting to ${ssid}…`);
      setWifiPolling(true);
    } catch (error) {
      setWifiMessage(
        error instanceof Error ? error.message : "Failed to update Wi-Fi settings.",
      );
      setWifiError(true);
    } finally {
      setWifiSaving(false);
    }
  }, [endpoint, sendStop, wifiPassword, wifiPolling, wifiSaving, wifiSsid]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setWifiSettings(null);
      setWifiNetworks([]);
      setWifiPolling(false);
      setWifiMessage(null);
      setWifiError(false);
      setAccessPointSettings(null);
      setAccessPointMessage(null);
      setAccessPointError(false);
      if (endpoint) {
        void Promise.all([loadWifiSettings(), loadAccessPointSettings()]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [endpoint, loadAccessPointSettings, loadWifiSettings]);

  useEffect(() => {
    if (!endpoint || !wifiPolling) return;
    let active = true;
    let timer = 0;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const settings = await loadWifiSettings(true);
      if (!active) return;
      if (
        settings?.connectionState === "connected" ||
        settings?.connectionState === "failed"
      ) {
        setWifiPolling(false);
        return;
      }
      if (attempts >= 15) {
        setWifiPolling(false);
        setWifiError(true);
        setWifiMessage(
          "The board did not report a final Wi-Fi state. Reconnect to its hotspot and check the status again.",
        );
        return;
      }
      timer = window.setTimeout(() => void poll(), 1000);
    };
    timer = window.setTimeout(() => void poll(), 600);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [endpoint, loadWifiSettings, wifiPolling]);

  useEffect(() => {
    const supported = typeof navigator.getGamepads === "function";
    if (!supported) return;

    const refreshGamepad = () => {
      const connected = Array.from(navigator.getGamepads()).find(
        (gamepad): gamepad is Gamepad => gamepad !== null && gamepad.connected,
      );
      setGamepadName(connected?.id ?? null);
    };
    const onConnected = (event: GamepadEvent) => setGamepadName(event.gamepad.id);
    const onDisconnected = () => refreshGamepad();
    refreshGamepad();
    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    return () => {
      window.removeEventListener("gamepadconnected", onConnected);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
    };
  }, []);

  useEffect(() => {
    if (listeningBehaviorId === null) return;
    let animationFrame = 0;
    let gamepadArmed = false;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setListeningBehaviorId(null);
        return;
      }
      captureShortcut(listeningBehaviorId, keyboardShortcut(event));
    };
    const pollGamepad = () => {
      const gamepad = typeof navigator.getGamepads === "function"
        ? Array.from(navigator.getGamepads()).find(
            (candidate): candidate is Gamepad => candidate !== null && candidate.connected,
          )
        : undefined;
      const shortcut = gamepad ? gamepadShortcut(gamepad) : null;
      if (!shortcut) gamepadArmed = true;
      else if (gamepadArmed) {
        captureShortcut(listeningBehaviorId, shortcut);
        return;
      }
      animationFrame = window.requestAnimationFrame(pollGamepad);
    };

    window.addEventListener("keydown", onKeyDown, true);
    animationFrame = window.requestAnimationFrame(pollGamepad);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [captureShortcut, listeningBehaviorId]);

  useEffect(() => {
    if (
      controlMethod !== "gamepad" ||
      listeningBehaviorId !== null ||
      typeof navigator.getGamepads !== "function"
    ) return;
    let animationFrame = 0;
    let activeBehavior: number | null = null;

    const pollGamepad = () => {
      const gamepad = Array.from(navigator.getGamepads()).find(
        (candidate): candidate is Gamepad => candidate !== null && candidate.connected,
      );
      if (gamepad) {
        setGamepadName((current) => current === gamepad.id ? current : gamepad.id);
      }
      const shortcut = gamepad ? gamepadShortcut(gamepad) : null;
      const behavior = shortcut
        ? enabledBehaviors.find(
            (candidate) =>
              shortcutForBehavior(candidate).toLowerCase() === shortcut.toLowerCase(),
          )
        : undefined;
      const nextBehavior = behavior?.id ?? null;

      if (nextBehavior !== activeBehavior) {
        const previousBehavior = activeBehavior;
        activeBehavior = nextBehavior;
        if (behavior) pressBehavior(behavior);
        else if (previousBehavior !== null) releaseBehavior(previousBehavior);
      }
      animationFrame = window.requestAnimationFrame(pollGamepad);
    };

    animationFrame = window.requestAnimationFrame(pollGamepad);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (activeBehavior !== null) releaseBehavior(activeBehavior, true);
    };
  }, [controlMethod, enabledBehaviors, listeningBehaviorId, pressBehavior, releaseBehavior, shortcutForBehavior]);

  useEffect(() => {
    if (controlMethod !== "keyboard" || listeningBehaviorId !== null) return;
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement;
    const findBehavior = (key: string) =>
      enabledBehaviors.find(
        (behavior) => shortcutForBehavior(behavior).toLowerCase() === key.toLowerCase(),
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (editable(event.target) || event.repeat) return;
      const behavior = findBehavior(keyboardShortcut(event));
      if (behavior) {
        event.preventDefault();
        pressBehavior(behavior);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      const behavior = findBehavior(keyboardShortcut(event));
      if (behavior) {
        event.preventDefault();
        releaseBehavior(behavior.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [controlMethod, enabledBehaviors, listeningBehaviorId, pressBehavior, releaseBehavior, shortcutForBehavior]);

  useEffect(() => {
    const stopForInterruption = () => sendStop(true);
    const onVisibility = () => {
      if (document.hidden) stopForInterruption();
    };
    window.addEventListener("blur", stopForInterruption);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", stopForInterruption);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sendStop]);
  useEffect(
    () => () => {
      const pendingStart = activeStartRequest.current;
      stimulationRequest.current += 1;
      heldBehaviorId.current = null;
      controlSequence.current += 1;
      if (activeBehaviorTimer.current !== null) {
        window.clearTimeout(activeBehaviorTimer.current);
        activeBehaviorTimer.current = null;
      }
      if (quickActionNoticeTimer.current !== null) {
        window.clearTimeout(quickActionNoticeTimer.current);
        quickActionNoticeTimer.current = null;
      }
      if (endpoint) {
        void requestStimulationStop(endpoint, true).catch(() => undefined);
        if (pendingStart) {
          void pendingStart.finally(() => {
            void requestStimulationStop(endpoint, true).catch(() => undefined);
          });
        }
      }
    },
    [endpoint],
  );

  const dateText = useMemo(
    () =>
      now?.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }) ?? "----/--/--",
    [now],
  );
  const timeText = useMemo(
    () => now?.toLocaleTimeString("en-US", { hour12: false }) ?? "--:--:--",
    [now],
  );
  const streamUrl = endpoint
    ? `http://${endpoint.ipAddress}:${endpoint.videoPort}/stream?v=${encodeURIComponent(streamVersion)}`
    : null;
  const streamStatsUrl = endpoint
    ? `http://${endpoint.ipAddress}:${endpoint.controlPort}/stream/stats`
    : null;
  const ownsStream = streamUrl !== null && streamOwnerUrl === streamUrl;
  const streamFps = streamFailed || !ownsStream || frameRate.url !== streamStatsUrl ? null : frameRate.value;
  useEffect(() => {
    if (!streamUrl || !endpoint) return;
    let active = true;
    let releaseStream: (() => void) | null = null;
    if (!navigator.locks) {
      queueMicrotask(() => {
        if (active) setStreamLockUnavailable(true);
      });
      return () => { active = false; };
    }

    const lockKey = `exp-recorder-mjpeg:${endpoint.ipAddress}:${endpoint.videoPort}`;
    const streamReleased = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    void navigator.locks.request(lockKey, { mode: "exclusive" }, async (lock) => {
      if (!active || !lock) return;
      setStreamLockUnavailable(false);
      setStreamOwnerUrl(streamUrl);
      await streamReleased;
    }).catch(() => {
      if (active) setStreamLockUnavailable(true);
    });

    return () => {
      active = false;
      releaseStream?.();
    };
  }, [endpoint, streamUrl]);
  useEffect(() => {
    if (!streamStatsUrl || !ownsStream) return;
    let active = true;
    let timer: number | undefined;
    previousStreamStats.current = null;

    const pollStats = async () => {
      try {
        const response = await fetch(streamStatsUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Stream stats request failed (${response.status})`);
        const stats = (await response.json()) as StreamStats;
        if (
          typeof stats.active !== "boolean" ||
          !Number.isSafeInteger(stats.stream_id) ||
          !Number.isSafeInteger(stats.frames_sent) ||
          stats.stream_id < 0 ||
          stats.frames_sent < 0
        ) throw new Error("Invalid stream stats response");
        if (!active) return;

        const timestamp = performance.now();
        const previous = previousStreamStats.current;
        let fps: number | null = null;
        if (!stats.active) {
          fps = 0;
        } else if (
          previous &&
          previous.streamId === stats.stream_id &&
          stats.frames_sent >= previous.framesSent
        ) {
          const elapsedSeconds = (timestamp - previous.timestamp) / 1000;
          if (elapsedSeconds > 0) {
            fps = Math.round((stats.frames_sent - previous.framesSent) / elapsedSeconds);
          }
        }
        previousStreamStats.current = {
          streamId: stats.stream_id,
          framesSent: stats.frames_sent,
          timestamp,
        };
        setFrameRate({ url: streamStatsUrl, value: fps });
      } catch {
        if (active) setFrameRate({ url: streamStatsUrl, value: null });
      } finally {
        if (active) timer = window.setTimeout(() => void pollStats(), 1000);
      }
    };

    void pollStats();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      previousStreamStats.current = null;
    };
  }, [ownsStream, streamStatsUrl]);
  const bounds = controllerConfig ?? {
    minDurationMs: 1,
    maxDurationMs: 4294967295,
    minFrequency: 1,
    maxFrequency: 500,
  };
  const invalidChannelIds = new Set(
    channels
      .filter((channel) => {
        const settings = channelOverrideValue(channel, channelOverrides[channel.id]);
        const frequency = Number(settings.frequencyHz);
        const duration = Number(settings.durationMs);
        return (
          !channel.channel_name.trim() ||
          settings.pin1 === settings.pin2 ||
          !Number.isFinite(frequency) ||
          frequency < bounds.minFrequency ||
          frequency > bounds.maxFrequency ||
          !Number.isFinite(duration) ||
          !Number.isInteger(duration) ||
          duration < bounds.minDurationMs ||
          duration > bounds.maxDurationMs
        );
      })
      .map((channel) => channel.id),
  );
  return (
    <section
      className="relative h-dvh min-h-[640px] overflow-hidden bg-zinc-950 text-white"
      aria-label="Live control workspace"
    >
      <div className="absolute inset-0 bg-zinc-950">
        {streamUrl && ownsStream && !streamFailed ? (
          <img
            src={streamUrl}
            alt="Live board camera feed"
            className="size-full object-contain"
            onError={() => setStreamFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(145deg,#27272a_0%,#09090b_58%,#18181b_100%)] text-center text-zinc-500">
            <div>
              <p className="mt-3 text-sm tracking-[.2em]">
                {streamUrl && streamLockUnavailable
                  ? "EXCLUSIVE STREAM LOCK UNAVAILABLE"
                  : streamUrl && !ownsStream
                    ? "WAITING FOR VIDEO STREAM SLOT"
                    : connectionState === "discovering"
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
        <span className="font-mono text-sm" title="The firmware does not currently provide a battery endpoint">
          --%
        </span>
        <span className="font-mono text-sm tabular-nums" title="Estimated from browser image load events; some browsers do not report every MJPEG frame" aria-label={streamFps === null ? "Received frame rate unavailable" : `${streamFps} received frames per second`}>
          Received FPS: {streamFps ?? "--"}
        </span>
      </div>
      <Crosshair />
      {activeBehaviorId !== null && (
        <div className="absolute left-1/2 top-[60%] z-10 -translate-x-1/2 rounded-full border border-white/30 bg-zinc-950/75 px-4 py-2 text-xs font-medium text-white backdrop-blur-md">
          Active: {behaviors.find((behavior) => behavior.id === activeBehaviorId)?.name ?? "Behavior"}
        </div>
      )}
      {photoCapturing && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-950/80 px-4 py-2 text-xs text-amber-200 backdrop-blur-md">
          Capturing at maximum resolution. The video may pause briefly…
        </div>
      )}
      {photoError && !photoCapturing && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full border border-red-500/40 bg-red-950/80 px-4 py-2 text-xs text-red-200 backdrop-blur-md">
          {photoError}
        </div>
      )}
      {quickActionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/25 bg-zinc-950/85 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md"
        >
          {quickActionNotice}
        </div>
      )}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2 sm:bottom-7 sm:left-7">
        <button
          type="button"
          className={hudButtonClass(settingsOpen)}
          aria-label="Settings"
          title="Settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Cog6ToothIcon className="size-6" />
        </button>
        <button
          type="button"
          disabled={!endpoint || connectionState === "discovering" || connectingMac !== null}
          className={`${hudButtonClass()} disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Refresh board connection"
          title="Refresh · Reconnect current board"
          onClick={() => {
            if (endpoint) void connectToBoard(endpoint);
          }}
        >
          <ArrowPathIcon className={`size-6 ${connectingMac === endpoint?.mac ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          disabled={connectionState === "discovering" || connectingMac !== null}
          className={`${hudButtonClass()} disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Switch board"
          title="Switch · Select another board"
          onClick={() => void discover()}
        >
          <CpuChipIcon className="size-6" />
        </button>
        <button
          type="button"
          className={hudButtonClass()}
          aria-label="Switch control mode"
          title={`Mode · ${controlMethodLabel(controlMethod)}`}
          onClick={cycleControlMethod}
        >
          <AdjustmentsHorizontalIcon className="size-6" />
        </button>
        <button
          type="button"
          disabled={speciesRecords.length < 2}
          className={`${hudButtonClass()} disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Switch species protocol"
          title={`Protocol · ${speciesRecords.find((species) => species.species_id === controlSpeciesId)?.code ?? "No Species"}`}
          onClick={cycleSpecies}
        >
          <BugAntIcon className="size-6" />
        </button>
        <button
          type="button"
          disabled={!endpoint || photoCapturing}
          className={`${hudButtonClass(photoCapturing)} disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Capture photo"
          title="Capture a photo at the camera's maximum resolution"
          onClick={() => void takePhoto()}
        >
          <CameraIcon className="size-6" />
        </button>
      </div>
      {controlMethod === "buttons" && (
      <div className="absolute bottom-5 right-5 z-20 flex max-w-[calc(100vw-23rem)] items-center justify-end gap-2 overflow-x-auto sm:bottom-7 sm:right-7 sm:max-w-[calc(100vw-25rem)]">
        {enabledBehaviors
          .map((behavior) => {
            const meta = behaviorMeta(behavior.name);
            const channelUnavailable =
              invalidChannelIds.has(behavior.channel_id) ||
              !controlChannels.some((channel) => channel.id === behavior.channel_id);
            return (
              <button
                key={behavior.id}
                type="button"
                disabled={!endpoint || channelUnavailable}
                className={`${hudButtonClass(activeBehaviorId === behavior.id)} min-w-20 shrink-0 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40`}
                aria-label={`${meta.label}, shortcut ${shortcutLabel(shortcutForBehavior(behavior))}`}
                title={`${meta.label} · ${shortcutLabel(shortcutForBehavior(behavior))}`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pressBehavior(behavior);
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  releaseBehavior(behavior.id);
                }}
                onPointerCancel={() => releaseBehavior(behavior.id)}
                onKeyDown={(event) => {
                  if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
                  event.preventDefault();
                  pressBehavior(behavior);
                }}
                onKeyUp={(event) => {
                  if (event.key !== " " && event.key !== "Enter") return;
                  event.preventDefault();
                  releaseBehavior(behavior.id);
                }}
              >
                <span>{meta.label}</span>
              </button>
            );
          })}
      </div>
      )}

      {boardPickerOpen && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-black/75 p-5 backdrop-blur-md">
          <section
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Select a controllable board"
          >
            <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-zinc-500">Live Control</p>
                <h2 className="mt-1 text-lg font-semibold">Select a Board</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Choose a board discovered on the current LAN before opening the controller.
                </p>
              </div>
              {endpoint && (
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  aria-label="Keep current board"
                  title="Keep current board"
                  onClick={() => setBoardPickerOpen(false)}
                >
                  <XMarkIcon className="size-5" />
                </button>
              )}
            </header>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className={`text-xs ${connectionState === "error" ? "text-red-300" : "text-zinc-400"}`}>
                  {message ?? "Select a board to continue."}
                </p>
                <button
                  type="button"
                  disabled={connectionState === "discovering" || connectingMac !== null}
                  className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                  onClick={() => void discover()}
                >
                  <ArrowPathIcon className={`size-4 ${connectionState === "discovering" ? "animate-spin" : ""}`} />
                  Scan Again
                </button>
              </div>
              {availableBoards.length ? (
                <div className="grid gap-2">
                  {availableBoards.map((available) => {
                    const connecting = connectingMac === available.mac;
                    const current = endpoint?.mac === available.mac;
                    return (
                      <button
                        key={`${available.mac}-${available.ipAddress}`}
                        type="button"
                        disabled={connectingMac !== null || connectionState === "discovering"}
                        className={`grid w-full gap-3 rounded-lg border p-4 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${current ? "border-green-700 bg-green-950/30" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900"}`}
                        onClick={() => void connectToBoard(available)}
                      >
                        <span className="min-w-0">
                          <strong className="block truncate text-sm text-zinc-100">{available.model ?? "XIAO ESP32S3"}</strong>
                          <span className="mt-1 block font-mono text-xs text-zinc-400">{displayMac(available.mac)}</span>
                        </span>
                        <span className="text-left font-mono text-xs text-zinc-400 sm:text-right">
                          <span className="block text-zinc-200">{available.ipAddress}</span>
                          <span className="mt-1 block">Control {available.controlPort} · Video {available.videoPort}</span>
                          <span className="mt-1 block text-green-300">{connecting ? "Connecting…" : current ? "Connected" : "Connect"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-zinc-800 px-5 text-center text-sm text-zinc-500">
                  {connectionState === "discovering" ? "Scanning the LAN for controllable boards…" : "No controllable boards are currently available."}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {photo && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl" role="dialog" aria-modal="true" aria-label="Captured photo">
            <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
              <div><h2 className="text-sm font-semibold">Captured Photo</h2><p className="mt-1 text-xs text-zinc-400">Actual resolution: {photo.resolution ?? "Not provided"}</p></div>
              <div className="flex items-center gap-2"><a className="inline-flex min-h-9 items-center rounded-lg bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-200" href={photo.url} download={`camera-${photo.resolution ?? "capture"}.jpg`}>Download Photo</a><button type="button" className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Close photo" onClick={() => setPhoto(null)}><XMarkIcon className="size-5" /></button></div>
            </header>
            <div className="grid max-h-[75vh] place-items-center overflow-auto bg-black p-3"><img src={photo.url} alt={`Camera photo ${photo.resolution ?? ""}`} className="max-h-[70vh] max-w-full object-contain" /></div>
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
            <h2 className="mt-1 text-xl font-semibold">Settings</h2>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <XMarkIcon className="size-6" />
          </button>
        </header>
        <section>
          <h3>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b border-zinc-800 pb-3 text-left"
            aria-expanded={expandedSettingsSection === "connection"}
            aria-controls="settings-connection"
            onClick={() =>
              setExpandedSettingsSection((current) =>
                current === "connection" ? null : "connection",
              )
            }
          >
            <span className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
              Connection
            </span>
            <ChevronDownIcon
              className={`size-4 text-zinc-400 transition-transform ${expandedSettingsSection === "connection" ? "rotate-180" : ""}`}
            />
          </button>
          </h3>
          {expandedSettingsSection === "connection" && (
            <div id="settings-connection" className="mt-4">
          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Hardware name</dt>
              <dd className="text-right">
                {endpoint?.model ?? (endpoint ? "XIAO" : "Not connected")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">MAC address</dt>
              <dd className="font-mono text-right">
                {endpoint ? displayMac(endpoint.mac) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">IP</dt>
              <dd>{endpoint?.ipAddress ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Network mode</dt>
              <dd>{controllerConfig?.networkMode ?? "—"}</dd>
            </div>
          </dl>
            <button
              type="button"
              disabled={connectionState === "discovering"}
              className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void discover()}
            >
              <ArrowPathIcon
                className={`size-4 ${connectionState === "discovering" ? "animate-spin" : ""}`}
              />
              Switch Board
            </button>
            <div className="mt-5 border-t border-zinc-800 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[.1em] text-zinc-200">
                    Board Wi-Fi
                  </h4>
                  <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                    Configure the network directly on the connected board.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!endpoint || wifiScanning || wifiPolling}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void scanWifiNetworks()}
                >
                  <ArrowPathIcon className={`size-3.5 ${wifiScanning ? "animate-spin" : ""}`} />
                  Scan
                </button>
              </div>

              {wifiSettings && (
                <dl className="mt-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Connection state</dt>
                    <dd className={wifiSettings.connectionState === "connected" ? "text-green-300" : wifiSettings.connectionState === "failed" ? "text-red-300" : "text-amber-300"}>
                      {wifiSettings.connectionState}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Access point</dt>
                    <dd className="text-right text-zinc-300">
                      {wifiSettings.accessPoint?.active
                        ? `${wifiSettings.accessPoint.ssid} · ${wifiSettings.accessPoint.ip}`
                        : "Inactive"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Station</dt>
                    <dd className="text-right text-zinc-300">
                      {wifiSettings.station?.connected
                        ? `${wifiSettings.station.ssid} · ${wifiSettings.station.ip}`
                        : "Not connected"}
                    </dd>
                  </div>
                </dl>
              )}

              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveWifiSettings();
                }}
              >
                <label className="grid gap-1 text-[11px] text-zinc-400">
                  <span>Wi-Fi name (SSID)</span>
                  <input
                    required
                    list="live-control-wifi-networks"
                    className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                    value={wifiSsid}
                    onChange={(event) => setWifiSsid(event.target.value)}
                    placeholder="Select or enter a network"
                    autoComplete="off"
                  />
                  <datalist id="live-control-wifi-networks">
                    {wifiNetworks.map((network) => (
                      <option key={network.ssid} value={network.ssid}>
                        {network.rssi === null ? network.ssid : `${network.rssi} dBm`}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-1 text-[11px] text-zinc-400">
                  <span>Password</span>
                  <input
                    type="password"
                    className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                    value={wifiPassword}
                    onChange={(event) => setWifiPassword(event.target.value)}
                    placeholder="Leave empty for an open network"
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!endpoint || !wifiSsid.trim() || wifiSaving || wifiPolling}
                  className="flex min-h-10 w-full items-center justify-center rounded-lg bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {wifiSaving
                    ? "Sending…"
                    : wifiPolling
                      ? "Connecting…"
                      : "Connect Board to Wi-Fi"}
                </button>
              </form>

              {wifiMessage && (
                <p
                  role="status"
                  className={`mt-3 text-[11px] leading-5 ${wifiError ? "text-red-300" : wifiPolling ? "text-amber-300" : "text-zinc-400"}`}
                >
                  {wifiMessage}
                </p>
              )}

              {usingBoardAccessPoint && (
                <div className="mt-5 border-t border-zinc-800 pt-5">
                  <h5 className="text-xs font-semibold uppercase tracking-[.1em] text-zinc-200">
                    Hotspot Settings
                  </h5>
                  <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                    ESP32-S3 hotspots use 2.4 GHz. Changing the channel restarts the hotspot and may disconnect this device.
                  </p>

                  {accessPointSettings ? (
                    <>
                      <dl className="mt-3 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-[11px]">
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500">Supported band</dt>
                          <dd className="text-zinc-300">
                            {accessPointSettings.supportedBands.join(", ") || accessPointSettings.band}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500">Saved channel</dt>
                          <dd className="font-mono text-zinc-300">
                            {accessPointSettings.channel}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500">Actual channel</dt>
                          <dd className="font-mono text-zinc-300">
                            {accessPointSettings.actualChannel}
                          </dd>
                        </div>
                      </dl>

                      {accessPointSettings.stationOverridesChannel && (
                        <p className="mt-3 rounded-lg border border-amber-900/70 bg-amber-950/30 p-3 text-[11px] leading-5 text-amber-200">
                          Station mode is active. The external router controls the actual shared Wi-Fi channel; this setting takes effect when the hotspot runs independently.
                        </p>
                      )}

                      <form
                        className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveAccessPointSettings();
                        }}
                      >
                        <label className="grid gap-1 text-[11px] text-zinc-400">
                          <span>Hotspot channel</span>
                          <select
                            className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                            value={accessPointChannel}
                            onChange={(event) => setAccessPointChannel(event.target.value)}
                          >
                            {Array.from(
                              {
                                length:
                                  accessPointSettings.maxChannel -
                                  accessPointSettings.minChannel +
                                  1,
                              },
                              (_, index) => accessPointSettings.minChannel + index,
                            ).map((channel) => (
                              <option key={channel} value={channel}>
                                Channel {channel}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          disabled={accessPointSaving}
                          className="mt-[19px] min-h-10 rounded-lg border border-zinc-600 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {accessPointSaving ? "Saving…" : "Apply"}
                        </button>
                      </form>
                    </>
                  ) : (
                    <p className="mt-3 text-[11px] text-zinc-500">
                      {accessPointError
                        ? "Hotspot settings are unavailable."
                        : "Loading hotspot settings…"}
                    </p>
                  )}

                  {accessPointMessage && (
                    <p
                      role="status"
                      className={`mt-3 text-[11px] leading-5 ${accessPointError ? "text-red-300" : "text-amber-300"}`}
                    >
                      {accessPointMessage}
                    </p>
                  )}
                </div>
              )}

              {wifiSettings?.station?.connected &&
                wifiSettings.station.ip &&
                wifiSettings.station.ip !== endpoint?.ipAddress && (
                  <button
                    type="button"
                    className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg border border-green-800 bg-green-950/40 px-3 text-xs font-medium text-green-200 hover:bg-green-900/50"
                    onClick={() => {
                      if (!endpoint || !wifiSettings.station) return;
                      void connectToBoard({
                        ...endpoint,
                        ipAddress: wifiSettings.station.ip,
                      });
                    }}
                  >
                    Use Station IP · {wifiSettings.station.ip}
                  </button>
                )}
            </div>
            </div>
          )}
        </section>
        <section className="mt-8">
          <h3>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b border-zinc-800 pb-3 text-left"
            aria-expanded={expandedSettingsSection === "channels"}
            aria-controls="settings-channels"
            onClick={() =>
              setExpandedSettingsSection((current) =>
                current === "channels" ? null : "channels",
              )
            }
          >
            <span className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
              Channel Settings
            </span>
            <ChevronDownIcon
              className={`size-4 text-zinc-400 transition-transform ${expandedSettingsSection === "channels" ? "rotate-180" : ""}`}
            />
          </button>
          </h3>
          {expandedSettingsSection === "channels" && (
            <div id="settings-channels" className="mt-4 grid gap-3">
              <p className="text-xs leading-5 text-zinc-500">
                These overrides apply only to this Live Control session and do not change saved Channel records.
              </p>
              {controlChannels.length > 0 && (
                <div className="grid gap-2">
                  {controlChannels.map((channel) => {
                    const settings = channelOverrideValue(channel, channelOverrides[channel.id]);
                    const modified = channelOverrides[channel.id] !== undefined;
                    const invalid = invalidChannelIds.has(channel.id);
                    const fieldClass = `h-8 w-full min-w-0 rounded-md border bg-white px-1.5 text-xs text-zinc-950 outline-none focus:ring-2 ${invalid ? "border-red-400 focus:ring-red-400/40" : "border-zinc-300 focus:ring-sky-400/40"}`;
                    return (
                      <article key={channel.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-zinc-100"
                            title={`#${channel.id} · ${channel.channel_name}`}
                          >
                            {modified && <span className="size-1.5 shrink-0 rounded-full bg-amber-400" aria-label="Temporary override" />}
                            <span className="truncate">{channel.channel_name}</span>
                          </span>
                          <button
                            type="button"
                            disabled={!modified}
                            aria-label={`Reset ${channel.channel_name}`}
                            title={modified ? "Reset temporary changes" : "No temporary changes"}
                            className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-20"
                            onClick={() => resetChannelOverride(channel.id)}
                          >
                            <ArrowPathIcon className="size-4" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          <label className="grid min-w-0 gap-1 text-[10px] text-zinc-500">
                            <span>Pin 1</span>
                            <select
                              aria-label={`${channel.channel_name} Pin 1`}
                              className={fieldClass}
                              value={settings.pin1}
                              onChange={(event) =>
                                updateChannelOverride(channel, { pin1: Number(event.target.value) })
                              }
                            >
                              {channelPinOptions.map((pin) => (
                                <option key={pin} value={pin}>D{pin}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] text-zinc-500">
                            <span>Pin 2</span>
                            <select
                              aria-label={`${channel.channel_name} Pin 2`}
                              className={fieldClass}
                              value={settings.pin2}
                              onChange={(event) =>
                                updateChannelOverride(channel, { pin2: Number(event.target.value) })
                              }
                            >
                              {channelPinOptions.map((pin) => (
                                <option key={pin} value={pin}>D{pin}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] text-zinc-500">
                            <span>Frequency</span>
                            <input
                              aria-label={`${channel.channel_name} frequency in hertz`}
                              className={fieldClass}
                              type="number"
                              inputMode="decimal"
                              min={bounds.minFrequency}
                              max={bounds.maxFrequency}
                              step="any"
                              value={settings.frequencyHz}
                              onChange={(event) =>
                                updateChannelOverride(channel, { frequencyHz: event.target.value })
                              }
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] text-zinc-500">
                            <span>Max Duration</span>
                            <input
                              aria-label={`${channel.channel_name} maximum duration in milliseconds`}
                              className={fieldClass}
                              type="number"
                              inputMode="numeric"
                              min={bounds.minDurationMs}
                              max={bounds.maxDurationMs}
                              step="1"
                              value={settings.durationMs}
                              onChange={(event) =>
                                updateChannelOverride(channel, { durationMs: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        {invalid && (
                          <p role="alert" className="mt-1.5 text-[11px] leading-4 text-red-300">
                            Pins must differ; use {bounds.minFrequency}–{bounds.maxFrequency} Hz and {bounds.minDurationMs}–{bounds.maxDurationMs} whole ms.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {!controlChannels.length && (
                <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                  No Channels are registered for the selected Species.
                </p>
              )}
            </div>
          )}
        </section>
        <section className="mt-8">
          <h3>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b border-zinc-800 pb-3 text-left"
            aria-expanded={expandedSettingsSection === "control"}
            aria-controls="settings-control"
            onClick={() =>
              setExpandedSettingsSection((current) =>
                current === "control" ? null : "control",
              )
            }
          >
            <span className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
              Control Settings
            </span>
            <ChevronDownIcon
              className={`size-4 text-zinc-400 transition-transform ${expandedSettingsSection === "control" ? "rotate-180" : ""}`}
            />
          </button>
          </h3>
          {expandedSettingsSection === "control" && (
            <div id="settings-control" className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-xs text-zinc-300">
                <span>Species</span>
                <Select
                  value={controlSpeciesId ?? ""}
                  onChange={(event) => {
                    sendStop();
                    setListeningBehaviorId(null);
                    setControlSettingsMessage(null);
                    setSelectedSpeciesId(event.target.value ? Number(event.target.value) : null);
                  }}
                >
                  {!speciesRecords.length && <option value="">No species registered</option>}
                  {speciesRecords.map((species) => (
                    <option key={species.species_id} value={species.species_id}>
                      {species.code} · {species.scientific_name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-300">
                <span>Control Method</span>
                <Select
                  value={controlMethod}
                  onChange={(event) => {
                    sendStop();
                    setListeningBehaviorId(null);
                    setControlSettingsMessage(null);
                    setControlMethod(event.target.value as ControlMethod);
                    event.currentTarget.blur();
                  }}
                >
                  <option value="buttons">On-screen Buttons</option>
                  <option value="keyboard">Keyboard</option>
                  <option value="gamepad">USB Gamepad</option>
                </Select>
              </label>
              {controlMethod === "gamepad" && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
                  <p className={gamepadName ? "text-green-300" : "text-amber-300"}>
                    {gamepadSupported === false
                      ? "This browser does not support the Gamepad API."
                      : gamepadName
                        ? `Connected: ${gamepadName}`
                        : "Waiting for a gamepad. Press a button on the controller to activate it."}
                  </p>
                  <p className="mt-2 leading-5 text-zinc-500">
                    Assign gamepad inputs to Behaviors under Shortcut Control below.
                  </p>
                </div>
              )}
              <button
                type="button"
                disabled={controlSpeciesId === null}
                className="flex min-h-10 w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={rememberControlSettings}
              >
                Remember Current Settings
              </button>
              {controlSettingsMessage && (
                <p
                  role="status"
                  className={`text-xs leading-5 ${controlSettingsMessage.tone === "success" ? "text-green-300" : "text-red-300"}`}
                >
                  {controlSettingsMessage.text}
                </p>
              )}
              <p className="text-xs leading-5 text-zinc-500">
                The selected Species determines which enabled Behaviors and Channels are available.
              </p>
            </div>
          )}
        </section>
        <section className="mt-8">
          <h3>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b border-zinc-800 pb-3 text-left"
            aria-expanded={expandedSettingsSection === "camera"}
            aria-controls="settings-camera"
            onClick={() =>
              setExpandedSettingsSection((current) =>
                current === "camera" ? null : "camera",
              )
            }
          >
            <span className="flex items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
                Camera Settings
              </span>
              {cameraSaving && (
                <span className="text-xs text-amber-300">Saving…</span>
              )}
            </span>
            <ChevronDownIcon
              className={`size-4 text-zinc-400 transition-transform ${expandedSettingsSection === "camera" ? "rotate-180" : ""}`}
            />
          </button>
          </h3>
          {expandedSettingsSection === "camera" && (
            <div id="settings-camera">
            {!cameraSettings ? (
            <p
              className={`mt-3 text-xs leading-5 ${cameraError ? "text-red-300" : "text-zinc-500"}`}
            >
              {cameraMessage ?? "Connect to a board to load camera settings."}
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
                <label className="grid min-w-0 gap-1.5 text-sm text-zinc-200">
                  <span>Resolution</span>
                  <Select
                    disabled={cameraSaving}
                    value={cameraSettings.resolution}
                    onChange={(event) => {
                      const resolution = event.target.value;
                      const maximumFps =
                        cameraSettings.maxFpsByResolution[resolution] ??
                        cameraSettings.limits.fps[1];
                      const fps = Math.min(cameraSettings.fps, maximumFps);
                      setCameraSettings((current) =>
                        current ? { ...current, resolution, fps } : current,
                      );
                      void saveCameraSettings({ resolution, fps });
                    }}
                  >
                    {cameraSettings.supportedResolutions.map((resolution) => (
                      <option key={resolution} value={resolution}>
                        {resolution.replace("x", " × ")}
                      </option>
                    ))}
                  </Select>
                </label>
                {(
                  [
                    ["hmirror", "H-Mirror"],
                    ["vflip", "V-Flip"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex h-11 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 text-xs text-zinc-200"
                  >
                    <span>{label}</span>
                    <input
                      className="size-4 shrink-0 accent-zinc-100 disabled:opacity-50"
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
              <CameraRange
                label="Target FPS"
                value={cameraSettings.fps}
                limits={[
                  cameraSettings.limits.fps[0],
                  cameraSettings.maxFpsByResolution[
                    cameraSettings.resolution
                  ] ?? cameraSettings.limits.fps[1],
                ]}
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
              {cameraMessage && (
                <p
                  className={`text-xs ${cameraError ? "text-red-300" : "text-green-300"}`}
                >
                  {cameraMessage}
                </p>
              )}
            </div>
            )}
            </div>
          )}
        </section>
        <section className="mt-8">
          <h3>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b border-zinc-800 pb-3 text-left"
            aria-expanded={expandedSettingsSection === "shortcuts"}
            aria-controls="settings-shortcuts"
            onClick={() =>
              setExpandedSettingsSection((current) =>
                current === "shortcuts" ? null : "shortcuts",
              )
            }
          >
            <span className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-100">
              Shortcut Control
            </span>
            <ChevronDownIcon
              className={`size-4 text-zinc-400 transition-transform ${expandedSettingsSection === "shortcuts" ? "rotate-180" : ""}`}
            />
          </button>
          </h3>
          {expandedSettingsSection === "shortcuts" && (
          <div id="settings-shortcuts">
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Click a binding button, then press a keyboard key, gamepad button, D-pad direction, or move the left stick. Changes reset when this page reloads.
          </p>
          {shortcutCaptureError && (
            <p className="mt-3 rounded-lg border border-red-900/70 bg-red-950/40 p-3 text-xs text-red-300">
              {shortcutCaptureError}
            </p>
          )}
          <div className="mt-4 grid gap-4">
            {enabledBehaviors.map((behavior) => (
                <article
                  key={behavior.id}
                  className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{behavior.name}</strong>
                      <p className="mt-1 truncate text-[11px] text-zinc-500">{behavior.channel_name}</p>
                    </div>
                    <button
                      type="button"
                      className={`min-h-10 w-44 shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${listeningBehaviorId === behavior.id ? "border-amber-400 bg-amber-950/60 text-amber-200" : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"}`}
                      aria-label={`Change ${behavior.name} shortcut`}
                      onClick={() => {
                        sendStop();
                        setShortcutCaptureError(null);
                        setListeningBehaviorId((current) => current === behavior.id ? null : behavior.id);
                      }}
                    >
                      {listeningBehaviorId === behavior.id
                        ? "Press key or button…"
                        : shortcutLabel(shortcutForBehavior(behavior))}
                    </button>
                  </div>
                </article>
              ))}
            {!enabledBehaviors.length && <p className="text-xs text-zinc-500">No enabled Behaviors are registered for this Species.</p>}
          </div>
          {enabledBehaviors.some((behavior) => shortcutOverrides[behavior.id] !== undefined) && (
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
              onClick={() => {
                sendStop();
                setListeningBehaviorId(null);
                setShortcutCaptureError(null);
                setShortcutOverrides((current) => {
                  const next = { ...current };
                  enabledBehaviors.forEach((behavior) => delete next[behavior.id]);
                  return next;
                });
              }}
            >
              Reset to Default Shortcuts
            </button>
          )}
          </div>
          )}
        </section>
      </aside>
    </section>
  );
}
