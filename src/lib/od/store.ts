import { create } from "zustand";
import type { LabelMode, Metric, TripType, ViewId } from "./types";
import { ALL_TRIP_TYPES } from "./types";

type OdStore = {
  view: ViewId;
  metric: Metric;
  labelMode: LabelMode;
  selectedId: number | null;
  hoveredId: number | null;
  origins: number[];
  dests: number[];
  vias: number[];
  search: string;
  minFlow: number;
  matrixLimit: number;
  sankeyLimit: number;
  tripTypes: TripType[];
  showArcs: boolean;
  showLabels: boolean;
  setView: (view: ViewId) => void;
  setMetric: (metric: Metric) => void;
  setLabelMode: (mode: LabelMode) => void;
  setSelected: (id: number | null) => void;
  setHovered: (id: number | null) => void;
  toggleRole: (id: number, role: "origin" | "dest" | "via") => void;
  clearRoles: () => void;
  setSearch: (q: string) => void;
  setMinFlow: (n: number) => void;
  setMatrixLimit: (n: number) => void;
  setSankeyLimit: (n: number) => void;
  toggleTripType: (t: TripType) => void;
  setTripTypes: (types: TripType[]) => void;
  setShowArcs: (on: boolean) => void;
  setShowLabels: (on: boolean) => void;
  openPair: (o: number, d: number) => void;
};

export const useOdStore = create<OdStore>((set) => ({
  view: "overview",
  metric: "touch",
  labelMode: "en",
  selectedId: null,
  hoveredId: null,
  origins: [],
  dests: [],
  vias: [],
  search: "",
  minFlow: 0.15,
  matrixLimit: 40,
  sankeyLimit: 8,
  tripTypes: [...ALL_TRIP_TYPES],
  showArcs: true,
  showLabels: false,
  setView: (view) => set({ view }),
  setMetric: (metric) => set({ metric }),
  setLabelMode: (labelMode) => set({ labelMode }),
  setSelected: (selectedId) => set({ selectedId }),
  setHovered: (hoveredId) => set({ hoveredId }),
  toggleRole: (id, role) =>
    set((s) => {
      const key = role === "origin" ? "origins" : role === "dest" ? "dests" : "vias";
      const list = s[key];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { [key]: next };
    }),
  clearRoles: () => set({ origins: [], dests: [], vias: [] }),
  setSearch: (search) => set({ search }),
  setMinFlow: (minFlow) => set({ minFlow }),
  setMatrixLimit: (matrixLimit) => set({ matrixLimit }),
  setSankeyLimit: (sankeyLimit) => set({ sankeyLimit }),
  toggleTripType: (t) =>
    set((s) => {
      const has = s.tripTypes.includes(t);
      if (has && s.tripTypes.length === 1) return s;
      return { tripTypes: has ? s.tripTypes.filter((x) => x !== t) : [...s.tripTypes, t] };
    }),
  setTripTypes: (tripTypes) => set({ tripTypes }),
  setShowArcs: (showArcs) => set({ showArcs }),
  setShowLabels: (showLabels) => set({ showLabels }),
  openPair: (o, d) =>
    set({
      view: "flows",
      origins: [o],
      dests: [d],
      vias: [],
      selectedId: o,
    }),
}));
