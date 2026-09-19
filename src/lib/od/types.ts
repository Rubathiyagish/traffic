export type ViewId = "overview" | "matrix" | "sankey" | "flows";
export type Metric = "touch" | "origin" | "dest" | "via";
export type LabelMode = "en" | "ar";
export type TripType = "contained" | "inbound" | "outbound" | "through";

export const TRIP_TYPES: { id: TripType; label: string; hint: string }[] = [
  { id: "contained", label: "Contained", hint: "Start and end inside Sharjah" },
  { id: "inbound", label: "Inbound", hint: "Enter the study area" },
  { id: "outbound", label: "Outbound", hint: "Leave the study area" },
  { id: "through", label: "Through", hint: "Pass through without stopping" },
];

export const TYPE_INDEX: Record<TripType, 0 | 1 | 2 | 3> = {
  contained: 0,
  inbound: 1,
  outbound: 2,
  through: 3,
};

export const ALL_TRIP_TYPES: TripType[] = ["contained", "inbound", "outbound", "through"];

export type Region = {
  id: number;
  name: string;
  en: string;
  lng: number;
  lat: number;
  area: number;
  origin: number;
  dest: number;
  internal: number;
  via: number;
  touch: number;
  imbalance: number;
};

export type Insights = {
  containedOrigin: number;
  containedDest: number;
  externalIn: number;
  externalOut: number;
  through: number;
  internalShare: number;
  busiest: { id: number; touch: number };
  topVia: { id: number; via: number };
  topEntry: { id: number; shareOfEntering: number };
  topExit: { id: number; shareOfExiting: number };
  imbalance: { id: number; origin: number; dest: number };
  topPair: { o: number; d: number; v: number };
};

export type Meta = {
  name: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  timeRange: string;
  zoneId: string;
  regionCount: number;
  pairCount: number;
  mapVersion: string;
  mapType: string;
  bbox: [number, number, number, number];
  types: { contained: number; inbound: number; outbound: number; through: number };
};

export type Histogram = { labels: number[]; values: number[]; unit?: string };

export type OdRow = { o: number; d: number; v: number; types: [number, number, number, number] };
export type ViaRow = { o: number; d: number; v: number; val: number };

export type Analysis = {
  meta: Meta;
  insights: Insights;
  regions: Region[];
  od: OdRow[];
  matrix: Float64Array;
  hoursByPair: Map<string, number[]>;
  via: ViaRow[];
  viaByPair: Map<string, ViaRow[]>;
  histograms: {
    hours: Histogram;
    length: Histogram;
    duration: Histogram;
    speed: Histogram;
  };
  geojson: GeoJSON.FeatureCollection;
};

export const HEAT = ["#1a2c36", "#214754", "#2b6874", "#3d8aa0", "#b9a888", "#e4d4bc"] as const;
