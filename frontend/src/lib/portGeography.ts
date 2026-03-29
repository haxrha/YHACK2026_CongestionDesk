/** Approximate coordinates for US tanker ports (map markers). */
export const PORT_LAT_LON: Record<string, [number, number]> = {
  houston: [29.73, -95.02],
  corpus: [27.81, -97.4],
  nynj: [40.67, -74.04],
  la_longbeach: [33.75, -118.22],
  charleston: [32.78, -79.93],
};

export function portLatLon(portId: string): [number, number] {
  return PORT_LAT_LON[portId] ?? [35, -98];
}
