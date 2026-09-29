import { responseActions, responseDegrees } from "./constants";

export function actionLabel(value: string | null) {
  if (!value) return null;
  const action = responseActions.find((item) => item.code === value);
  return action ? `${action.code} · ${action.en}` : value;
}

export function degreeLabel(value: number | null) {
  if (value === null) return null;
  const degree = responseDegrees.find((item) => item.score === String(value));
  return degree ? `L${degree.score} ${degree.level}` : `L${value}`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      // FastAPI validation errors are arrays of objects. Interpolating those
      // directly produces the unhelpful "[object Object]" in the UI.
      const formatDetail = (detail: unknown): string => {
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
          const items = detail.map((item) => formatDetail(item)).filter(Boolean);
          return items.join("；");
        }
        if (detail && typeof detail === "object") {
          const item = detail as Record<string, unknown>;
          const location = Array.isArray(item.loc)
            ? ` (${item.loc.join(".")})`
            : "";
          if (typeof item.msg === "string") return `${item.msg}${location}`;
          try {
            return JSON.stringify(detail);
          } catch {
            return "Invalid request parameters";
          }
        }
        return "";
      };
      const detail = body && typeof body === "object" ? body.detail : body;
      message = formatDetail(detail) || message;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function numberOrNull(value: string) {
  return value.trim() === "" ? null : Number(value);
}
