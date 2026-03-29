import { NextRequest, NextResponse } from "next/server";
import {
  allowGeminiRequest,
  geminiGenerateText,
  getClientIp,
  parseJsonLoose,
} from "@/lib/geminiServer";

const PROMPT = `You are a maritime and port analyst focused on US energy and container gateway traffic.

Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{ "insight": "..." }

Rules for "insight":
- At most 2 sentences total.
- Cover Houston (Houston Ship Channel area), New York / New Jersey harbor, and Long Beach / Los Angeles (San Pedro Bay) area — you may group NYC/NJ as one region if space is tight.
- Focus on tankers, tank barges, or bulk/oil-related vessel activity where relevant, and general port queue or throughput pressure when useful.
- Reference major recent news or widely reported trends when you can: slowdowns, speedups, anchorage waits, queues, strikes, weather disruptions, or throughput records. If you lack a verified live datapoint, say so briefly and describe typical conditions rather than inventing numbers.`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!allowGeminiRequest(ip, "port-insight")) {
    return NextResponse.json(
      { error: "Too many requests. Wait a few minutes before refreshing again." },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error: "Add GEMINI_API_KEY to your environment to enable this insight.",
        missingKey: true,
      },
      { status: 503 }
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  try {
    const result = await geminiGenerateText(apiKey, model, {
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: {
        maxOutputTokens: 220,
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const parsed = parseJsonLoose(result.text) as { insight?: unknown } | null;
    let insight = "";

    if (parsed && typeof parsed === "object" && typeof parsed.insight === "string") {
      insight = parsed.insight.trim();
    }

    if (!insight) {
      insight = result.text.trim();
    }

    if (!insight) {
      return NextResponse.json({ error: "No insight returned. Try again." }, { status: 502 });
    }

    return NextResponse.json({ insight });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
