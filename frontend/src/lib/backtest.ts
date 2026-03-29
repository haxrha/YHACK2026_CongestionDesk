export type BacktestRow = {
  date: string;
  dwell: number;
  density: number;
  throughput: number;
  sog: number;
  multi_port: number;
  score: number;
  signal: string;
  price_today: number;
  price_tomorrow: number;
  edge: number;
  correct: boolean;
};

function parseBool(s: string): boolean {
  return s.trim().toLowerCase() === "true";
}

export function parseBacktestCsv(text: string): BacktestRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: BacktestRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const p = line.split(",");
    if (p.length < 12) continue;
    out.push({
      date: p[0]!,
      dwell: parseFloat(p[1] ?? "0"),
      density: parseFloat(p[2] ?? "0"),
      throughput: parseFloat(p[3] ?? "0"),
      sog: parseFloat(p[4] ?? "0"),
      multi_port: parseFloat(p[5] ?? "0"),
      score: parseFloat(p[6] ?? "0"),
      signal: p[7] ?? "",
      price_today: parseFloat(p[8] ?? "0"),
      price_tomorrow: parseFloat(p[9] ?? "0"),
      edge: parseFloat(p[10] ?? "0"),
      correct: parseBool(p[11] ?? "false"),
    });
  }
  return out;
}

export async function loadBacktestRows(): Promise<BacktestRow[]> {
  const res = await fetch("/data/backtest_results.csv", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load backtest_results.csv");
  return parseBacktestCsv(await res.text());
}

export type BacktestSummary = {
  sessions: number;
  hits: number;
  accuracyPct: number;
  /** Mean of `edge` column (same units as CSV). */
  meanEdge: number;
  meanScore: number;
  bullishDays: number;
};

export function summarizeBacktest(rows: BacktestRow[]): BacktestSummary {
  const sessions = rows.length;
  if (sessions === 0) {
    return {
      sessions: 0,
      hits: 0,
      accuracyPct: 0,
      meanEdge: 0,
      meanScore: 0,
      bullishDays: 0,
    };
  }
  const hits = rows.filter((r) => r.correct).length;
  const sumEdge = rows.reduce((s, r) => s + r.edge, 0);
  const sumScore = rows.reduce((s, r) => s + r.score, 0);
  const bullishDays = rows.filter(
    (r) => r.signal.trim().toUpperCase() === "BULLISH"
  ).length;
  return {
    sessions,
    hits,
    accuracyPct: (100 * hits) / sessions,
    meanEdge: sumEdge / sessions,
    meanScore: sumScore / sessions,
    bullishDays,
  };
}
