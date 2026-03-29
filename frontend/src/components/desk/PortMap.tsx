"use client";

import dynamic from "next/dynamic";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { TankerPort, TankerVessel } from "./PortMapLeaflet";

export type { TankerPort, TankerVessel };

type Bounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

type Props = {
  vessels: TankerVessel[];
  ports: TankerPort[];
  bounds: Bounds | null;
  selectedPort: string | null;
  onSelectPort: (id: string | null) => void;
  dateLabel: string;
  loading?: boolean;
  /** Live AIS from vessel_cache.json (positions + tanker heuristic) */
  liveMode?: boolean;
};

const LeafletMap = dynamic(() => import("./PortMapLeaflet"), {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(62vh,560px)] min-h-[320px] items-center justify-center rounded-xl bg-background-elevated text-sm text-foreground-muted">
        Initializing map…
      </div>
    ),
  }
);

export function PortMap({
  vessels,
  ports,
  bounds,
  selectedPort,
  onSelectPort,
  dateLabel,
  loading,
  liveMode,
}: Props) {
  return (
    <SpotlightCard contentClassName="p-0">
      <div className="border-b border-white/[0.06] px-6 py-6 md:px-8 md:py-8">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
          AIS layer
        </p>
        <h2 className="mt-2 bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-3xl font-semibold tracking-tight text-transparent md:text-4xl">
          Port traffic
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted">
          Dark basemap · arrows = COG, dots = &lt;1 kn ·{" "}
          <span className="text-accent-bright/90">indigo/cyan</span> = likely
          tanker, <span className="text-amber-400/90">amber</span> = other.
          {liveMode ? (
            <>
              {" "}
              Live{" "}
              <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-foreground-subtle">
                vessel_cache.json
              </code>
            </>
          ) : (
            <>
              {" "}
              Historical{" "}
              <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-foreground-subtle">
                tankers_{dateLabel}.csv
              </code>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-foreground-muted">
          <span className="font-mono text-foreground">{dateLabel}</span>
          <span>
            {loading
              ? "Loading…"
              : `${vessels.length.toLocaleString()} vessels`}
          </span>
        </div>
      </div>

      <div className="relative px-4 pb-4 pt-0 md:px-6 md:pb-6">
        {loading && (
          <div className="absolute inset-x-4 top-0 z-[500] flex h-[min(62vh,560px)] min-h-[320px] items-center justify-center rounded-xl bg-background-base/80 backdrop-blur-sm md:inset-x-6">
            <p className="text-sm text-foreground-muted">Loading AIS…</p>
          </div>
        )}
        {!loading && (!bounds || vessels.length === 0) && (
          <div className="flex h-[min(62vh,560px)] min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-background-elevated/50 px-6 text-center">
            <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
              {liveMode ? (
                <>
                  No live positions in cache yet. Run{" "}
                  <code className="font-mono text-foreground-subtle">
                    Backend/live_signal.py
                  </code>{" "}
                  so <code className="font-mono">vessel_cache.json</code> gets
                  last_lat / last_lon.
                </>
              ) : (
                <>
                  No AIS file for this date. Ensure{" "}
                  <code className="font-mono text-foreground-subtle">
                    Backend/ais_tankers/tankers_{dateLabel}.csv
                  </code>{" "}
                  exists (run dev from repo; API reads ../Backend).
                </>
              )}
            </p>
          </div>
        )}
        {bounds && vessels.length > 0 && (
          <LeafletMap
            vessels={vessels}
            ports={ports}
            bounds={bounds}
            selectedPort={selectedPort}
            onSelectPort={onSelectPort}
          />
        )}
        <div className="mt-4 flex flex-wrap gap-6 text-xs text-foreground-muted">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400" /> &lt;1 kn
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> 1–6 kn
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> &gt;6 kn
          </span>
          {liveMode && (
            <>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#5e6ad2]" /> tanker
                (est.)
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> other
              </span>
            </>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}
