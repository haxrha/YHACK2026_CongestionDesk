import { NextRequest, NextResponse } from "next/server";
import {
  allowGeminiRequest,
  geminiGenerateText,
  getClientIp,
  parseJsonLoose,
} from "@/lib/geminiServer";

const PROMPT = `You are a concise macro analyst.

Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{
  "stats": ["string", "string"],
  "summary": "string"
}

Rules:
- "stats": exactly 1 or 2 short lines. Each must include at least one concrete number: a percentage, a dollar amount (e.g. $ billions or $/bbl), a basis point move, or a volume figure. Make them relevant to energy, commodities, or shipping.
- "summary": exactly 3 sentences summarizing current global market conditions relevant to energy, shipping, and commodities. Mention at least one geopolitical factor and one economic or policy factor where relevant. Plain prose only inside the string.

Be accurate; if a precise live figure is uncertain, use a clearly labeled approximate or recent benchmark (e.g. "~3%") rather than inventing false precision.`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!allowGeminiRequest(ip, "market-summary")) {
    return NextResponse.json(
      { error: "Too many requests. Wait a few minutes before refreshing again." },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error: "Add GEMINI_API_KEY to your environment to enable this summary.",
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
        maxOutputTokens: 420,
        temperature: 0.65,
        responseMimeType: "application/json",
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const parsed = parseJsonLoose(result.text) as {
      stats?: unknown;
      summary?: unknown;
    } | null;

    let stats: string[] = [];
    let summary = "";

    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.stats)) {
        stats = parsed.stats
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 2);
      }
      if (typeof parsed.summary === "string") {
        summary = parsed.summary.trim();
      }
    }

    if (!summary) {
      summary = result.text.trim();
    }

    if (!summary) {
      return NextResponse.json({ error: "No summary returned. Try again." }, { status: 502 });
    }

    return NextResponse.json({ summary, stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
