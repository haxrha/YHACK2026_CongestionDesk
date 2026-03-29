import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { parseCsvLine } from "@/lib/csv";

export const dynamic = "force-dynamic";

async function readSignalsCsv(): Promise<string | null> {
  const backend = join(process.cwd(), "..", "Backend", "live_signals.csv");
  try {
    return await readFile(backend, "utf-8");
  } catch {
    try {
      return await readFile(join(process.cwd(), "public", "data", "live_signals.csv"), "utf-8");
    } catch {
      return null;
    }
  }
}

export async function GET() {
  const raw = await readSignalsCsv();
  if (!raw?.trim()) {
    return NextResponse.json({
      row: null,
      message: "Add Backend/live_signals.csv (run live_tradingexecution.py)",
    });
  }

  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ row: null }, { status: 200 });
  }

  const header = parseCsvLine(lines[0]!);
  const lastLine = lines[lines.length - 1]!;
  const cells = parseCsvLine(lastLine);
  if (cells.length < header.length) {
    return NextResponse.json(
      { error: "Could not parse last CSV row", row: null },
      { status: 500 }
    );
  }

  const row: Record<string, string> = {};
  header.forEach((h, i) => {
    row[h] = cells[i] ?? "";
  });

  const price = parseFloat(row.price ?? "");
  const composite = parseFloat(row.composite_score ?? "");
  const signal = (row.signal ?? "NEUTRAL").trim().toUpperCase();
  const bullish = signal === "BULLISH";

  let impliedEdgePerShare: number | null = null;
  if (bullish && !Number.isNaN(price)) {
    impliedEdgePerShare = Math.round((1.0 - price) * 10000) / 10000;
  }

  return NextResponse.json({
    row: {
      timestampUtc: row.timestamp ?? "",
      tokenId: row.token_id ?? "",
      market: row.market ?? "",
      expires: row.expires ?? "",
      price: Number.isNaN(price) ? null : price,
      agg_dwell: parseFloat(row.agg_dwell ?? "0"),
      agg_density: parseFloat(row.agg_density ?? "0"),
      agg_throughput: parseFloat(row.agg_throughput ?? "0"),
      agg_sog: parseFloat(row.agg_sog ?? "0"),
      multi_port: parseFloat(row.multi_port ?? "0"),
      composite_score: Number.isNaN(composite) ? 0 : composite,
      signal: bullish ? "BULLISH" : "NEUTRAL",
      implied_edge_per_share: impliedEdgePerShare,
    },
  });
}
