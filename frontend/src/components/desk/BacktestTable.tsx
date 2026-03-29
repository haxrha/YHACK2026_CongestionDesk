"use client";

import { useMemo, useState } from "react";
import type { BacktestRow } from "@/lib/backtest";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";

type Props = {
  rows: BacktestRow[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

type SortKey = keyof BacktestRow;

export function BacktestTable({ rows, selectedDate, onSelectDate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const mul = sortDir === "asc" ? 1 : -1;
      if (typeof va === "boolean" && typeof vb === "boolean") {
        return (Number(va) - Number(vb)) * mul;
      }
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
    { key: "dwell", label: "Dwell" },
    { key: "density", label: "Density" },
    { key: "throughput", label: "Throughput" },
    { key: "sog", label: "SOG" },
    { key: "multi_port", label: "Multi" },
    { key: "score", label: "Score" },
    { key: "signal", label: "Signal" },
    { key: "price_today", label: "Px today" },
    { key: "price_tomorrow", label: "Px t+1" },
    { key: "edge", label: "Edge" },
    { key: "correct", label: "OK" },
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
          Full <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">backtest_results.csv</code>{" "}
          — click a row to sync the desk.
        </p>
      </div>
      <div className="overflow-x-auto px-4 pb-8 pt-2 md:px-6">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {headers.map((h) => (
                <th key={h.key} className="whitespace-nowrap px-2 py-3 md:px-3">
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
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs text-foreground md:px-3">
                    {r.date}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {r.dwell.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {r.density.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {r.throughput.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {r.sog.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {r.multi_port.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {r.score.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-foreground md:px-3">
                    {r.signal}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-sky-300 md:px-3">
                    {(r.price_today * 100).toFixed(0)}¢
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs tabular-nums text-foreground-muted md:px-3">
                    {(r.price_tomorrow * 100).toFixed(0)}¢
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2.5 font-mono text-xs font-medium tabular-nums md:px-3",
                      r.edge > 0 && "text-emerald-400",
                      r.edge < 0 && "text-red-400",
                      r.edge === 0 && "text-foreground-muted"
                    )}
                  >
                    {(r.edge * 100).toFixed(1)}¢
                  </td>
                  <td className="px-2 py-2.5 md:px-3">
                    {r.correct ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                        Yes
                      </span>
                    ) : (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
                        No
                      </span>
                    )}
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
