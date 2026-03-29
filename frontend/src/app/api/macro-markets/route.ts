import { readFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  compositeScore,
  predictNextYesPrice,
  resolveMarkets,
  type MacroMarketDef,
} from "@/lib/macroPrediction";

export const dynamic = "force-dynamic";

const CLOB = "https://clob.polymarket.com";

type FileShape = {
  modelId: string;
  modelNote: string;
  blend: { maxDeltaYes: number; description?: string };
  markets: MacroMarketDef[];
};

async function loadConfig(): Promise<FileShape | null> {
  const path = join(process.cwd(), "public", "data", "macro_markets.json");
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as FileShape;
  } catch {
    return null;
  }
}

async function fetchMidpoints(
  tokenIds: string[]
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  const ids = Array.from(new Set(tokenIds.filter(Boolean)));
  if (ids.length === 0) return map;
  try {
    const body = ids.map((token_id) => ({ token_id }));
    const res = await fetch(`${CLOB}/midpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    });
    if (!res.ok) return map;
    const data = (await res.json()) as Record<string, string | number>;
    for (const id of ids) {
      const v = data[id];
      if (v === undefined || v === null) {
        map.set(id, null);
      } else {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        map.set(id, Number.isNaN(n) ? null : n);
      }
    }
  } catch {
    /* midpoint fetch failed; fall back to defaults in config */
  }
  return map;
}

export async function GET(req: NextRequest) {
  const cfg = await loadConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "macro_markets.json missing" },
      { status: 404 }
    );
  }

  const baseParam = req.nextUrl.searchParams.get("baseYes");
  const baseYes = baseParam != null ? parseFloat(baseParam) : 0.5;
  const base = Number.isNaN(baseYes) ? 0.5 : Math.min(0.98, Math.max(0.02, baseYes));

  const tokenIds = cfg.markets.map((m) => m.tokenId).filter(Boolean);
  const mids = await fetchMidpoints(tokenIds);

  const resolved = resolveMarkets(cfg.markets, mids);
  const z = compositeScore(
    resolved.map((r) => ({
      yesPrice: r.yesPrice,
      weight: r.weight,
      direction: r.direction,
    }))
  );
  const predictedNextYes = predictNextYesPrice(
    base,
    z,
    cfg.blend.maxDeltaYes
  );

  return NextResponse.json({
    modelId: cfg.modelId,
    modelNote: cfg.modelNote,
    blend: cfg.blend,
    baseYes: base,
    composite: z,
    predictedNextYes,
    deltaYes: predictedNextYes - base,
    markets: resolved.map((r) => ({
      id: r.id,
      question: r.question,
      yesPrice: r.yesPrice,
      source: r.source,
      weight: r.weight,
      direction: r.direction,
      signal: r.signal,
      contribution: r.contribution,
      hint: r.hint,
      tokenId: r.tokenId || null,
    })),
  });
}
