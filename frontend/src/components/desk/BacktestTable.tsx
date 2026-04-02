"use client";

import { useMemo, useState } from "react";
import { summarizeBacktest, type BacktestRow } from "@/lib/backtest";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";

type Props = {
  rows: BacktestRow[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

type SortKey =
  | "date"
  | "signal"
  | "price_today"
  | "edge";

export function BacktestTable({ rows, selectedDate, onSelectDate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const summary = useMemo(() => summarizeBacktest(rows), [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const mul = sortDir === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * mul;
      }
      return String(va).localeCompare(String(vb)) * mul;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggle(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const headers: { key: SortKey; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "signal", label: "Signal" },
    { key: "price_today", label: "YES" },
    { key: "edge", label: "Edge" },
  ];

  return (
    <SpotlightCard contentClassName="p-0">
      <div className="border-b border-white/[0.06] px-6 py-6 md:px-8 md:py-8">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">
          Transparency
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Backtest results
        </h3>
        <p className="mt-2 text-sm text-foreground-muted">
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">
            backtest_results.csv
          </code>
          — click a row to sync the desk.
        </p>

        {summary.sessions > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-background-elevated/50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                Sessions
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {summary.sessions}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-background-elevated/50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                Mean edge
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {Math.abs(summary.meanEdge * 100).toFixed(1)}
                <span className="text-sm font-normal text-foreground-muted">
                  ¢
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-background-elevated/50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                Bullish days
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-accent-bright">
                {summary.bullishDays}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-background-elevated/50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                Overall
              </p>
              <p className="mt-1 text-sm leading-snug text-foreground-subtle">
                Edge vs next-day YES (full CSV).
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="overflow-x-auto px-4 pb-6 pt-2 md:px-6">
        <table className="w-full min-w-[440px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {headers.map((h) => (
                <th key={h.key} className="whitespace-nowrap px-2 py-2.5 md:px-3">
                  <button
                    type="button"
                    onClick={() => toggle(h.key)}
                    className="rounded-md px-1 py-0.5 text-left transition-colors duration-200 ease-expo hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {h.label}
                    {sortKey === h.key && (
                      <span className="ml-1 text-accent">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const active = r.date === selectedDate;
              return (
                <tr
                  key={r.date}
                  onClick={() => onSelectDate(r.date)}
                  className={cn(
                    "cursor-pointer border-b border-white/[0.04] transition-colors duration-200 ease-expo",
                    active
                      ? "bg-accent/10 hover:bg-accent/[0.14]"
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-foreground md:px-3">
                    {r.date}
                  </td>
                  <td className="px-2 py-2 text-xs text-foreground md:px-3">
                    {r.signal}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs tabular-nums text-sky-300 md:px-3">
                    {(r.price_today * 100).toFixed(0)}¢
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 font-mono text-xs font-medium tabular-nums md:px-3",
                      r.edge > 0 && "text-emerald-400",
                      r.edge < 0 && "text-red-400",
                      r.edge === 0 && "text-foreground-muted"
                    )}
                  >
                    {(r.edge * 100).toFixed(1)}¢
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SpotlightCard>
  );
}
