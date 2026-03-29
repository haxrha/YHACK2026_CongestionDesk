import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TankerOut = {
  mmsi: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  port: string;
  name: string;
};

function parseTankerLine(line: string): Record<string, string> | null {
  const parts = line.split(",");
  if (parts.length < 17) return null;
  return {
    MMSI: parts[0] ?? "",
    LAT: parts[2] ?? "",
    LON: parts[3] ?? "",
    SOG: parts[4] ?? "",
    COG: parts[5] ?? "",
    VesselName: parts[7] ?? "",
    port: parts[16]?.trim() ?? "",
  };
}

async function readTankerFile(date: string): Promise<string | null> {
  const file = `tankers_${date}.csv`;
  const backend = join(process.cwd(), "..", "Backend", "ais_tankers", file);
  try {
    return await readFile(backend, "utf-8");
  } catch {
    try {
      return await readFile(join(process.cwd(), "public", "data", file), "utf-8");
    } catch {
      return null;
    }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Query ?date=YYYY-MM-DD required" },
      { status: 400 }
    );
  }

  const raw = await readTankerFile(date);
  if (!raw) {
    return NextResponse.json(
      { error: `No tanker file for ${date}`, vessels: [], ports: [] },
      { status: 404 }
    );
  }

  const lines = raw.split(/\r?\n/);
  const byMmsi = new Map<string, Record<string, string>>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const row = parseTankerLine(line);
    if (!row?.MMSI) continue;
    const lat = parseFloat(row.LAT);
    const lon = parseFloat(row.LON);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    byMmsi.set(row.MMSI, row);
  }

  const vessels: TankerOut[] = [];
  const portAgg = new Map<string, { lat: number; lon: number; n: number }>();

  for (const row of Array.from(byMmsi.values())) {
    const lat = parseFloat(row.LAT);
    const lon = parseFloat(row.LON);
    const sog = parseFloat(row.SOG) || 0;
    const cog = parseFloat(row.COG) || 0;
    const port = row.port || "unknown";
    vessels.push({
      mmsi: row.MMSI,
      lat,
      lon,
      sog,
      cog,
      port,
      name: row.VesselName || row.MMSI,
    });
    const prev = portAgg.get(port);
    if (prev) {
      prev.lat += lat;
      prev.lon += lon;
      prev.n += 1;
    } else {
      portAgg.set(port, { lat, lon, n: 1 });
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

  return NextResponse.json({
    date,
    bounds: {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLon: minLon - padLon,
      maxLon: maxLon + padLon,
    },
    vessels,
    ports,
    count: vessels.length,
  });
}
