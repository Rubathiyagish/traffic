import { useLayoutEffect, useMemo, useRef } from "react";
import type { Analysis, Metric, Region, TripType } from "@/lib/od/types";
import { HEAT } from "@/lib/od/types";
import {
  aggMetric,
  aggregateRegions,
  binIndex,
  buildFilteredMatrix,
  quantileBreaks,
  regionLabel,
} from "@/lib/od/load";
import { flowArc } from "@/lib/od/arcs";
import { useOdStore } from "@/lib/od/store";

type Props = {
  analysis: Analysis;
  flows?: { o: number; d: number; v: number }[];
};

type View = { scale: number; tx: number; ty: number };

export function OdMap({ analysis, flows = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const fitted = useRef(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const hoverPx = useRef<{ x: number; y: number } | null>(null);

  const metric = useOdStore((s) => s.metric);
  const view = useOdStore((s) => s.view);
  const selectedId = useOdStore((s) => s.selectedId);
  const hoveredId = useOdStore((s) => s.hoveredId);
  const origins = useOdStore((s) => s.origins);
  const dests = useOdStore((s) => s.dests);
  const vias = useOdStore((s) => s.vias);
  const labelMode = useOdStore((s) => s.labelMode);
  const tripTypes = useOdStore((s) => s.tripTypes);
  const showArcs = useOdStore((s) => s.showArcs);
  const setSelected = useOdStore((s) => s.setSelected);
  const setHovered = useOdStore((s) => s.setHovered);
  const toggleRole = useOdStore((s) => s.toggleRole);

  const n = analysis.regions.length;
  const agg = useMemo(() => aggregateRegions(analysis, tripTypes), [analysis, tripTypes]);
  const matrix = useMemo(() => buildFilteredMatrix(analysis, tripTypes), [analysis, tripTypes]);
  const bbox = analysis.meta.bbox;

  const colorById = useMemo(() => {
    const colors: Record<number, string> = {};
    if (view === "flows" && origins.length === 1 && dests.length === 0) {
      const o = origins[0]!;
      const vals = analysis.regions.map((_, d) => matrix[o * n + d] ?? 0);
      const breaks = quantileBreaks(vals);
      for (const r of analysis.regions) {
        if (r.id === o) {
          colors[r.id] = "#7ea8c4";
          continue;
        }
        const v = matrix[o * n + r.id] ?? 0;
        colors[r.id] = v <= 0 ? "#151a22" : HEAT[binIndex(v, breaks)]!;
      }
      return colors;
    }
    if (view === "flows" && (origins.length || dests.length || vias.length)) {
      for (const r of analysis.regions) {
        if (origins.includes(r.id)) colors[r.id] = "#7ea8c4";
        else if (dests.includes(r.id)) colors[r.id] = "#d6c4a8";
        else if (vias.includes(r.id)) colors[r.id] = "#5f9b94";
        else colors[r.id] = "#1a222c";
      }
      if (origins.length === 1 && dests.length === 1) {
        const key = `${origins[0]},${dests[0]}`;
        const list = analysis.viaByPair.get(key) ?? [];
        const max = Math.max(...list.map((x) => x.val), 0.001);
        for (const row of list) {
          if (origins.includes(row.v) || dests.includes(row.v)) continue;
          const t = row.val / max;
          const idx = Math.min(5, Math.floor(t * 6));
          colors[row.v] = HEAT[idx]!;
        }
      }
      return colors;
    }
    const vals = analysis.regions.map((r) => aggMetric(agg, r, metric));
    const breaks = quantileBreaks(vals);
    for (const r of analysis.regions) {
      const v = aggMetric(agg, r, metric);
      colors[r.id] = v <= 0 ? "#151a22" : HEAT[binIndex(v, breaks)]!;
    }
    return colors;
  }, [analysis, metric, view, origins, dests, vias, n, agg, matrix]);

  const flowFc = useMemo(() => {
    if (view === "overview" && !showArcs) return [];
    const top = [...flows].sort((a, b) => b.v - a.v).slice(0, view === "overview" ? 48 : 80);
    const max = top[0]?.v ?? 1;
    return top
      .map((f) => {
        const a = analysis.regions[f.o];
        const b = analysis.regions[f.d];
        if (!a || !b || f.o === f.d) return null;
        const arc = flowArc(a, b);
        return { coords: arc.geometry.coordinates as [number, number][], width: 0.8 + (f.v / max) * 5.2 };
      })
      .filter((x): x is { coords: [number, number][]; width: number } => x != null);
  }, [flows, analysis.regions, showArcs, view]);

  const paths = useMemo(() => buildPaths(analysis.geojson), [analysis.geojson]);

  const labels = useMemo(() => {
    return [...analysis.regions]
      .sort((a, b) => (agg.touch[b.id] ?? 0) - (agg.touch[a.id] ?? 0))
      .slice(0, 12)
      .map((r) => ({ id: r.id, name: regionLabel(r, labelMode), lng: r.lng, lat: r.lat }));
  }, [analysis.regions, agg, labelMode]);

  const hovered = hoveredId != null ? analysis.regions[hoveredId] : null;

  function project(lng: number, lat: number, w: number, h: number, v: View): [number, number] {
    const [west, south, east, north] = bbox;
    const pad = 28;
    const x = pad + ((lng - west) / (east - west)) * (w - pad * 2);
    const y = pad + ((north - lat) / (north - south)) * (h - pad * 2);
    return [x * v.scale + v.tx, y * v.scale + v.ty];
  }

  function hitTest(px: number, py: number, w: number, h: number): number | null {
    const v = viewRef.current;
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i]!;
      if (pointInRings(px, py, p.rings, (lng, lat) => project(lng, lat, w, h, v))) return p.id;
    }
    return null;
  }

  function draw() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 8 || h < 8) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, w, h);

    const v = viewRef.current;
    if (!fitted.current) {
      fitted.current = true;
      viewRef.current = { scale: 1, tx: 0, ty: 0 };
    }

    for (const p of paths) {
      ctx.beginPath();
      for (const ring of p.rings) {
        ring.forEach(([lng, lat], i) => {
          const [x, y] = project(lng, lat, w, h, v);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = colorById[p.id] ?? "#1a2c36";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#0c0f14";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    const hi = hoveredId ?? selectedId;
    if (hi != null) {
      const p = paths.find((x) => x.id === hi);
      if (p) {
        ctx.beginPath();
        for (const ring of p.rings) {
          ring.forEach(([lng, lat], i) => {
            const [x, y] = project(lng, lat, w, h, v);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        ctx.strokeStyle = "#e8eaed";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const f of flowFc) {
      ctx.beginPath();
      f.coords.forEach(([lng, lat], i) => {
        const [x, y] = project(lng, lat, w, h, v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(158,182,200,0.72)";
      ctx.lineWidth = f.width;
      ctx.stroke();
    }

    ctx.font = "11px IBM Plex Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const lab of labels) {
      const [x, y] = project(lab.lng, lab.lat, w, h, v);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#0c0f14";
      ctx.strokeText(lab.name, x, y);
      ctx.fillStyle = "#e8eaed";
      ctx.fillText(lab.name, x, y);
    }
  }

  useLayoutEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.min(6, Math.max(0.7, v.scale * factor));
      const k = next / v.scale;
      viewRef.current = { scale: next, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k };
      draw();
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    const t = window.setTimeout(() => draw(), 50);
    return () => {
      ro.disconnect();
      wrap.removeEventListener("wheel", onWheel);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorById, flowFc, labels, hoveredId, selectedId, paths]);

  function toLocal(e: React.PointerEvent | React.WheelEvent) {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  }

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          const { x, y } = toLocal(e);
          drag.current = { x, y, tx: viewRef.current.tx, ty: viewRef.current.ty };
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const { x, y, w, h } = toLocal(e);
          hoverPx.current = { x, y };
          if (drag.current) {
            const dx = Math.abs(x - drag.current.x);
            const dy = Math.abs(y - drag.current.y);
            if (dx > 3 || dy > 3) {
              viewRef.current = {
                ...viewRef.current,
                tx: drag.current.tx + (x - drag.current.x),
                ty: drag.current.ty + (y - drag.current.y),
              };
              draw();
            }
            return;
          }
          const id = hitTest(x, y, w, h);
          if (id !== hoveredId) setHovered(id);
        }}
        onPointerUp={(e) => {
          const start = drag.current;
          drag.current = null;
          const { x, y, w, h } = toLocal(e);
          if (!start) return;
          if (Math.hypot(x - start.x, y - start.y) > 5) return;
          const id = hitTest(x, y, w, h);
          if (id == null) return;
          const store = useOdStore.getState();
          setSelected(id);
          if (store.view === "flows") {
            if (store.origins.length === 0) toggleRole(id, "origin");
            else if (store.dests.length === 0 && !store.origins.includes(id)) toggleRole(id, "dest");
          }
        }}
        onPointerLeave={() => {
          drag.current = null;
          setHovered(null);
        }}
      />
      <div className="absolute right-3 bottom-24 z-10 flex flex-col overflow-hidden rounded-sm border border-border bg-surface">
        <button
          type="button"
          className="flex size-10 items-center justify-center text-lg text-fg hover:bg-hover"
          onClick={() => {
            const wrap = wrapRef.current;
            if (!wrap) return;
            const x = wrap.clientWidth / 2;
            const y = wrap.clientHeight / 2;
            const v = viewRef.current;
            const next = Math.min(6, v.scale * 1.2);
            const k = next / v.scale;
            viewRef.current = { scale: next, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k };
            draw();
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center border-t border-border text-lg text-fg hover:bg-hover"
          onClick={() => {
            const wrap = wrapRef.current;
            if (!wrap) return;
            const x = wrap.clientWidth / 2;
            const y = wrap.clientHeight / 2;
            const v = viewRef.current;
            const next = Math.max(0.7, v.scale / 1.2);
            const k = next / v.scale;
            viewRef.current = { scale: next, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k };
            draw();
          }}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center border-t border-border text-xs text-muted hover:bg-hover hover:text-fg"
          onClick={() => {
            viewRef.current = { scale: 1, tx: 0, ty: 0 };
            draw();
          }}
          aria-label="Reset view"
        >
          Fit
        </button>
      </div>
      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 w-48 rounded-sm border border-border bg-raised px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min((hoverPx.current?.x ?? 16) + 14, (wrapRef.current?.clientWidth ?? 320) - 200),
            top: Math.min((hoverPx.current?.y ?? 16) + 14, (wrapRef.current?.clientHeight ?? 240) - 140),
          }}
        >
          <div className="font-medium" dir="auto">
            {regionLabel(hovered, labelMode)}
          </div>
          <div className="mb-1 text-subtle" dir="auto">
            {labelMode === "en" ? hovered.name : hovered.en}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular">
            <span className="text-muted">Touching</span>
            <span>{hovered.touch.toFixed(2)}%</span>
            <span className="text-muted">Origin</span>
            <span>{hovered.origin.toFixed(2)}%</span>
            <span className="text-muted">Destination</span>
            <span>{hovered.dest.toFixed(2)}%</span>
            <span className="text-muted">Via</span>
            <span>{hovered.via.toFixed(2)}%</span>
          </div>
          <div className="mt-1 text-[10px] text-subtle">{metricHint(metric, tripTypes)}</div>
        </div>
      ) : null}
    </div>
  );
}

function metricHint(m: Metric, _types: TripType[]) {
  if (m === "touch") return "Colored by trips touching the region";
  if (m === "origin") return "Colored by trip origins";
  if (m === "dest") return "Colored by trip destinations";
  return "Colored by through-traffic";
}

type Path = { id: number; rings: [number, number][][] };

function buildPaths(fc: GeoJSON.FeatureCollection): Path[] {
  const out: Path[] = [];
  for (const f of fc.features) {
    const id = Number((f.properties as { id?: number } | null)?.id);
    if (!Number.isFinite(id) || !f.geometry) continue;
    const rings: [number, number][][] = [];
    const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] };
    if (g.type === "Polygon") {
      for (const ring of g.coordinates as number[][][]) {
        rings.push(ring.map((c) => [c[0]!, c[1]!]));
      }
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as number[][][][]) {
        for (const ring of poly) rings.push(ring.map((c) => [c[0]!, c[1]!]));
      }
    }
    if (rings.length) out.push({ id, rings });
  }
  return out;
}

function pointInRings(
  px: number,
  py: number,
  rings: [number, number][][],
  proj: (lng: number, lat: number) => [number, number],
) {
  let inside = false;
  for (const ring of rings) {
    const pts = ring.map(([lng, lat]) => proj(lng, lat));
    if (pointInPoly(px, py, pts)) inside = !inside;
  }
  return inside;
}

function pointInPoly(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]![0];
    const yi = pts[i]![1];
    const xj = pts[j]![0];
    const yj = pts[j]![1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
