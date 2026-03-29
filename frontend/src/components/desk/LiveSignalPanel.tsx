"use client";

import { useEffect, useMemo, useState } from "react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";

export type LiveSignalRow = {
  timestampUtc: string;
  tokenId: string;
  market: string;
  expires: string;
  price: number | null;
  agg_dwell: number;
  agg_density: number;
  agg_throughput: number;
  agg_sog: number;
  multi_port: number;
  composite_score: number;
  signal: "BULLISH" | "NEUTRAL";
  implied_edge_per_share: number | null;
};

const R = 52;
const C = 2 * Math.PI * R;

function barTone(v: number): string {
  if (v >= 0.5) return "bg-orange-400";
  if (v >= 0.25) return "bg-sky-400";
  return "bg-white/20";
}

function formatAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h === 1) return "1 hr ago";
  return `${h} hr ago`;
}

export function LiveSignalPanel() {
  const [row, setRow] = useState<LiveSignalRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/live/signals", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setRow(null);
        setErr(data.error ?? "Request failed");
        return;
      }
      setErr(null);
      setRow(data.row ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setRow(null);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const bullish = row?.signal === "BULLISH";
  const stroke = bullish ? "#4ade80" : "rgba(161,161,170,0.5)";
  const score = Math.min(1, Math.max(0, row?.composite_score ?? 0));
  const dash = C * (1 - score);

  const metrics = useMemo(
    () =>
      row
        ? [
            { key: "dwell", label: "Dwell", value: row.agg_dwell },
            { key: "density", label: "Density", value: row.agg_density },
            {
              key: "throughput",
              label: "Throughput",
              value: row.agg_throughput,
            },
            { key: "sog", label: "SOG", value: row.agg_sog },
            { key: "multi", label: "Multi-port", value: row.multi_port },
          ]
        : [],
    [row]
  );

  return (
    <SpotlightCard contentClassName="p-6 md:p-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
        Live trading
      </p>
      {err && (
        <p className="mt-4 text-sm text-red-400/90">{err}</p>
      )}
      {!err && !row && (
        <p className="mt-4 text-sm text-foreground-muted">
          No rows in{" "}
          <code className="font-mono text-foreground-subtle">
            live_signals.csv
          </code>{" "}
          yet. Run{" "}
          <code className="font-mono text-foreground-subtle">
            live_tradingexecution.py
          </code>{" "}
          against your token.
        </p>
      )}

      {row && (
        <>
          {/* Top: ring + market + price */}
          <div className="mt-6 flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
            <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: 128, height: 128 }}>
              <svg width={128} height={128} className="-rotate-90">
                <circle
                  cx={64}
                  cy={64}
                  r={R}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={8}
                />
                <circle
                  cx={64}
                  cy={64}
                  r={R}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={dash}
                  className="transition-[stroke-dashoffset,stroke] duration-500 ease-expo"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums tracking-tight",
                    bullish ? "text-emerald-400" : "text-zinc-400"
                  )}
                >
                  {score.toFixed(2)}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                  score
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    bullish
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-zinc-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      bullish ? "animate-pulse bg-emerald-400" : "bg-zinc-500"
                    )}
                  />
                  {row.signal}
                </span>
              </div>
              <p className="line-clamp-3 text-sm leading-snug text-foreground-muted">
                {row.market || "—"}
              </p>
              <p
                className={cn(
                  "text-4xl font-semibold tabular-nums tracking-tight",
                  bullish ? "text-foreground" : "text-zinc-400"
                )}
              >
                {row.price != null
                  ? `${(row.price * 100).toFixed(1)}¢`
                  : "—"}
                <span className="ml-2 text-sm font-normal text-foreground-muted">
                  YES
                </span>
              </p>
              <p className="font-mono text-xs text-foreground-subtle">
                updated {formatAgo(row.timestampUtc)}
              </p>
            </div>
          </div>

          {/* Metric cards */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {metrics.map((m) => (
              <div
                key={m.key}
                className="rounded-xl border border-white/[0.06] bg-background-elevated/60 px-3 py-3"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                  {m.label}
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-sm tabular-nums",
                    bullish ? "text-foreground" : "text-zinc-500"
                  )}
                >
                  {m.value.toFixed(3)}
                </p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn("h-full rounded-full transition-all", barTone(m.value))}
                    style={{ width: `${Math.min(100, m.value * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom strip */}
          <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.06] pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs text-foreground-muted">
              Last signal run (UTC):{" "}
              <span className="text-foreground-subtle">
                {row.timestampUtc
                  ? new Date(row.timestampUtc).toISOString().replace("T", " ").slice(0, 19)
                  : "—"}
              </span>
            </p>
            <div className="text-right">
              {bullish && row.implied_edge_per_share != null ? (
                <p className="font-medium text-emerald-400">
                  implied edge if YES: +
                  {row.implied_edge_per_share.toFixed(3)}/share
                </p>
              ) : (
                <p className="text-foreground-muted">
                  no trade — below threshold
                </p>
              )}
            </div>
          </div>

        </>
      )}
    </SpotlightCard>
  );
}
