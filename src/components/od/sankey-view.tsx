import { useMemo } from "react";
import type { Analysis } from "@/lib/od/types";
import { buildSankey, regionLabel } from "@/lib/od/load";
import { useOdStore } from "@/lib/od/store";
import { fmtPct } from "@/lib/utils";

export function SankeyView({ analysis }: { analysis: Analysis }) {
  const labelMode = useOdStore((s) => s.labelMode);
  const tripTypes = useOdStore((s) => s.tripTypes);
  const sankeyLimit = useOdStore((s) => s.sankeyLimit);
  const setSankeyLimit = useOdStore((s) => s.setSankeyLimit);
  const openPair = useOdStore((s) => s.openPair);

  const data = useMemo(
    () => buildSankey(analysis, tripTypes, sankeyLimit, labelMode),
    [analysis, tripTypes, sankeyLimit, labelMode],
  );

  const layout = useMemo(() => layoutSankey(data), [data]);
  const total = data.links.reduce((s, l) => s + l.value, 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <p className="text-sm text-muted">Origins left · destinations right · width is share of all trips</p>
        <div className="flex rounded-sm border border-border p-0.5">
          {[6, 8, 10, 12].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSankeyLimit(n)}
              className={`h-9 rounded-xs px-3 text-xs ${sankeyLimit === n ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
            >
              Top {n}
            </button>
          ))}
        </div>
        <span className="tabular ml-auto text-xs text-subtle">{fmtPct(total)} in view</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {data.links.length === 0 ? (
          <div className="flex h-full min-h-64 items-center justify-center text-sm text-muted">
            No flows above the floor for this filter.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="mx-auto h-full w-full max-w-6xl"
            role="img"
            aria-label="Origin destination sankey"
          >
            {layout.links.map((l) => (
              <path
                key={`${l.o}-${l.d}`}
                d={l.dPath}
                fill="none"
                stroke="#3d8aa0"
                strokeOpacity={0.38}
                strokeWidth={l.thickness}
                className="cursor-pointer hover:stroke-accent"
                onClick={() => openPair(l.o, l.d)}
              >
                <title>
                  {regionLabel(analysis.regions[l.o]!, labelMode)} →{" "}
                  {regionLabel(analysis.regions[l.d]!, labelMode)} {fmtPct(l.value, 3)}
                </title>
              </path>
            ))}
            {layout.nodes.map((n) => (
              <g key={`${n.side}-${n.id}`}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={2}
                  fill={n.side === "origin" ? "#7ea8c4" : "#d6c4a8"}
                />
                <text
                  x={n.side === "origin" ? n.x - 8 : n.x + n.w + 8}
                  y={n.y + n.h / 2}
                  textAnchor={n.side === "origin" ? "end" : "start"}
                  dominantBaseline="middle"
                  fill="#e8eaed"
                  fontSize={12}
                >
                  {n.name.slice(0, 22)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

type LaidNode = {
  id: number;
  name: string;
  side: "origin" | "dest";
  x: number;
  y: number;
  w: number;
  h: number;
};

type LaidLink = {
  o: number;
  d: number;
  value: number;
  thickness: number;
  dPath: string;
};

function layoutSankey(data: ReturnType<typeof buildSankey>) {
  const width = 1100;
  const height = Math.max(520, data.originCount * 52);
  const nodeW = 12;
  const leftX = 160;
  const rightX = width - 160 - nodeW;
  const pad = 10;
  const origins = data.nodes.filter((n) => n.side === "origin");
  const dests = data.nodes.filter((n) => n.side === "dest");

  const originOut = new Map<number, number>();
  const destIn = new Map<number, number>();
  for (const l of data.links) {
    originOut.set(l.o, (originOut.get(l.o) ?? 0) + l.value);
    destIn.set(l.d, (destIn.get(l.d) ?? 0) + l.value);
  }

  function stack(
    list: typeof origins,
    values: Map<number, number>,
    x: number,
  ): LaidNode[] {
    const totals = list.map((n) => Math.max(values.get(n.id) ?? 0.04, 0.04));
    const sum = totals.reduce((a, b) => a + b, 0) || 1;
    const usable = height - pad * 2 - (list.length - 1) * 8;
    let y = pad;
    return list.map((n, i) => {
      const h = Math.max(10, (totals[i]! / sum) * usable);
      const node = { id: n.id, name: n.name, side: n.side, x, y, w: nodeW, h };
      y += h + 8;
      return node;
    });
  }

  const left = stack(origins, originOut, leftX);
  const right = stack(dests, destIn, rightX);
  const leftBy = new Map(left.map((n) => [n.id, n]));
  const rightBy = new Map(right.map((n) => [n.id, n]));
  const leftCursor = new Map(left.map((n) => [n.id, n.y]));
  const rightCursor = new Map(right.map((n) => [n.id, n.y]));
  const maxV = Math.max(...data.links.map((l) => l.value), 0.001);

  const links: LaidLink[] = data.links.map((l) => {
    const a = leftBy.get(l.o)!;
    const b = rightBy.get(l.d)!;
    const thickness = Math.max(2, (l.value / maxV) * Math.min(a.h, 28));
    const y1 = leftCursor.get(l.o)! + thickness / 2;
    const y2 = rightCursor.get(l.d)! + thickness / 2;
    leftCursor.set(l.o, leftCursor.get(l.o)! + thickness);
    rightCursor.set(l.d, rightCursor.get(l.d)! + thickness);
    const x1 = a.x + a.w;
    const x2 = b.x;
    const mid = (x1 + x2) / 2;
    const dPath = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
    return { o: l.o, d: l.d, value: l.value, thickness, dPath };
  });

  return { width, height, nodes: [...left, ...right], links };
}
