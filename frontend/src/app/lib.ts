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
    let message = `请求失败 (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail ?? message;
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
