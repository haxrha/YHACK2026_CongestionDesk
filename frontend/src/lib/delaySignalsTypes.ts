export type PortDayScores = {
  dwell: number;
  density: number;
  throughput: number;
  sog: number;
  vessel_count: number;
};

export type DelaySignalDay = {
  date: string;
  port_scores: Record<string, PortDayScores>;
  agg_dwell: number;
  agg_density: number;
  agg_throughput: number;
  agg_sog: number;
  multi_port: number;
};
