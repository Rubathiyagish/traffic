import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Analysis } from "@/lib/od/types";
import { flowValue, pairKey, regionLabel } from "@/lib/od/load";
import { useOdStore } from "@/lib/od/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MiniHistogram } from "./histograms";
import { OdMap } from "./od-map";
import { TypeMixBar } from "./trip-types";
import { fmtPct } from "@/lib/utils";

export function FlowsExplorer({ analysis }: { analysis: Analysis }) {
  const [drawer, setDrawer] = useState(false);
  const origins = useOdStore((s) => s.origins);
  const dests = useOdStore((s) => s.dests);
  const vias = useOdStore((s) => s.vias);
  const toggleRole = useOdStore((s) => s.toggleRole);
  const search = useOdStore((s) => s.search);
  const selectedId = useOdStore((s) => s.selectedId);
  const labelMode = useOdStore((s) => s.labelMode);
  const minFlow = useOdStore((s) => s.minFlow);
  const tripTypes = useOdStore((s) => s.tripTypes);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = analysis.regions;
    if (q) {
      list = list.filter((r) => r.en.toLowerCase().includes(q) || r.name.includes(search.trim()));
    }
    return [...list].sort((a, b) => b.touch - a.touch).slice(0, 50);
  }, [analysis.regions, search]);

  const flows = useMemo(() => {
    const oSet = new Set(origins);
    const dSet = new Set(dests);
    const vSet = new Set(vias);
    const rows: { o: number; d: number; v: number }[] = [];
    for (const row of analysis.od) {
      const v = flowValue(row, tripTypes);
      if (v < minFlow) continue;
      if (row.o === row.d) continue;
      if (oSet.size && !oSet.has(row.o)) continue;
      if (dSet.size && !dSet.has(row.d)) continue;
      if (vSet.size) {
        const list = analysis.viaByPair.get(pairKey(row.o, row.d)) ?? [];
        const ids = new Set(list.map((x) => x.v));
        let ok = true;
        for (const vid of vSet) {
          if (!ids.has(vid)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      rows.push({ o: row.o, d: row.d, v });
    }
    return rows.sort((a, b) => b.v - a.v);
  }, [analysis.od, analysis.viaByPair, origins, dests, vias, minFlow, tripTypes]);

  const pairHours = useMemo(() => {
    if (origins.length === 1 && dests.length === 1) {
      const hs = analysis.hoursByPair.get(`${origins[0]},${dests[0]}`);
      if (hs) return { labels: Array.from({ length: 24 }, (_, i) => i), values: hs, unit: "h" };
    }
    if (origins.length === 1) {
      const acc = new Array(24).fill(0) as number[];
      for (const d of dests.length ? dests : analysis.regions.map((r) => r.id)) {
        const hs = analysis.hoursByPair.get(`${origins[0]},${d}`);
        if (!hs) continue;
        for (let i = 0; i < 24; i++) acc[i] += hs[i] ?? 0;
      }
      return { labels: Array.from({ length: 24 }, (_, i) => i), values: acc, unit: "h" };
    }
    return analysis.histograms.hours;
  }, [analysis, origins, dests]);

  const pairShare = useMemo(() => flows.reduce((s, f) => s + f.v, 0), [flows]);

  const viaForPair = useMemo(() => {
    if (origins.length !== 1 || dests.length !== 1) return [];
    return (analysis.viaByPair.get(`${origins[0]},${dests[0]}`) ?? [])
      .slice()
      .sort((a, b) => b.val - a.val)
      .slice(0, 8);
  }, [analysis.viaByPair, origins, dests]);

  const pairRow =
    origins.length === 1 && dests.length === 1
      ? analysis.od.find((r) => r.o === origins[0] && r.d === dests[0])
      : undefined;

  const scenario = (
    <ScenarioPanel analysis={analysis} filtered={filtered} onClose={() => setDrawer(false)} />
  );

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-surface md:flex">{scenario}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-52 flex-1">
          <OdMap analysis={analysis} flows={flows} />
          <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border border-border bg-surface/90 px-3 py-2 text-xs backdrop-blur-sm">
            <span className="text-muted">{flows.length} flows</span>
            <span className="tabular mx-2 text-fg">{fmtPct(pairShare)}</span>
            <span className="text-subtle">of all trips</span>
          </div>
          <button
            type="button"
            className="absolute top-3 right-3 z-10 flex h-10 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-xs text-fg md:hidden"
            onClick={() => setDrawer(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            Scenario
          </button>
          {selectedId != null ? (
            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1 rounded-md border border-border bg-surface/95 p-2 backdrop-blur-sm md:hidden">
              <span className="mr-1 max-w-36 truncate self-center text-xs" dir="auto">
                {regionLabel(analysis.regions[selectedId]!, labelMode)}
              </span>
              <Button size="sm" variant="origin" onClick={() => toggleRole(selectedId, "origin")}>
                Origin
              </Button>
              <Button size="sm" variant="dest" onClick={() => toggleRole(selectedId, "dest")}>
                Dest
              </Button>
              <Button size="sm" variant="via" onClick={() => toggleRole(selectedId, "via")}>
                Via
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid max-h-[46%] grid-cols-1 gap-3 overflow-y-auto border-t border-border bg-bg p-3 md:grid-cols-2 xl:grid-cols-4">
          {pairRow ? (
            <div className="rounded-md border border-border bg-surface p-3 md:col-span-2 xl:col-span-4">
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Pair mix</h3>
              <TypeMixBar
                contained={pairRow.types[0]}
                inbound={pairRow.types[1]}
                outbound={pairRow.types[2]}
                through={pairRow.types[3]}
              />
            </div>
          ) : null}
          <MiniHistogram title="Start hour" histogram={pairHours} />
          <MiniHistogram title="Trip length" histogram={analysis.histograms.length} maxBars={20} />
          <MiniHistogram title="Duration" histogram={analysis.histograms.duration} maxBars={18} />
          <MiniHistogram title="Average speed" histogram={analysis.histograms.speed} maxBars={18} />
          {viaForPair.length ? (
            <div className="rounded-md border border-border bg-surface p-3 md:col-span-2 xl:col-span-4">
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                Via regions on this pair
              </h3>
              <div className="flex flex-wrap gap-2">
                {viaForPair.map((row) => (
                  <button
                    key={row.v}
                    type="button"
                    onClick={() => toggleRole(row.v, "via")}
                    className="h-9 rounded-sm border border-border bg-raised px-2 text-xs hover:bg-hover"
                  >
                    <span dir="auto">{regionLabel(analysis.regions[row.v]!, labelMode)}</span>
                    <span className="tabular ml-2 text-accent">{fmtPct(row.val)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/60"
            aria-label="Close scenario"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[min(88svh,720px)] flex-col rounded-t-xl border border-border bg-surface">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
            <div className="min-h-0 flex-1 overflow-hidden">{scenario}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScenarioPanel({
  analysis,
  filtered,
  onClose,
}: {
  analysis: Analysis;
  filtered: Analysis["regions"];
  onClose: () => void;
}) {
  const origins = useOdStore((s) => s.origins);
  const dests = useOdStore((s) => s.dests);
  const vias = useOdStore((s) => s.vias);
  const toggleRole = useOdStore((s) => s.toggleRole);
  const clearRoles = useOdStore((s) => s.clearRoles);
  const search = useOdStore((s) => s.search);
  const setSearch = useOdStore((s) => s.setSearch);
  const selectedId = useOdStore((s) => s.selectedId);
  const setSelected = useOdStore((s) => s.setSelected);
  const labelMode = useOdStore((s) => s.labelMode);
  const minFlow = useOdStore((s) => s.minFlow);
  const setMinFlow = useOdStore((s) => s.setMinFlow);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Scenario</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={clearRoles}>
              Reset
            </Button>
            <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <RoleGroup title="Origins" ids={origins} analysis={analysis} onRemove={(id) => toggleRole(id, "origin")} />
        <RoleGroup title="Destinations" ids={dests} analysis={analysis} onRemove={(id) => toggleRole(id, "dest")} />
        <RoleGroup title="Via" ids={vias} analysis={analysis} onRemove={(id) => toggleRole(id, "via")} />
        <p className="mt-2 text-xs text-subtle">
          Mark districts as origin, destination, or via. Via keeps only trips that passed through every selected
          waypoint. Click the map to assign origin, then destination.
        </p>
        <label className="mt-3 block text-xs text-muted">
          Minimum flow {fmtPct(minFlow, 2)}
          <input
            type="range"
            min={0.02}
            max={1}
            step={0.02}
            value={minFlow}
            onChange={(e) => setMinFlow(Number(e.target.value))}
            className="mt-1 w-full accent-accent"
          />
        </label>
      </div>
      <Separator />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search districts"
          className="mb-2 h-10"
        />
        {selectedId != null ? (
          <div className="mb-3 rounded-md border border-border bg-raised p-2">
            <div className="text-xs text-muted">Selected</div>
            <div className="truncate text-sm" dir="auto">
              {regionLabel(analysis.regions[selectedId]!, labelMode)}
            </div>
            <div className="mt-2 flex gap-1">
              <Button size="sm" variant="origin" onClick={() => toggleRole(selectedId, "origin")}>
                Origin
              </Button>
              <Button size="sm" variant="dest" onClick={() => toggleRole(selectedId, "dest")}>
                Dest
              </Button>
              <Button size="sm" variant="via" onClick={() => toggleRole(selectedId, "via")}>
                Via
              </Button>
            </div>
          </div>
        ) : null}
        <ul>
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-hover ${selectedId === r.id ? "bg-hover" : ""}`}
              >
                <span className="truncate" dir="auto">
                  {regionLabel(r, labelMode)}
                </span>
                <span className="tabular text-xs text-subtle">{fmtPct(r.touch)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RoleGroup({
  title,
  ids,
  analysis,
  onRemove,
}: {
  title: string;
  ids: number[];
  analysis: Analysis;
  onRemove: (id: number) => void;
}) {
  const labelMode = useOdStore((s) => s.labelMode);
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs text-muted">{title}</div>
      {ids.length === 0 ? (
        <div className="text-xs text-subtle">None — select a district on the map or list</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <span
              key={id}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-raised px-2 text-xs"
            >
              <span dir="auto" className="max-w-36 truncate">
                {regionLabel(analysis.regions[id]!, labelMode)}
              </span>
              <button type="button" onClick={() => onRemove(id)} className="text-subtle hover:text-fg">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
