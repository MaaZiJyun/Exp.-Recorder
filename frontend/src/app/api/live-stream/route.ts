import { isIP } from "node:net";

export const runtime = "nodejs";

function isLocalBoardAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [first, second] = address.split(".").map(Number);
  return first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 127;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get("ip") ?? "";
  const port = Number(params.get("port"));
  if (!isLocalBoardAddress(address) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return new Response("Invalid video endpoint", { status: 400 });
  }

  try {
    const upstream = await fetch(`http://${address}:${port}/stream`, {
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body || !upstream.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/x-mixed-replace")) {
      return new Response("Video stream unavailable", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "multipart/x-mixed-replace",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response("Video stream unavailable", { status: 502 });
  }
}
