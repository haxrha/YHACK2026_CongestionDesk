/**
 * Emissions derived from AIS delay_signals + IMO-style factors (hackathon model).
 * - IMO GHG Study 2020: 3,114 kg CO₂ per tonne HFO burned (reported factor).
 * - Speed proxy: ~90 kg fuel/nm at ~16 kn vs ~30 kg/nm at ~10 kn (idle vs moving band).
 */

import type { DelaySignalDay, PortDayScores } from "./delaySignalsTypes";

/** kg CO₂ per tonne HFO (IMO GHG Study 2020, commonly cited). */
export const KG_CO2_PER_TONNE_HFO = 3114;

/** kg HFO per nm — high-speed steaming band (~16 kn). */
export const FUEL_KG_PER_NM_MOVING = 90;

/** kg HFO per nm — slow / low-speed band (~10 kn), used as idle/auxiliary proxy. */
export const FUEL_KG_PER_NM_IDLE = 30;

/** Nominal nm of port-zone activity per vessel-day (scales signals to fuel mass). */
const NM_PER_VESSEL_DAY = 28;

/** Car footprint for human-scale comparison (tonnes CO₂ / car / day). */
export const TONNES_CO2_PER_CAR_DAY = 0.21;

export type PortEmissionBreakdown = {
  portId: string;
  label: string;
  vesselCount: number;
  /** 0–1 share of fuel attributed to idle/auxiliary proxy. */
  idleFuelShare: number;
  movingFuelShare: number;
  fuelTonnesHFO: number;
  co2Kg: number;
  co2IdleKg: number;
  co2MovingKg: number;
  /** 0–1 congestion index for heatmap color. */
  congestion: number;
};

export type DayCarbonResult = {
  date: string;
  ports: PortEmissionBreakdown[];
  totalFuelTonnesHFO: number;
  totalCo2Kg: number;
  totalCo2IdleKg: number;
  totalCo2MovingKg: number;
  idleEmissionsPercent: number;
};

const PORT_LABELS: Record<string, string> = {
  houston: "Houston",
  nynj: "NY / NJ",
  la_longbeach: "LA / Long Beach",
  corpus: "Corpus Christi",
  charleston: "Charleston",
};

export function portLabel(portId: string): string {
  return PORT_LABELS[portId] ?? portId.replace(/_/g, " ");
}

function fuelKgForPortDay(p: PortDayScores): {
  totalKg: number;
  idleKg: number;
  movingKg: number;
  idleShare: number;
} {
  const n = Math.max(0, p.vessel_count);
  const sog = Math.min(1, Math.max(0, p.sog));
  const density = Math.min(1, Math.max(0, p.density));
  const dwell = Math.min(1, Math.max(0, p.dwell));
  /** Higher congestion pushes the blend toward the idle/auxiliary burn curve. */
  const congestion = (density * 0.55 + (1 - sog) * 0.35 + dwell * 0.1);
  const idleWeight = Math.min(1, Math.max(0, (1 - sog) * 0.65 + congestion * 0.35));
  const moveWeight = 1 - idleWeight;
  const nm = NM_PER_VESSEL_DAY;
  const idleKg = n * nm * idleWeight * FUEL_KG_PER_NM_IDLE;
  const movingKg = n * nm * moveWeight * FUEL_KG_PER_NM_MOVING;
  const totalKg = idleKg + movingKg;
  const idleShare = totalKg > 0 ? idleKg / totalKg : 0.5;
  return { totalKg, idleKg, movingKg, idleShare };
}

function co2FromFuelKg(fuelKg: number): number {
  const tonnes = fuelKg / 1000;
  return tonnes * KG_CO2_PER_TONNE_HFO;
}

export function computeDayCarbon(day: DelaySignalDay): DayCarbonResult {
  const ports: PortEmissionBreakdown[] = [];
  let totalFuel = 0;
  let totalCo2 = 0;
  let totalIdleCo2 = 0;
  let totalMovingCo2 = 0;

  for (const [portId, scores] of Object.entries(day.port_scores)) {
    const { totalKg, idleKg, movingKg, idleShare } = fuelKgForPortDay(scores);
    const co2 = co2FromFuelKg(totalKg);
    const co2I = co2FromFuelKg(idleKg);
    const co2M = co2FromFuelKg(movingKg);
    const congestion =
      (scores.density + (1 - scores.sog) + scores.dwell) / 3;
    ports.push({
      portId,
      label: portLabel(portId),
      vesselCount: scores.vessel_count,
      idleFuelShare: idleShare,
      movingFuelShare: 1 - idleShare,
      fuelTonnesHFO: totalKg / 1000,
      co2Kg: co2,
      co2IdleKg: co2I,
      co2MovingKg: co2M,
      congestion: Math.min(1, Math.max(0, congestion)),
    });
    totalFuel += totalKg / 1000;
    totalCo2 += co2;
    totalIdleCo2 += co2I;
    totalMovingCo2 += co2M;
  }

  ports.sort((a, b) => b.co2Kg - a.co2Kg);

  const idleEmissionsPercent = totalCo2 > 0 ? (100 * totalIdleCo2) / totalCo2 : 0;

  return {
    date: day.date,
    ports,
    totalFuelTonnesHFO: totalFuel,
    totalCo2Kg: totalCo2,
    totalCo2IdleKg: totalIdleCo2,
    totalCo2MovingKg: totalMovingCo2,
    idleEmissionsPercent,
  };
}

/** Baseline: mean daily total CO₂ (kg) for Jan–Apr 2024 days in the series. */
export function baselineCo2KgFor2024(days: DelaySignalDay[]): number {
  const janApr = days.filter((d) => {
    const [y, m] = d.date.split("-").map(Number);
    return y === 2024 && m >= 1 && m <= 4;
  });
  if (janApr.length === 0) return 0;
  const sum = janApr.reduce((s, d) => s + computeDayCarbon(d).totalCo2Kg, 0);
  return sum / janApr.length;
}

export function carDayEquivalence(excessCo2Kg: number): number {
  if (excessCo2Kg <= 0) return 0;
  const excessTonnes = excessCo2Kg / 1000;
  return excessTonnes / TONNES_CO2_PER_CAR_DAY;
}
