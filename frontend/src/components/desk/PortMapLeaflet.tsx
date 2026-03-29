"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type TankerVessel = {
  mmsi: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  port: string;
  name: string;
  /** Live AIS cache: MMSI heuristic — tankers vs other traffic */
  likelyTanker?: boolean;
};

export type TankerPort = {
  id: string;
  lat: number;
  lon: number;
  count: number;
};

type Bounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

/** Speed bands; hue encodes likely tanker (accent) vs other traffic (amber/gray). */
function sogHex(sog: number, likelyTanker: boolean): string {
  const tanker = likelyTanker !== false;
  if (sog < 1) return tanker ? "#818cf8" : "#fb923c";
  if (sog < 6) return tanker ? "#5e6ad2" : "#f59e0b";
  return tanker ? "#22d3ee" : "#a8a29e";
}

function vesselIcon(
  sog: number,
  cog: number,
  dimmed: boolean,
  likelyTanker?: boolean
): L.DivIcon {
  const lt = likelyTanker !== false;
  const color = sogHex(sog, lt);
  const op = dimmed ? 0.2 : 0.95;
  if (sog < 1) {
    return L.divIcon({
      className: "leaflet-vessel",
      html: `<div style="width:9px;height:9px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,0.9);opacity:${op};box-shadow:0 0 4px rgba(0,0,0,0.6)"></div>`,
      iconSize: [9, 9],
      iconAnchor: [4, 4],
    });
  }
  const html = `<div style="transform:rotate(${cog}deg);opacity:${op};width:16px;height:16px;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 0.5 L13.5 12 L7 9 L0.5 12 Z" fill="${color}" stroke="rgba(255,255,255,0.95)" stroke-width="0.7"/></svg></div>`;
  return L.divIcon({
    className: "leaflet-vessel",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitBounds({ bounds }: { bounds: Bounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [bounds.minLat, bounds.minLon],
        [bounds.maxLat, bounds.maxLon],
      ],
      { padding: [28, 28], maxZoom: 8 }
    );
  }, [map, bounds]);
  return null;
}

type Props = {
  vessels: TankerVessel[];
  ports: TankerPort[];
  bounds: Bounds | null;
  selectedPort: string | null;
  onSelectPort: (id: string | null) => void;
};

export default function PortMapLeaflet({
  vessels,
  ports,
  bounds,
  selectedPort,
  onSelectPort,
}: Props) {
  const center = useMemo((): [number, number] => {
    if (!bounds) return [32, -95];
    return [
      (bounds.minLat + bounds.maxLat) / 2,
      (bounds.minLon + bounds.maxLon) / 2,
    ];
  }, [bounds]);

  if (!bounds) return null;

  return (
    <MapContainer
      center={center}
      zoom={5}
      className="z-0 h-[min(62vh,560px)] w-full min-h-[320px] rounded-xl"
      scrollWheelZoom
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <FitBounds bounds={bounds} />
      {vessels.map((v) => (
        <Marker
          key={`${v.mmsi}-${selectedPort ?? "all"}-${selectedPort && v.port !== selectedPort ? "dim" : "full"}`}
          position={[v.lat, v.lon]}
          icon={vesselIcon(
            v.sog,
            v.cog,
            Boolean(selectedPort && v.port !== selectedPort),
            v.likelyTanker
          )}
        >
          <Popup className="!text-xs">
            <span className="font-semibold text-slate-900">{v.name}</span>
            <br />
            <span className="text-slate-600">
              {v.port} · {v.sog.toFixed(1)} kn · COG {v.cog.toFixed(0)}° ·{" "}
              {v.likelyTanker !== false ? "tanker (est.)" : "other"}
            </span>
          </Popup>
        </Marker>
      ))}
      {ports.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lon]}
          radius={selectedPort === p.id ? 14 : 11}
          pathOptions={{
            color: selectedPort === p.id ? "#5e6ad2" : "rgba(255,255,255,0.35)",
            fillColor: "rgba(94,106,210,0.25)",
            fillOpacity: 0.5,
            weight: 2,
          }}
          eventHandlers={{
            click: () =>
              onSelectPort(selectedPort === p.id ? null : p.id),
          }}
        >
          <Popup>
            <button
              type="button"
              className="text-left text-xs font-medium text-slate-800"
              onClick={() =>
                onSelectPort(selectedPort === p.id ? null : p.id)
              }
            >
              {p.id.replace("_", " ")} · {p.count} vessels
            </button>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
