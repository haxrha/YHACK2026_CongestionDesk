"use client";

import { useMemo } from "react";
import type { BacktestRow } from "@/lib/backtest";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

type Props = {
  rows: BacktestRow[];
  selectedDate: string;
};

const W = 520;
const H = 240;
const PAD = 40;

export function SignalPriceChart({ rows, selectedDate }: Props) {
  const geo = useMemo(() => {
    if (rows.length === 0) {
      return {
        pricePath: "",
        edgePath: "",
        zeroY: H - PAD,
        selX: PAD,
      };
    }
    const prices = rows.map((r) => r.price_today);
    const edges = rows.map((r) => r.edge);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    const pp = (maxP - minP) * 0.12 || 0.05;
    minP -= pp;
    maxP += pp;
    let minE = Math.min(...edges);
    let maxE = Math.max(...edges);
    const ep = (maxE - minE) * 0.15 || 0.05;
    minE -= ep;
    maxE += ep;

    const n = rows.length;
    const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
    const yP = (v: number) =>
      PAD + ((maxP - v) / (maxP - minP || 1)) * (H - PAD * 2);
    const yE = (v: number) =>
      PAD + ((maxE - v) / (maxE - minE || 1)) * (H - PAD * 2);

    let dP = "";
    let dE = "";
    rows.forEach((r, i) => {
      const xi = x(i);
      dP += i === 0 ? `M ${xi} ${yP(r.price_today)}` : ` L ${xi} ${yP(r.price_today)}`;
      dE += i === 0 ? `M ${xi} ${yE(r.edge)}` : ` L ${xi} ${yE(r.edge)}`;
    });
    const zi = rows.findIndex((r) => r.date === selectedDate);
    const selX = zi >= 0 ? x(zi) : x(n - 1);
    const zeroY = yE(0);
    return { pricePath: dP, edgePath: dE, zeroY, selX };
  }, [rows, selectedDate]);

  const row = rows.find((r) => r.date === selectedDate);

  return (
    <SpotlightCard contentClassName="p-6 md:p-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
        Signal vs market
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        Price &amp; edge
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        Blue: Polymarket YES (today). Violet dashed: edge. Orange: selected
        session.
      </p>

      {row && (
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-background-elevated/80 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-xs text-foreground-muted">
              {row.date}
            </span>
            <span
              className={
                row.edge > 0
                  ? "text-lg font-semibold text-emerald-400"
                  : row.edge < 0
                    ? "text-lg font-semibold text-red-400"
                    : "text-lg font-semibold text-foreground-muted"
              }
            >
              {(row.edge * 100).toFixed(1)}¢ edge
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Signal {row.signal} · YES {(row.price_today * 100).toFixed(0)}¢
          </p>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.06] bg-background-deep/60 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="min-w-[320px] w-full"
          role="img"
          aria-label="Price and edge over time"
        >
          <line
            x1={PAD}
            x2={W - PAD}
            y1={geo.zeroY}
            y2={geo.zeroY}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="4 5"
          />
          <line
            x1={geo.selX}
            x2={geo.selX}
            y1={PAD}
            y2={H - PAD}
            stroke="#f97316"
            strokeWidth={1.5}
            opacity={0.85}
          />
          <path
            d={geo.pricePath}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d={geo.edgePath}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </SpotlightCard>
  );
}
