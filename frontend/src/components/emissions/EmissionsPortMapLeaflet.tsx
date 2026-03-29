"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { portLatLon } from "@/lib/portGeography";
import type { PortEmissionBreakdown } from "@/lib/carbonModel";

function congestionFill(congestion: number): string {
  const x = Math.min(1, Math.max(0, congestion));
  const h = 120 - x * 120;
  return `hsl(${h} 72% 46%)`;
}

function USBounds() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [22, -126],
        [49, -66],
      ],
      { padding: [24, 24], maxZoom: 5 }
    );
  }, [map]);
  return null;
}

type Props = {
  ports: PortEmissionBreakdown[];
  maxCo2Kg: number;
};

export default function EmissionsPortMapLeaflet({ ports, maxCo2Kg }: Props) {
  const center: [number, number] = [37.5, -98];

  const markers = useMemo(() => {
    const max = Math.max(maxCo2Kg, 1);
    return ports.map((p) => {
      const [lat, lon] = portLatLon(p.portId);
      const t = Math.sqrt(p.co2Kg / max);
      const radiusPx = 8 + t * 26;
      return { ...p, lat, lon, radiusPx };
    });
  }, [ports, maxCo2Kg]);

  return (
    <MapContainer
      center={center}
      zoom={4}
      className="z-0 h-[min(58vh,520px)] w-full min-h-[340px] rounded-xl"
      scrollWheelZoom
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <USBounds />
      {markers.map((m) => (
        <CircleMarker
          key={m.portId}
          center={[m.lat, m.lon]}
          radius={m.radiusPx}
          pathOptions={{
            color: "rgba(255,255,255,0.45)",
            weight: 2,
            fillColor: congestionFill(m.congestion),
            fillOpacity: 0.72,
          }}
        >
          <Popup className="!text-xs">
            <div className="font-semibold text-slate-900">{m.label}</div>
            <div className="mt-1 text-slate-600">
              {(m.co2Kg / 1000).toFixed(2)} t CO₂ · {m.vesselCount} vessels
            </div>
            <div className="mt-0.5 text-slate-500">
              Congestion index {(m.congestion * 100).toFixed(0)}%
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
