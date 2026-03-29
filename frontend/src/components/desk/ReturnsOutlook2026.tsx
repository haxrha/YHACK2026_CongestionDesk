"use client";

import { useId, useMemo } from "react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";

const YTD_POINTS: { label: string; cumulativePct: number }[] = [
  { label: "Jan", cumulativePct: 0.7 },
  { label: "Feb", cumulativePct: 1.9 },
  { label: "Mar", cumulativePct: 3.2 },
];

const W = 560;
const H = 200;
const PAD_X = 44;
const PAD_Y = 28;

export function ReturnsOutlook2026() {
  const gradId = useId().replace(/:/g, "");
  const last = YTD_POINTS[YTD_POINTS.length - 1]!;
  const chart = useMemo(() => {
    const maxV =
      Math.max(4, ...YTD_POINTS.map((p) => p.cumulativePct)) * 1.08;
    const minV = 0;
    const n = YTD_POINTS.length;
    const x = (i: number) =>
      PAD_X + (i / Math.max(1, n - 1)) * (W - PAD_X * 2);
    const y = (v: number) =>
      PAD_Y +
      ((maxV - v) / (maxV - minV || 1)) * (H - PAD_Y * 2);

    let d = "";
    YTD_POINTS.forEach((p, i) => {
      const xi = x(i);
      const yi = y(p.cumulativePct);
      d += i === 0 ? `M ${xi} ${yi}` : ` L ${xi} ${yi}`;
    });
    const areaD = `${d} L ${x(n - 1)} ${H - PAD_Y} L ${x(0)} ${H - PAD_Y} Z`;
    return { path: d, areaPath: areaD, maxV, ticks: [0, 1, 2, 3, 4].filter((t) => t <= maxV) };
  }, []);

  return (
    <SpotlightCard contentClassName="p-6 md:p-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
        Outlook
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            Returns · 2026 YTD
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground-muted">
            Cumulative desk-style return through late March, shown in the ~2–4%
            band for the outlook tab.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-xs uppercase tracking-wide text-foreground-muted">
            YTD
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-emerald-400">
            +{last.cumulativePct.toFixed(1)}%
          </p>
          <p className="mt-1 font-mono text-xs text-foreground-subtle">
            band ~2–4%
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-white/[0.06] bg-background-elevated/60 px-2 py-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto h-auto w-full max-w-[560px]"
          role="img"
          aria-label="2026 year-to-date cumulative return January through March"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(74, 222, 128)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(74, 222, 128)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.ticks.map((t) => {
            const yy =
              PAD_Y +
              ((chart.maxV - t) / (chart.maxV || 1)) * (H - PAD_Y * 2);
            return (
              <g key={t}>
                <line
                  x1={PAD_X}
                  x2={W - PAD_X}
                  y1={yy}
                  y2={yy}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 6"
                />
                <text
                  x={PAD_X - 8}
                  y={yy + 4}
                  textAnchor="end"
                  className="fill-foreground-subtle font-mono text-[10px]"
                >
                  {t}%
                </text>
              </g>
            );
          })}
          <path d={chart.areaPath} fill={`url(#${gradId})`} />
          <path
            d={chart.path}
            fill="none"
            stroke="rgb(74, 222, 128)"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {YTD_POINTS.map((p, i) => {
            const xi =
              PAD_X +
              (i / Math.max(1, YTD_POINTS.length - 1)) * (W - PAD_X * 2);
            const yy =
              PAD_Y +
              ((chart.maxV - p.cumulativePct) / (chart.maxV || 1)) *
                (H - PAD_Y * 2);
            return (
              <g key={p.label}>
                <circle cx={xi} cy={yy} r={4} fill="rgb(24, 24, 27)" stroke="rgb(74, 222, 128)" strokeWidth={2} />
                <text
                  x={xi}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-foreground-muted font-mono text-[10px]"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {YTD_POINTS.map((p) => (
          <div
            key={p.label}
            className="rounded-xl border border-white/[0.06] bg-background-elevated/50 px-4 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
              {p.label} &apos;26
            </p>
            <p className="mt-1 font-mono text-lg tabular-nums text-foreground">
              +{p.cumulativePct.toFixed(1)}%
            </p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full bg-emerald-500/80 transition-all"
                )}
                style={{
                  width: `${Math.min(100, (p.cumulativePct / 4) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </SpotlightCard>
  );
}
