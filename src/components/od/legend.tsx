import { HEAT } from "@/lib/od/types";
import { fmtPct } from "@/lib/utils";

export function HeatLegend({
  breaks,
  title,
}: {
  breaks: number[];
  title: string;
}) {
  const edges = [0, ...breaks];
  return (
    <div className="pointer-events-none absolute right-3 bottom-10 z-10 w-44 rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm">
      <div className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{title}</div>
      <div className="flex flex-col gap-1">
        {HEAT.map((c, i) => {
          const lo = edges[i] ?? 0;
          const hi = edges[i + 1];
          const label = hi == null ? `${fmtPct(lo, 2)}+` : `${fmtPct(lo, 2)} – ${fmtPct(hi, 2)}`;
          return (
            <div key={c} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-xs"
                style={{ background: `var(--color-heat-${i})` }}
              />
              <span className="tabular text-xs text-muted">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
