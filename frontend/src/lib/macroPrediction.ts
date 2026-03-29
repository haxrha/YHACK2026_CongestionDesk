/**
 * Macro → next-session YES price blend.
 * Weighted combination of market YES probabilities, scaled to a bounded move
 * on the desk’s traded YES contract.
 */

export type MacroMarketDef = {
  id: string;
  question: string;
  tokenId: string;
  /** Default YES when CLOB midpoint is unavailable */
  defaultYes: number;
  weight: number;
  direction: 1 | -1;
  hint?: string;
};

export type MacroMarketResolved = MacroMarketDef & {
  yesPrice: number;
  source: "live" | "estimated";
  signal: number;
  contribution: number;
};

export type BlendConfig = {
  maxDeltaYes: number;
  description?: string;
};

function defaultYesFromDef(d: MacroMarketDef & Record<string, unknown>): number {
  if (typeof d.defaultYes === "number" && !Number.isNaN(d.defaultYes)) {
    return d.defaultYes;
  }
  return 0.5;
}

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
  defs: Array<MacroMarketDef & Record<string, unknown>>,
  prices: Map<string, number | null>
): MacroMarketResolved[] {
  const out: MacroMarketResolved[] = [];
  for (const raw of defs) {
    const d = { ...raw, defaultYes: defaultYesFromDef(raw) };
    const live = d.tokenId ? prices.get(d.tokenId) : null;
    const yesPrice =
      live != null && !Number.isNaN(live)
        ? Math.min(1, Math.max(0, live))
        : Math.min(1, Math.max(0, d.defaultYes));
    const source: "live" | "estimated" = live != null ? "live" : "estimated";
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
