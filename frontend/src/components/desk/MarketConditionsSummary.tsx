"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

let initialFetchScheduled = false;

async function requestSummary(): Promise<{
  summary?: string;
  stats?: string[];
  error?: string;
  missingKey?: boolean;
}> {
  const res = await fetch("/api/market-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: "{}",
  });
  const data = (await res.json()) as {
    summary?: string;
    stats?: string[];
    error?: string;
    missingKey?: boolean;
  };
  if (!res.ok) {
    return {
      error: data.error ?? `Request failed (${res.status})`,
      missingKey: data.missingKey,
    };
  }
  return { summary: data.summary, stats: data.stats };
}

export function MarketConditionsSummary() {
  const [text, setText] = useState<string | null>(null);
  const [stats, setStats] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    setMissingKey(false);
    try {
      const { summary, stats: st, error: err, missingKey: noKey } = await requestSummary();
      if (err) {
        setError(err);
        setMissingKey(Boolean(noKey));
      } else {
        setText(summary ?? null);
        setStats(Array.isArray(st) ? st : []);
      }
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (initialFetchScheduled) return;
    initialFetchScheduled = true;
    void load();
  }, [load]);

  return (
    <div
      className={cn(
        "relative mt-8 max-w-2xl overflow-hidden rounded-2xl",
        "border border-border bg-surface",
        "shadow-[0_0_0_1px_rgba(94,106,210,0.12),0_2px_28px_rgba(0,0,0,0.35),0_0_60px_rgba(94,106,210,0.06)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(94,106,210,0.12)_0%,transparent_55%)] opacity-90"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(94,106,210,0.35)] to-transparent" />

      <div className="relative px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.28em] text-foreground-muted">
            Market context
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => void load()}
            className="gap-2 px-3 py-2 text-xs text-foreground-muted hover:text-foreground"
            aria-busy={loading}
          >
            <svg
              className={cn("h-3.5 w-3.5 shrink-0", loading && "motion-safe:animate-spin")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path
                d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M16 21h5v-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </Button>
        </div>

        {stats.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.map((s, i) => (
              <span
                key={`${i}-${s.slice(0, 12)}`}
                className={cn(
                  "rounded-full border border-border-accent bg-white/[0.04] px-3 py-1.5",
                  "font-mono text-[0.7rem] font-medium leading-snug tracking-tight text-foreground",
                  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                )}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 min-h-[4.5rem]">
          {loading && !text && (
            <p className="text-sm leading-relaxed text-foreground-subtle">
              Synthesizing current conditions…
            </p>
          )}
          {error && (
            <p
              className={cn(
                "text-sm leading-relaxed",
                missingKey ? "text-foreground-subtle" : "text-red-400/90"
              )}
            >
              {error}
            </p>
          )}
          {text && (
            <p className="text-sm leading-relaxed text-foreground-muted">{text}</p>
          )}
          {loading && text && (
            <p className="mt-2 text-xs text-foreground-subtle">Updating…</p>
          )}
        </div>
      </div>
    </div>
  );
}
