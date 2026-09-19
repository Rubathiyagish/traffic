import { useEffect, useMemo, useState } from "react";
import { GitFork, LayoutGrid, Map as MapIcon, Waypoints } from "lucide-react";
import type { Analysis, ViewId } from "@/lib/od/types";
import { aggMetric, aggregateRegions, flowValue, loadAnalysis, quantileBreaks } from "@/lib/od/load";
import { useOdStore } from "@/lib/od/store";
import { OdMap } from "./od-map";
import { OverviewPanel } from "./overview-panel";
import { MatrixView } from "./matrix-view";
import { FlowsExplorer } from "./flows-explorer";
import { SankeyView } from "./sankey-view";
import { HeatLegend } from "./legend";
import { TripTypeFilter } from "./trip-types";
import { Button } from "@/components/ui/button";

const VIEWS: { id: ViewId; label: string; icon: typeof MapIcon }[] = [
  { id: "overview", label: "Overview", icon: MapIcon },
  { id: "matrix", label: "Matrix", icon: LayoutGrid },
  { id: "sankey", label: "Sankey", icon: GitFork },
  { id: "flows", label: "Flows", icon: Waypoints },
];

export function OdShell() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useOdStore((s) => s.view);
  const setView = useOdStore((s) => s.setView);
  const metric = useOdStore((s) => s.metric);
  const labelMode = useOdStore((s) => s.labelMode);
  const setLabelMode = useOdStore((s) => s.setLabelMode);
  const tripTypes = useOdStore((s) => s.tripTypes);
  const showArcs = useOdStore((s) => s.showArcs);
  const setShowArcs = useOdStore((s) => s.setShowArcs);

  useEffect(() => {
    loadAnalysis()
      .then(setAnalysis)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const overviewFlows = useMemo(() => {
    if (!analysis) return [];
    return analysis.od
      .filter((r) => r.o !== r.d)
      .map((r) => ({ o: r.o, d: r.d, v: flowValue(r, tripTypes) }))
      .filter((r) => r.v >= 0.28);
  }, [analysis, tripTypes]);

  const breaks = useMemo(() => {
    if (!analysis) return [];
    const agg = aggregateRegions(analysis, tripTypes);
    return quantileBreaks(analysis.regions.map((r) => aggMetric(agg, r, metric)));
  }, [analysis, metric, tripTypes]);

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg p-6 text-center">
        <div>
          <h1 className="text-lg font-medium">Sharjah Origins</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex min-h-svh flex-col bg-bg text-fg">
        <header className="border-b border-border px-4 py-3">
          <h1 className="text-sm font-semibold tracking-tight">Sharjah Origins</h1>
          <p className="text-xs text-muted">Origin–destination analysis · 176 districts · 5–11 Jul 2026</p>
        </header>
        <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_380px]">
          <div className="flex items-center justify-center">
            <p className="text-sm text-muted">Loading Sharjah analysis…</p>
          </div>
          <aside className="hidden border-l border-border p-4 md:block">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-md border border-border bg-raised" />
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const { meta } = analysis;

  return (
    <div className="flex h-svh flex-col bg-bg text-fg">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-sm font-semibold tracking-tight">Sharjah Origins</h1>
              <span className="hidden text-xs text-subtle sm:inline">O/D Analysis</span>
            </div>
            <p className="truncate text-xs text-muted">
              {formatDate(meta.startDate)} — {formatDate(meta.endDate)} · {meta.timeRange} · {meta.zoneId} ·{" "}
              {meta.regionCount} districts
            </p>
          </div>
          <nav className="flex rounded-sm border border-border p-0.5" aria-label="Visualizer">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`flex h-10 items-center gap-1.5 rounded-xs px-2.5 text-sm sm:px-3 ${active ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </nav>
          <Button size="sm" variant="secondary" onClick={() => setLabelMode(labelMode === "en" ? "ar" : "en")}>
            {labelMode === "en" ? "AR" : "EN"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TripTypeFilter compact />
          {view === "overview" ? (
            <button
              type="button"
              onClick={() => setShowArcs(!showArcs)}
              className={`h-9 rounded-sm border px-2.5 text-xs ${showArcs ? "border-accent text-fg" : "border-border text-muted"}`}
            >
              {showArcs ? "Hide flows" : "Show flows"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {view === "overview" ? (
          <>
            <div className="relative min-h-0 min-w-0 flex-1">
              <OdMap analysis={analysis} flows={overviewFlows} />
              <HeatLegend breaks={breaks} title={metricTitle(metric)} />
            </div>
            <aside className="h-[44%] shrink-0 overflow-y-auto border-t border-border bg-surface md:h-auto md:w-[min(100%,400px)] md:border-t-0 md:border-l">
              <OverviewPanel analysis={analysis} />
            </aside>
          </>
        ) : null}
        {view === "matrix" ? <MatrixView analysis={analysis} /> : null}
        {view === "sankey" ? <SankeyView analysis={analysis} /> : null}
        {view === "flows" ? <FlowsExplorer analysis={analysis} /> : null}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function metricTitle(m: string) {
  if (m === "origin") return "% of trips as origin";
  if (m === "dest") return "% of trips as destination";
  if (m === "via") return "% of trips via region";
  return "% of trips touching region";
}
