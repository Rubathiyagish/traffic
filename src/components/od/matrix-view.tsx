import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis } from "@/lib/od/types";
import { HEAT } from "@/lib/od/types";
import { binIndex, buildFilteredMatrix, quantileBreaks, regionLabel } from "@/lib/od/load";
import { useOdStore } from "@/lib/od/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtPct } from "@/lib/utils";

export function MatrixView({ analysis }: { analysis: Analysis }) {
  const labelMode = useOdStore((s) => s.labelMode);
  const matrixLimit = useOdStore((s) => s.matrixLimit);
  const setMatrixLimit = useOdStore((s) => s.setMatrixLimit);
  const search = useOdStore((s) => s.search);
  const setSearch = useOdStore((s) => s.setSearch);
  const openPair = useOdStore((s) => s.openPair);
  const tripTypes = useOdStore((s) => s.tripTypes);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ o: number; d: number; x: number; y: number } | null>(null);

  const matrix = useMemo(() => buildFilteredMatrix(analysis, tripTypes), [analysis, tripTypes]);

  const ids = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...analysis.regions].sort((a, b) => b.touch - a.touch);
    if (q) {
      list = list.filter((r) => r.en.toLowerCase().includes(q) || r.name.includes(search.trim()));
    }
    return list.slice(0, matrixLimit).map((r) => r.id);
  }, [analysis.regions, matrixLimit, search]);

  const nShow = ids.length;
  const cell = nShow > 60 ? 8 : nShow > 40 ? 12 : 16;
  const labelW = 118;
  const values = useMemo(() => {
    const out: number[] = [];
    const n = analysis.regions.length;
    for (const o of ids) for (const d of ids) out.push(matrix[o * n + d] ?? 0);
    return out;
  }, [matrix, analysis.regions.length, ids]);
  const breaks = useMemo(() => quantileBreaks(values, 6), [values]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = labelW + nShow * cell;
    const h = labelW + nShow * cell;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, w, h);
    const n = analysis.regions.length;
    for (let i = 0; i < nShow; i++) {
      for (let j = 0; j < nShow; j++) {
        const o = ids[i]!;
        const d = ids[j]!;
        const v = matrix[o * n + d] ?? 0;
        ctx.fillStyle = v <= 0 ? "#151a22" : HEAT[binIndex(v, breaks)]!;
        ctx.fillRect(labelW + j * cell, labelW + i * cell, cell - 0.6, cell - 0.6);
      }
    }
    ctx.fillStyle = "#8b939e";
    ctx.font = "10px IBM Plex Sans, sans-serif";
    ctx.textBaseline = "middle";
    for (let i = 0; i < nShow; i++) {
      const r = analysis.regions[ids[i]!]!;
      const name = regionLabel(r, labelMode);
      ctx.save();
      ctx.translate(labelW + i * cell + cell / 2, labelW - 6);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(truncate(name, 16), 0, 0);
      ctx.restore();
      ctx.textAlign = "right";
      ctx.fillText(truncate(name, 16), labelW - 6, labelW + i * cell + cell / 2);
    }
  }, [analysis, ids, nShow, cell, labelW, labelMode, breaks, matrix]);

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const j = Math.floor((x - labelW) / cell);
    const i = Math.floor((y - labelW) / cell);
    if (i < 0 || j < 0 || i >= nShow || j >= nShow) {
      setHover(null);
      return;
    }
    const wrap = wrapRef.current;
    const left = wrap ? e.currentTarget.offsetLeft : 0;
    const top = wrap ? e.currentTarget.offsetTop : 0;
    setHover({ o: ids[i]!, d: ids[j]!, x: left + x, y: top + y });
  }

  const hoverVal =
    hover != null ? (matrix[hover.o * analysis.regions.length + hover.d] ?? 0) : 0;

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter regions"
          className="h-10 max-w-xs"
        />
        <div className="flex rounded-sm border border-border p-0.5">
          {[24, 40, 60, analysis.regions.length].map((lim) => (
            <button
              key={lim}
              type="button"
              onClick={() => setMatrixLimit(lim)}
              className={`h-9 rounded-xs px-2.5 text-xs ${matrixLimit === lim ? "bg-raised text-fg" : "text-muted"}`}
            >
              {lim === analysis.regions.length ? "All" : `Top ${lim}`}
            </button>
          ))}
        </div>
        <span className="text-xs text-subtle">Rows = origin · columns = destination · % of all trips</span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => exportCsv(analysis, ids, labelMode, matrix)}
        >
          Export CSV
        </Button>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-auto p-4">
        <canvas
          ref={canvasRef}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={() => {
            if (hover) openPair(hover.o, hover.d);
          }}
          className="cursor-crosshair"
        />
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded-sm border border-border bg-raised px-3 py-2 text-xs shadow-lg"
            style={{ left: hover.x + 16, top: hover.y + 16 }}
          >
            <div dir="auto">{regionLabel(analysis.regions[hover.o]!, labelMode)}</div>
            <div className="text-subtle">to</div>
            <div dir="auto">{regionLabel(analysis.regions[hover.d]!, labelMode)}</div>
            <div className="tabular mt-1 text-accent">{fmtPct(hoverVal, 3)}</div>
            <div className="text-subtle">Click to open in Flows Explorer</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function exportCsv(analysis: Analysis, ids: number[], mode: "en" | "ar", matrix: Float64Array) {
  const n = analysis.regions.length;
  const names = ids.map((id) => regionLabel(analysis.regions[id]!, mode).replaceAll(",", " "));
  const lines = [",".concat(names.join(","))];
  for (let i = 0; i < ids.length; i++) {
    const row = [names[i]];
    for (let j = 0; j < ids.length; j++) {
      row.push((matrix[ids[i]! * n + ids[j]!] ?? 0).toFixed(4));
    }
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sharjah-od-matrix.csv";
  a.click();
  URL.revokeObjectURL(url);
}
