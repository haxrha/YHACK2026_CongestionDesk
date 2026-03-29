"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBacktestRows, type BacktestRow } from "@/lib/backtest";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { PortMap, type TankerPort, type TankerVessel } from "./PortMap";
import { SignalPriceChart } from "./SignalPriceChart";
import { LiveSignalPanel } from "./LiveSignalPanel";
import { BacktestTable } from "./BacktestTable";
import { MockReturns2026 } from "./MockReturns2026";
import { MacroOutlookDashboard } from "./MacroOutlookDashboard";
import { MarketConditionsSummary } from "./MarketConditionsSummary";
import { PortShippingInsight } from "./PortShippingInsight";
import { cn } from "@/lib/cn";

type TankersPayload = {
  date: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  vessels: TankerVessel[];
  ports: TankerPort[];
  count: number;
};

async function fetchTankers(date: string): Promise<TankersPayload | null> {
  const res = await fetch(`/api/tankers?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<TankersPayload>;
}

type LiveCachePayload = {
  date: string;
  message_count: number;
  vessels: Array<{
    mmsi: string;
    port: string;
    name: string;
    lat: number;
    lon: number;
    sog: number;
    cog: number;
    likelyTanker: boolean;
  }>;
  ports: TankerPort[];
  bounds: TankersPayload["bounds"] | null;
  count: number;
};

async function fetchLiveCache(): Promise<LiveCachePayload | null> {
  const res = await fetch("/api/live/cache", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<LiveCachePayload>;
}

async function pickInitialDate(rows: BacktestRow[]): Promise<string> {
  if (rows.length === 0) return "";
  const scan = Math.min(25, rows.length);
  for (let i = rows.length - 1; i >= rows.length - scan; i--) {
    const d = rows[i]!.date;
    const t = await fetchTankers(d);
    if (t && t.vessels.length > 0) return d;
  }
  return rows[rows.length - 1]!.date;
}

function Hero({ selectedDate, onDateChange, rows, selectedRow }: {
  selectedDate: string;
  onDateChange: (d: string) => void;
  rows: BacktestRow[];
  selectedRow: BacktestRow | undefined;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const p = Math.min(1, scrollY / 400);
  const heroStyle = {
    opacity: 1 - p * 0.85,
    transform: `translateY(${p * 48}px) scale(${1 - p * 0.04})`,
  };

  return (
    <header
      ref={heroRef}
      style={heroStyle}
      className="motion-reduce:transform-none motion-reduce:opacity-100 relative z-10 border-b border-white/[0.06] px-6 py-20 transition-none md:px-12 lg:px-16 lg:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-accent-bright">
          AIS × Polymarket
        </p>
        <h1 className="mt-4 max-w-4xl bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-4xl font-semibold leading-[1.05] tracking-tight text-transparent md:text-6xl lg:text-7xl">
          Congestion{" "}
          <span
            className="inline-block bg-gradient-to-r from-[#5E6AD2] via-indigo-400 to-[#5E6AD2] bg-clip-text text-transparent animate-shimmer"
            style={{ backgroundSize: "200% auto" }}
          >
            desk
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground-muted md:text-lg md:leading-relaxed">
          Real backtest CSV, live-feeling AIS map, and a mock ticket — built
          with layered light, depth, and precision.
        </p>

        <MarketConditionsSummary />

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <label htmlFor="desk-date" className="sr-only">
            Focus date
          </label>
          <select
            id="desk-date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={cn(
              "rounded-lg border border-white/10 bg-[#0f0f12] px-4 py-3 text-sm text-foreground",
              "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
              "transition-[border-color,box-shadow] duration-200 ease-expo",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-background-base"
            )}
          >
            {rows.map((r) => (
              <option key={r.date} value={r.date}>
                {r.date}
              </option>
            ))}
          </select>
          {selectedRow && (
            <span className="text-sm text-foreground-muted">
              Edge{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  selectedRow.edge > 0 && "text-emerald-400",
                  selectedRow.edge < 0 && "text-red-400",
                  selectedRow.edge === 0 && "text-foreground"
                )}
              >
                {(selectedRow.edge * 100).toFixed(1)}¢
              </span>
              <span className="mx-2 text-border">·</span>
              YES {(selectedRow.price_today * 100).toFixed(0)}¢
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

type DeskTab = "overview" | "returns2026";

export function Desk() {
  const [deskTab, setDeskTab] = useState<DeskTab>("overview");
  const [rows, setRows] = useState<BacktestRow[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [tankers, setTankers] = useState<TankersPayload | null>(null);
  const [liveCache, setLiveCache] = useState<LiveCachePayload | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await loadBacktestRows();
        if (c) return;
        setRows(data);
        const initial = await pickInitialDate(data);
        if (c) return;
        setSelectedDate(initial);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const refreshTankers = useCallback(async (date: string) => {
    setMapLoading(true);
    setSelectedPort(null);
    try {
      setTankers(await fetchTankers(date));
    } finally {
      setMapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    void refreshTankers(selectedDate);
  }, [selectedDate, refreshTankers]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const data = await fetchLiveCache();
      if (!cancelled) setLiveCache(data);
    }
    void poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const useLiveMap = Boolean(
    liveCache?.bounds && (liveCache.vessels?.length ?? 0) > 0
  );

  const mapVessels: TankerVessel[] = useMemo(() => {
    if (useLiveMap && liveCache) {
      return liveCache.vessels.map((v) => ({
        mmsi: v.mmsi,
        lat: v.lat,
        lon: v.lon,
        sog: v.sog,
        cog: v.cog,
        port: v.port,
        name: v.name,
        likelyTanker: v.likelyTanker,
      }));
    }
    return tankers?.vessels ?? [];
  }, [useLiveMap, liveCache, tankers?.vessels]);

  const mapPorts: TankerPort[] = useMemo(() => {
    if (useLiveMap && liveCache) return liveCache.ports;
    return tankers?.ports ?? [];
  }, [useLiveMap, liveCache, tankers?.ports]);

  const mapBounds = useMemo(() => {
    if (useLiveMap && liveCache) return liveCache.bounds;
    return tankers?.bounds ?? null;
  }, [useLiveMap, liveCache, tankers?.bounds]);

  const mapDateLabel = useLiveMap
    ? `live · ${liveCache?.date ?? "—"}`
    : selectedDate;

  const mapBusy = mapLoading && !useLiveMap;

  const selectedRow = rows.find((r) => r.date === selectedDate);

  if (err && rows.length === 0) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6 text-foreground">
          {err}
        </div>
      </div>
    );
  }

  if (!selectedDate || rows.length === 0) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-foreground-muted">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="relative z-10">
        <Hero
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          rows={rows}
          selectedRow={selectedRow}
        />

        <main className="mx-auto max-w-6xl space-y-10 px-6 py-16 md:space-y-12 md:px-12 lg:px-16 lg:py-24">
          <div
            className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
            role="tablist"
            aria-label="Desk sections"
          >
            {(
              [
                { id: "overview" as const, label: "Desk" },
                { id: "returns2026" as const, label: "Outlook & 2026" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={deskTab === t.id}
                onClick={() => setDeskTab(t.id)}
                className={cn(
                  "rounded-lg px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] transition-colors",
                  deskTab === t.id
                    ? "bg-white/[0.08] text-foreground"
                    : "text-foreground-muted hover:bg-white/[0.04] hover:text-foreground-subtle"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {deskTab === "overview" && (
            <>
              <div className="grid gap-8 lg:grid-cols-6 lg:gap-10">
                <div className="flex flex-col gap-6 lg:col-span-4">
                  <PortMap
                    vessels={mapVessels}
                    ports={mapPorts}
                    bounds={mapBounds}
                    selectedPort={selectedPort}
                    onSelectPort={setSelectedPort}
                    dateLabel={mapDateLabel}
                    loading={mapBusy}
                    liveMode={useLiveMap}
                  />
                  <PortShippingInsight />
                </div>
                <div className="flex flex-col gap-8 lg:col-span-2">
                  <LiveSignalPanel />
                  <SignalPriceChart rows={rows} selectedDate={selectedDate} />
                </div>
              </div>

              <BacktestTable
                rows={rows}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </>
          )}

          {deskTab === "returns2026" && selectedRow && (
            <div className="space-y-10">
              <MacroOutlookDashboard
                baseYes={selectedRow.price_today}
                actualNextYes={selectedRow.price_tomorrow}
                sessionDate={selectedRow.date}
              />
              <MockReturns2026 />
              <p className="text-center font-mono text-xs text-foreground-subtle">
                Return figures are illustrative; macro table uses mock YES prices until
                you add Polymarket <code className="text-foreground-muted">tokenId</code>
                s in <code className="text-foreground-muted">macro_markets.json</code>.
              </p>
            </div>
          )}
        </main>

        <footer className="relative z-10 border-t border-white/[0.06] bg-background-deep/80 px-6 py-12 text-center text-xs text-foreground-muted backdrop-blur-sm md:px-12">
          <p className="mx-auto max-w-2xl font-mono leading-relaxed">
            <span className="text-foreground-subtle">backtest:</span>{" "}
            public/data/backtest_results.csv ·{" "}
            <span className="text-foreground-subtle">AIS:</span>{" "}
            /api/live/cache · /api/tankers · /api/live/signals · /api/macro-markets
          </p>
        </footer>
      </div>
    </div>
  );
}
