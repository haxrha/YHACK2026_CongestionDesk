"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";
import type { DelaySignalDay } from "@/lib/delaySignalsTypes";
import {
  baselineCo2KgFor2024,
  carDayEquivalence,
  computeDayCarbon,
  FUEL_KG_PER_NM_IDLE,
  FUEL_KG_PER_NM_MOVING,
  KG_CO2_PER_TONNE_HFO,
  TONNES_CO2_PER_CAR_DAY,
} from "@/lib/carbonModel";

const EmissionsMap = dynamic(
  () => import("@/components/emissions/EmissionsPortMapLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(58vh,520px)] min-h-[340px] items-center justify-center rounded-xl border border-white/[0.06] bg-background-elevated/60 text-sm text-foreground-muted">
        Loading map…
      </div>
    ),
  }
);

function formatTonnesCo2(kg: number): string {
  return (kg / 1000).toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
}

export function EmissionsDashboard() {
  const [days, setDays] = useState<DelaySignalDay[]>([]);
  const [baselineKg, setBaselineKg] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    let c = false;
    fetch("/api/delay-signals", { cache: "no-store" })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Failed to load");
        return j as { days: DelaySignalDay[]; baselineCo2Kg: number };
      })
      .then((d) => {
        if (c) return;
        setDays(d.days);
        setBaselineKg(
          d.baselineCo2Kg ?? baselineCo2KgFor2024(d.days)
        );
        if (d.days.length > 0) {
          setSelectedDate(d.days[d.days.length - 1]!.date);
        }
        setErr(null);
      })
      .catch((e) => {
        if (!c) setErr(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, []);

  const dayRow = useMemo(
    () => days.find((d) => d.date === selectedDate),
    [days, selectedDate]
  );

  const carbon = useMemo(
    () => (dayRow ? computeDayCarbon(dayRow) : null),
    [dayRow]
  );

  const excessKg = carbon ? Math.max(0, carbon.totalCo2Kg - baselineKg) : 0;
  const carDays = carDayEquivalence(excessKg);

  const maxCo2Port = useMemo(() => {
    if (!carbon?.ports.length) return 1;
    return Math.max(...carbon.ports.map((p) => p.co2Kg), 1);
  }, [carbon]);

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="relative z-10">
        <header className="border-b border-white/[0.06] px-6 py-6 md:px-12 lg:px-16">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
                Emissions
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Port congestion → CO₂
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="sr-only" htmlFor="em-day">
                Day
              </label>
              <select
                id="em-day"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={!days.length}
                className={cn(
                  "rounded-lg border border-white/10 bg-[#0f0f12] px-4 py-2.5 text-sm text-foreground",
                  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                )}
              >
                {days.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date}
                  </option>
                ))}
              </select>
              <Link
                href="/"
                className="rounded-lg border border-white/10 px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-foreground-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
              >
                ← Desk
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-8 px-6 py-12 md:px-12 lg:px-16 lg:py-16">
          {loading && (
            <p className="text-foreground-muted">Loading delay signals…</p>
          )}
          {err && (
            <p className="text-red-400/90">
              {err} — add{" "}
              <code className="font-mono text-foreground-subtle">
                Backend/delay_signals.json
              </code>{" "}
              or{" "}
              <code className="font-mono text-foreground-subtle">
                public/data/delay_signals.json
              </code>
              .
            </p>
          )}

          {carbon && !loading && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SpotlightCard contentClassName="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                    Total CO₂ (ports)
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                    {formatTonnesCo2(carbon.totalCo2Kg)}{" "}
                    <span className="text-lg font-normal text-foreground-muted">
                      t
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-foreground-subtle">
                    IMO 2020 factor: {KG_CO2_PER_TONNE_HFO.toLocaleString()} kg
                    CO₂ / t HFO
                  </p>
                </SpotlightCard>
                <SpotlightCard contentClassName="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                    Excess vs 2024 baseline
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-300">
                    {formatTonnesCo2(excessKg)}{" "}
                    <span className="text-lg font-normal text-foreground-muted">
                      t
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-foreground-subtle">
                    Baseline = mean daily CO₂ Jan–Apr &apos;24 in this file
                  </p>
                </SpotlightCard>
                <SpotlightCard contentClassName="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                    Idle-leaning emissions
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-sky-300">
                    {carbon.idleEmissionsPercent.toFixed(1)}
                    <span className="text-lg text-foreground-muted">%</span>
                  </p>
                  <p className="mt-2 text-xs text-foreground-subtle">
                    Share tied to low-SOG / congestion proxy (≈30 kg/nm band)
                  </p>
                </SpotlightCard>
                <SpotlightCard contentClassName="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-foreground-muted">
                    HFO consumed (est.)
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                    {carbon.totalFuelTonnesHFO.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    <span className="text-lg font-normal text-foreground-muted">
                      t
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-foreground-subtle">
                    Derived from AIS-weighted nm + {FUEL_KG_PER_NM_MOVING} /{" "}
                    {FUEL_KG_PER_NM_IDLE} kg/nm bands
                  </p>
                </SpotlightCard>
              </div>

              <SpotlightCard contentClassName="p-6 md:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent-bright">
                  Human scale
                </p>
                <p className="mt-3 text-lg leading-relaxed text-foreground-muted">
                  Excess port congestion CO₂ for{" "}
                  <span className="text-foreground">{carbon.date}</span> is
                  equivalent to roughly{" "}
                  <span className="font-semibold text-emerald-300">
                    {carDays.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                    car-days
                  </span>{" "}
                  of tailpipe emissions (
                  {TONNES_CO2_PER_CAR_DAY} t CO₂ / car / day benchmark).
                </p>
                <p className="mt-4 text-xs text-foreground-subtle">
                  VLCC studies suggest cutting excess port time can save on the
                  order of 7–19% fuel — same order of magnitude as the idle vs
                  moving split shown below.
                </p>
              </SpotlightCard>

              <SpotlightCard contentClassName="p-6 md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      US ports — CO₂ & congestion
                    </h2>
                    <p className="mt-1 text-sm text-foreground-muted">
                      OpenStreetMap basemap · circle size ∝ modeled port CO₂ ·
                      color = congestion (density + low SOG + dwell). Click a
                      marker for tonnes and fleet count.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-foreground-subtle">
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-emerald-500/80" />{" "}
                      lower
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-amber-500/80" />{" "}
                      mid
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-red-500/80" />{" "}
                      higher
                    </span>
                  </div>
                </div>
                <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0c]">
                  <EmissionsMap
                    ports={carbon.ports}
                    maxCo2Kg={maxCo2Port}
                  />
                </div>
              </SpotlightCard>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Idle vs moving (by port)
                </h2>
                <p className="text-sm text-foreground-muted">
                  Modeled split from SOG (moving ≈ {FUEL_KG_PER_NM_MOVING} kg/nm)
                  vs idle/auxiliary proxy (≈ {FUEL_KG_PER_NM_IDLE} kg/nm), scaled
                  by fleet size and congestion.
                </p>
                <div className="space-y-4">
                  {carbon.ports.map((p) => (
                    <SpotlightCard key={p.portId} contentClassName="p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {p.label}
                        </span>
                        <span className="font-mono text-xs text-foreground-muted">
                          {formatTonnesCo2(p.co2Kg)} t CO₂ · {p.vesselCount}{" "}
                          vessels
                        </span>
                      </div>
                      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full bg-sky-500/90 transition-all"
                          style={{
                            width: `${p.idleFuelShare * 100}%`,
                          }}
                          title="Idle-leaning"
                        />
                        <div
                          className="h-full bg-indigo-500/90 transition-all"
                          style={{
                            width: `${p.movingFuelShare * 100}%`,
                          }}
                          title="Moving-leaning"
                        />
                      </div>
                      <div className="mt-2 flex justify-between font-mono text-[10px] text-foreground-subtle">
                        <span>Idle-leaning { (p.idleFuelShare * 100).toFixed(0)}%</span>
                        <span>Moving-leaning { (p.movingFuelShare * 100).toFixed(0)}%</span>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
