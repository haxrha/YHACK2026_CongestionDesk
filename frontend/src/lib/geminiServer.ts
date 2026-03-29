import { NextRequest } from "next/server";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const rateLog = new Map<string, number[]>();

export function getClientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Separate buckets per route so one panel doesn’t starve the other. */
export function allowGeminiRequest(ip: string, bucket: string): boolean {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const prev = (rateLog.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= MAX_REQUESTS_PER_WINDOW) return false;
  prev.push(now);
  rateLog.set(key, prev);
  return true;
}

type GenBody = {
  contents: Array<{ parts: Array<{ text: string }> }>;
  generationConfig: Record<string, unknown>;
};

export async function geminiGenerateText(
  apiKey: string,
  model: string,
  body: GenBody
): Promise<
  | { ok: true; text: string }
  | { ok: false; error: string; status: number; missingKey?: boolean }
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  if (!res.ok) {
    const msg = data.error?.message ?? res.statusText;
    return {
      ok: false,
      error: msg || "Gemini request failed.",
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
    };
  }

  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() ?? "";

  if (!text) {
    return { ok: false, error: "No text returned. Try again.", status: 502 };
  }

  return { ok: true, text };
}

export function parseJsonLoose(raw: string): unknown {
  const t = raw.trim();
  try {
    return JSON.parse(t);
  } catch {
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
