import type {
  Analysis,
  Histogram,
  Meta,
  Metric,
  OdRow,
  Region,
  TripType,
  ViaRow,
  Insights,
} from "./types";
import { ALL_TRIP_TYPES, TYPE_INDEX } from "./types";

type MetaFile = { meta: Meta; insights: Insights; regions: Region[] };
type OdFile = {
  od: [number, number, number, number[]][];
  hours: [number, number, number[]][];
  via: [number, number, number, number][];
  histograms: Analysis["histograms"];
};

export function pairKey(o: number, d: number) {
  return `${o},${d}`;
}

export async function loadAnalysis(): Promise<Analysis> {
  const [metaRes, odRes, geoRes] = await Promise.all([
    fetch("/data/meta.json"),
    fetch("/data/od.json"),
    fetch("/data/regions.geojson"),
  ]);
  if (!metaRes.ok || !odRes.ok || !geoRes.ok) {
    throw new Error("Could not load analysis data");
  }
  const metaFile = (await metaRes.json()) as MetaFile;
  const odFile = (await odRes.json()) as OdFile;
  const geojson = (await geoRes.json()) as GeoJSON.FeatureCollection;

  const n = metaFile.regions.length;
  const matrix = new Float64Array(n * n);
  const od: OdRow[] = odFile.od.map(([o, d, v, types]) => {
    matrix[o * n + d] = v;
    return { o, d, v, types: [types[0] ?? 0, types[1] ?? 0, types[2] ?? 0, types[3] ?? 0] };
  });

  const hoursByPair = new Map<string, number[]>();
  for (const [o, d, hs] of odFile.hours) {
    hoursByPair.set(
      pairKey(o, d),
      hs.map((x) => x / 1000),
    );
  }

  const via: ViaRow[] = odFile.via.map(([o, d, v, val]) => ({ o, d, v, val }));
  const viaByPair = new Map<string, ViaRow[]>();
  for (const row of via) {
    const k = pairKey(row.o, row.d);
    const list = viaByPair.get(k);
    if (list) list.push(row);
    else viaByPair.set(k, [row]);
  }

  const histograms = odFile.histograms as {
    hours: Histogram;
    length: Histogram;
    duration: Histogram;
    speed: Histogram;
  };

  return {
    meta: metaFile.meta,
    insights: metaFile.insights,
    regions: metaFile.regions,
    od,
    matrix,
    hoursByPair,
    via,
    viaByPair,
    histograms,
    geojson,
  };
}

export function odValue(matrix: Float64Array, n: number, o: number, d: number): number {
  return matrix[o * n + d] ?? 0;
}

export function regionLabel(region: Region, mode: "en" | "ar"): string {
  return mode === "en" ? region.en : region.name;
}

export function quantileBreaks(values: number[], k = 6): number[] {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return Array.from({ length: k - 1 }, () => 0);
  const breaks: number[] = [];
  for (let i = 1; i < k; i++) {
    const q = i / k;
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    breaks.push(sorted[idx] ?? 0);
  }
  return breaks;
}

export function binIndex(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value > breaks[i]!) i++;
  return i;
}

export function metricOf(region: Region, metric: Metric): number {
  return region[metric];
}

export function flowValue(row: OdRow, types: TripType[]): number {
  if (types.length === 0) return 0;
  if (types.length === ALL_TRIP_TYPES.length) return row.v;
  let sum = 0;
  for (const t of types) sum += row.types[TYPE_INDEX[t]] ?? 0;
  return sum;
}

export function tripTypeMix(analysis: Analysis, types: TripType[]): Record<TripType, number> {
  const totals: Record<TripType, number> = {
    contained: 0,
    inbound: 0,
    outbound: 0,
    through: 0,
  };
  if (types.length === 0) return totals;

  for (const row of analysis.od) {
    for (const type of types) {
      totals[type] += row.types[TYPE_INDEX[type]] ?? 0;
    }
  }
  return totals;
}

export function pairTypeMix(row: OdRow, types: TripType[]): Record<TripType, number> {
  const totals: Record<TripType, number> = {
    contained: 0,
    inbound: 0,
    outbound: 0,
    through: 0,
  };
  if (types.length === 0) return totals;

  for (const type of types) {
    totals[type] = row.types[TYPE_INDEX[type]] ?? 0;
  }
  return totals;
}

export type RegionAgg = {
  origin: number[];
  dest: number[];
  internal: number[];
  touch: number[];
};

export function aggregateRegions(analysis: Analysis, types: TripType[]): RegionAgg {
  const n = analysis.regions.length;
  if (types.length === ALL_TRIP_TYPES.length) {
    return {
      origin: analysis.regions.map((r) => r.origin),
      dest: analysis.regions.map((r) => r.dest),
      internal: analysis.regions.map((r) => r.internal),
      touch: analysis.regions.map((r) => r.touch),
    };
  }
  const origin = Array.from({ length: n }, () => 0);
  const dest = Array.from({ length: n }, () => 0);
  const internal = Array.from({ length: n }, () => 0);
  for (const row of analysis.od) {
    const v = flowValue(row, types);
    if (v <= 0) continue;
    origin[row.o]! += v;
    dest[row.d]! += v;
    if (row.o === row.d) internal[row.o]! += v;
  }
  const touch = origin.map((o, i) => o + (dest[i] ?? 0) - (internal[i] ?? 0));
  return { origin, dest, internal, touch };
}

export function aggMetric(agg: RegionAgg, region: Region, metric: Metric): number {
  if (metric === "via") return region.via;
  if (metric === "origin") return agg.origin[region.id] ?? 0;
  if (metric === "dest") return agg.dest[region.id] ?? 0;
  return agg.touch[region.id] ?? 0;
}

export function buildFilteredMatrix(analysis: Analysis, types: TripType[]): Float64Array {
  if (types.length === ALL_TRIP_TYPES.length) return analysis.matrix;
  const n = analysis.regions.length;
  const m = new Float64Array(n * n);
  for (const row of analysis.od) {
    m[row.o * n + row.d] = flowValue(row, types);
  }
  return m;
}

export type SankeyData = {
  nodes: { name: string; id: number; side: "origin" | "dest" }[];
  links: { source: number; target: number; value: number; o: number; d: number }[];
  originCount: number;
};

export function buildSankey(
  analysis: Analysis,
  types: TripType[],
  limit: number,
  mode: "en" | "ar",
): SankeyData {
  const agg = aggregateRegions(analysis, types);
  const ranked = [...analysis.regions]
    .sort((a, b) => (agg.touch[b.id] ?? 0) - (agg.touch[a.id] ?? 0))
    .slice(0, limit);
  const ids = ranked.map((r) => r.id);
  const idSet = new Set(ids);
  const n = analysis.regions.length;
  const matrix = buildFilteredMatrix(analysis, types);

  const nodes: SankeyData["nodes"] = [
    ...ranked.map((r) => ({ name: regionLabel(r, mode), id: r.id, side: "origin" as const })),
    ...ranked.map((r) => ({ name: regionLabel(r, mode), id: r.id, side: "dest" as const })),
  ];

  const raw: SankeyData["links"] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      const o = ids[i]!;
      const d = ids[j]!;
      if (!idSet.has(o) || !idSet.has(d)) continue;
      const value = matrix[o * n + d] ?? 0;
      if (value < 0.04) continue;
      raw.push({ source: i, target: ids.length + j, value, o, d });
    }
  }
  raw.sort((a, b) => b.value - a.value);
  return { nodes, links: raw.slice(0, Math.min(48, limit * 6)), originCount: ids.length };
}
