/**
 * Macro → next-session YES price blend (demo).
 * Uses a signed probability margin (2p−1) per market, weighted, then scales to a
 * bounded move on the desk’s traded YES contract.
 */

export type MacroMarketDef = {
  id: string;
  question: string;
  tokenId: string;
  mockYes: number;
  weight: number;
  direction: 1 | -1;
  hint?: string;
};

export type MacroMarketResolved = MacroMarketDef & {
  yesPrice: number;
  source: "live" | "mock";
  signal: number;
  contribution: number;
};

export type BlendConfig = {
  maxDeltaYes: number;
  description?: string;
};

export function compositeScore(
  markets: Array<{
    yesPrice: number;
    weight: number;
    direction: 1 | -1;
  }>
): number {
  let z = 0;
  for (const m of markets) {
    const p = Math.min(1, Math.max(0, m.yesPrice));
    const margin = 2 * p - 1;
    z += m.weight * m.direction * margin;
  }
  return z;
}

export function predictNextYesPrice(
  baseYes: number,
  composite: number,
  maxDeltaYes: number
): number {
  const delta = composite * maxDeltaYes;
  return Math.min(0.98, Math.max(0.02, baseYes + delta));
}

export function resolveMarkets(
  defs: MacroMarketDef[],
  prices: Map<string, number | null>
): MacroMarketResolved[] {
  const out: MacroMarketResolved[] = [];
  for (const d of defs) {
    const live = d.tokenId ? prices.get(d.tokenId) : null;
    const yesPrice =
      live != null && !Number.isNaN(live)
        ? Math.min(1, Math.max(0, live))
        : Math.min(1, Math.max(0, d.mockYes));
    const source: "live" | "mock" = live != null ? "live" : "mock";
    const margin = 2 * yesPrice - 1;
    const contribution = d.weight * d.direction * margin;
    out.push({
      ...d,
      yesPrice,
      source,
      signal: margin,
      contribution,
    });
  }
  return out;
}
