import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CacheVessel = {
  mmsi: string;
  port: string;
  name: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  likelyTanker: boolean;
};

async function readCacheFile(): Promise<string | null> {
  const backend = join(process.cwd(), "..", "Backend", "vessel_cache.json");
  try {
    return await readFile(backend, "utf-8");
  } catch {
    try {
      return await readFile(join(process.cwd(), "public", "data", "vessel_cache.json"), "utf-8");
    } catch {
      return null;
    }
  }
}

export async function GET() {
  const raw = await readCacheFile();
  if (!raw) {
    return NextResponse.json(
      { error: "vessel_cache.json not found", vessels: [], ports: [], bounds: null },
      { status: 404 }
    );
  }

  let data: {
    date?: string;
    message_count?: number;
    ports?: Record<
      string,
      Record<
        string,
        {
          name?: string;
          last_lat?: number;
          last_lon?: number;
          last_cog?: number;
          sog_readings?: number[];
          likely_tanker?: boolean;
        }
      >
    >;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 500 });
  }

  const vessels: CacheVessel[] = [];
  const portAgg = new Map<string, { lat: number; lon: number; n: number }>();

  const portsData = data.ports ?? {};
  for (const [portId, byMmsi] of Object.entries(portsData)) {
    for (const [mmsi, v] of Object.entries(byMmsi)) {
      const lat = v.last_lat;
      const lon = v.last_lon;
      if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
        continue;
      }
      const sogs = v.sog_readings ?? [];
      const sog = sogs.length > 0 ? sogs[sogs.length - 1]! : 0;
      const cog = v.last_cog ?? 0;
      vessels.push({
        mmsi,
        port: portId,
        name: v.name ?? mmsi,
        lat,
        lon,
        sog,
        cog,
        likelyTanker: Boolean(v.likely_tanker),
      });
      const prev = portAgg.get(portId);
      if (prev) {
        prev.lat += lat;
        prev.lon += lon;
        prev.n += 1;
      } else {
        portAgg.set(portId, { lat, lon, n: 1 });
      }
    }
  }

  const ports = Array.from(portAgg.entries()).map(([id, a]) => ({
    id,
    lat: a.lat / a.n,
    lon: a.lon / a.n,
    count: a.n,
  }));

  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const v of vessels) {
    minLat = Math.min(minLat, v.lat);
    maxLat = Math.max(maxLat, v.lat);
    minLon = Math.min(minLon, v.lon);
    maxLon = Math.max(maxLon, v.lon);
  }
  const padLat = (maxLat - minLat) * 0.08 || 0.5;
  const padLon = (maxLon - minLon) * 0.08 || 0.5;

  const bounds =
    vessels.length > 0
      ? {
          minLat: minLat - padLat,
          maxLat: maxLat + padLat,
          minLon: minLon - padLon,
          maxLon: maxLon + padLon,
        }
      : null;

  return NextResponse.json({
    date: data.date ?? "",
    message_count: data.message_count ?? 0,
    vessels,
    ports,
    bounds,
    count: vessels.length,
  });
}
