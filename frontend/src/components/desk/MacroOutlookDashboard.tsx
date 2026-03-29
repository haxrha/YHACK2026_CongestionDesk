"use client";

import { useEffect, useState } from "react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";

type ApiMarket = {
  id: string;
  question: string;
  yesPrice: number;
  source: "live" | "mock";
  weight: number;
  direction: 1 | -1;
  signal: number;
  contribution: number;
  hint?: string;
  tokenId: string | null;
};

type ApiPayload = {
  modelId: string;
  modelNote: string;
  blend: { maxDeltaYes: number; description?: string };
  baseYes: number;
  composite: number;
  predictedNextYes: number;
  deltaYes: number;
  markets: ApiMarket[];
};

type Props = {
  baseYes: number;
  actualNextYes: number;
  sessionDate: string;
};

export function MacroOutlookDashboard({
  baseYes,
  actualNextYes,
  sessionDate,
}: Props) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    setLoading(true);
    const q = new URLSearchParams({ baseYes: String(baseYes) });
    fetch(`/api/macro-markets?${q}`, { cache: "no-store" })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Failed");
        return j as ApiPayload;
      })
      .then((d) => {
        if (!c) {
          setData(d);
          setErr(null);
        }
      })
      .catch((e) => {
        if (!c) {
          setErr(e instanceof Error ? e.message : "Load failed");
          setData(null);
        }
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [baseYes]);

  return (
    <SpotlightCard contentClassName="p-6 md:p-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
        Macro ensemble
      </p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            Next-session YES (Polymarket proxy)
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
            Combines implied probabilities from energy, geopolitics, inflation, and
            AIS-linked Hormuz traffic into one score, then maps it to a bounded move
            on your desk contract. Coefficients are labeled as a{" "}
            <span className="text-foreground-subtle">2018-calibrated</span> demo blend
            — replace with your trained weights for production.
          </p>
        </div>
        {data && (
          <p className="max-w-xs font-mono text-[10px] leading-relaxed text-foreground-subtle lg:text-right">
            {data.modelNote}
          </p>
        )}
      </div>

      {loading && (
        <p className="mt-8 text-sm text-foreground-muted">Loading macro markets…</p>
      )}
      {err && (
        <p className="mt-8 text-sm text-red-400/90">{err}</p>
      )}

      {data && !loading && (
        <>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-background-elevated/60 p-5 lg:col-span-1">
              <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                Session (backtest row)
              </p>
              <p className="mt-1 font-mono text-sm text-foreground-subtle">
                {sessionDate}
              </p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                Model id
              </p>
              <p className="mt-1 font-mono text-xs text-accent-bright">{data.modelId}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5 lg:col-span-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-200/80">
                Predicted next-day YES
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="text-4xl font-semibold tabular-nums tracking-tight text-emerald-300">
                  {(data.predictedNextYes * 100).toFixed(1)}¢
                </span>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    data.deltaYes >= 0 ? "text-emerald-400/90" : "text-amber-300/90"
                  )}
                >
                  {data.deltaYes >= 0 ? "+" : ""}
                  {(data.deltaYes * 100).toFixed(2)}¢ vs today
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
                From composite <span className="font-mono text-foreground-subtle">{data.composite.toFixed(3)}</span>
                {" × "}
                max Δ{" "}
                <span className="font-mono text-foreground-subtle">
                  {(data.blend.maxDeltaYes * 100).toFixed(0)}¢
                </span>
                , anchored to desk YES <span className="font-mono text-foreground-subtle">{(data.baseYes * 100).toFixed(1)}¢</span>.
              </p>
              <div className="mt-4 border-t border-white/[0.08] pt-4">
                <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                  Backtest actual (next day)
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {(actualNextYes * 100).toFixed(1)}¢
                </p>
                <p className="mt-1 text-xs text-foreground-subtle">
                  Compare model output to realized next session — not used in the blend.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                  <th className="pb-3 pr-4 font-medium">Market</th>
                  <th className="pb-3 pr-4 font-medium">YES</th>
                  <th className="pb-3 pr-4 font-medium">w</th>
                  <th className="pb-3 pr-4 font-medium">s</th>
                  <th className="pb-3 font-medium">Contrib.</th>
                </tr>
              </thead>
              <tbody>
                {data.markets.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-white/[0.04] align-top text-foreground"
                  >
                    <td className="py-3 pr-4">
                      <p className="max-w-md leading-snug">{m.question}</p>
                      {m.hint && (
                        <p className="mt-1 text-xs text-foreground-subtle">{m.hint}</p>
                      )}
                      <p className="mt-1 font-mono text-[10px] text-foreground-muted">
                        {m.source === "live" ? "CLOB midpoint" : "mock (set tokenId for live)"}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums">
                      {(m.yesPrice * 100).toFixed(1)}¢
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-foreground-muted">
                      {m.weight.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-foreground-muted">
                      {m.direction > 0 ? "+1" : "-1"}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          m.contribution >= 0 ? "text-emerald-400/90" : "text-amber-300/90"
                        )}
                      >
                        {m.contribution >= 0 ? "+" : ""}
                        {m.contribution.toFixed(3)}
                      </span>
                      <div className="mt-2 h-1 max-w-[160px] overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            m.contribution >= 0 ? "bg-emerald-500/70" : "bg-amber-500/70"
                          )}
                          style={{
                            width: `${Math.min(100, Math.abs(m.contribution) * 200)}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 font-mono text-xs leading-relaxed text-foreground-subtle">
            {data.blend.description}
          </p>
        </>
      )}
    </SpotlightCard>
  );
}
