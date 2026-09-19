import { ArrowDownRight, ArrowUpRight, GitFork, MapPin, Scale } from "lucide-react";
import type { Analysis, Region } from "@/lib/od/types";
import { aggMetric, aggregateRegions, buildFilteredMatrix, quantileBreaks, regionLabel } from "@/lib/od/load";
import { useOdStore } from "@/lib/od/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { fmtPct } from "@/lib/utils";
import { HEAT } from "@/lib/od/types";
import { binIndex, flowValue } from "@/lib/od/load";
import { MiniHistogram } from "./histograms";
import { TypeMixBar } from "./trip-types";

export function OverviewPanel({ analysis }: { analysis: Analysis }) {
  const metric = useOdStore((s) => s.metric);
  const setMetric = useOdStore((s) => s.setMetric);
  const selectedId = useOdStore((s) => s.selectedId);
  const setSelected = useOdStore((s) => s.setSelected);
  const labelMode = useOdStore((s) => s.labelMode);
  const openPair = useOdStore((s) => s.openPair);
  const tripTypes = useOdStore((s) => s.tripTypes);
  const search = useOdStore((s) => s.search);
  const setSearch = useOdStore((s) => s.setSearch);
  const { insights, regions, meta } = analysis;
  const agg = aggregateRegions(analysis, tripTypes);

  const q = search.trim().toLowerCase();
  const ranked = [...regions]
    .filter((r) => !q || r.en.toLowerCase().includes(q) || r.name.includes(search.trim()))
    .sort((a, b) => aggMetric(agg, b, metric) - aggMetric(agg, a, metric));
  const values = regions.map((r) => aggMetric(agg, r, metric));
  const breaks = quantileBreaks(values);
  const selected = selectedId != null ? regions[selectedId] : null;

  const topInter = [...analysis.od]
    .filter((r) => r.o !== r.d)
    .sort((a, b) => flowValue(b, tripTypes) - flowValue(a, tripTypes))[0];

  const imb = regions[insights.imbalance.id];

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <section>
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Insights</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Contained origin" value={fmtPct(insights.containedOrigin)} hint="Starts and stays inside" />
          <Stat label="Contained dest" value={fmtPct(insights.containedDest)} hint="Ends inside the study area" />
          <Stat label="External in" value={fmtPct(insights.externalIn)} hint="Enter from outside" />
          <Stat label="External out" value={fmtPct(insights.externalOut)} hint="Leave the study area" />
          <Stat label="Through traffic" value={fmtPct(insights.through)} hint="Pass through without stopping" />
          <Stat label="Internal trips" value={fmtPct(insights.internalShare)} hint="Origin equals destination" />
        </div>
      </section>

      {selected ? <RegionDetail region={selected} analysis={analysis} /> : null}

      <section>
        <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Trip mix</h2>
        <TypeMixBar
          contained={meta.types.contained}
          inbound={meta.types.inbound}
          outbound={meta.types.outbound}
          through={meta.types.through}
        />
      </section>

      <Separator />

      <section className="space-y-1 text-sm">
        <InsightRow
          icon={<MapPin className="size-3.5" />}
          label="Busiest region"
          region={regions[insights.busiest.id]}
          value={fmtPct(insights.busiest.touch)}
          mode={labelMode}
          onClick={() => setSelected(insights.busiest.id)}
        />
        <InsightRow
          icon={<GitFork className="size-3.5" />}
          label="Top via region"
          region={regions[insights.topVia.id]}
          value={fmtPct(insights.topVia.via)}
          mode={labelMode}
          onClick={() => setSelected(insights.topVia.id)}
        />
        <InsightRow
          icon={<ArrowDownRight className="size-3.5" />}
          label="Top entry gateway"
          region={regions[insights.topEntry.id]}
          value={`${insights.topEntry.shareOfEntering.toFixed(1)}% of inbound`}
          mode={labelMode}
          onClick={() => setSelected(insights.topEntry.id)}
        />
        <InsightRow
          icon={<ArrowUpRight className="size-3.5" />}
          label="Top exit gateway"
          region={regions[insights.topExit.id]}
          value={`${insights.topExit.shareOfExiting.toFixed(1)}% of outbound`}
          mode={labelMode}
          onClick={() => setSelected(insights.topExit.id)}
        />
        {imb ? (
          <InsightRow
            icon={<Scale className="size-3.5" />}
            label={imb.dest > imb.origin ? "Strongest sink" : "Strongest source"}
            region={imb}
            value={`${fmtPct(imb.origin)} → ${fmtPct(imb.dest)}`}
            mode={labelMode}
            onClick={() => setSelected(imb.id)}
          />
        ) : null}
        {topInter ? (
          <button
            type="button"
            className="flex min-h-11 w-full flex-col gap-0.5 rounded-sm px-1 py-1.5 text-left hover:bg-hover"
            onClick={() => openPair(topInter.o, topInter.d)}
          >
            <span className="text-xs text-muted">Busiest O/D pair</span>
            <span className="text-sm text-fg">
              {regionLabel(regions[topInter.o]!, labelMode)}
              <span className="mx-1.5 text-subtle">→</span>
              {regionLabel(regions[topInter.d]!, labelMode)}
            </span>
            <span className="tabular text-xs text-accent">{fmtPct(flowValue(topInter, tripTypes))}</span>
          </button>
        ) : null}
      </section>

      <Separator />

      <section className="grid grid-cols-1 gap-2">
        <MiniHistogram title="Start hour" histogram={analysis.histograms.hours} />
        <MiniHistogram title="Trip length" histogram={analysis.histograms.length} maxBars={16} />
        <MiniHistogram title="Duration" histogram={analysis.histograms.duration} maxBars={14} />
        <MiniHistogram title="Average speed" histogram={analysis.histograms.speed} maxBars={14} />
      </section>

      <Separator />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Ranking</h2>
          <div className="flex rounded-sm border border-border p-0.5">
            {(["touch", "origin", "dest", "via"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`h-9 rounded-xs px-2 text-xs ${metric === m ? "bg-raised text-fg" : "text-muted"}`}
              >
                {m === "dest" ? "Dest" : m[0]!.toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search districts"
          className="mb-2 h-10"
        />
        <ol className="flex flex-col">
          {ranked.slice(0, 16).map((r, i) => {
            const v = aggMetric(agg, r, metric);
            const color = HEAT[binIndex(v, breaks)] ?? HEAT[0];
            const active = selectedId === r.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-1 py-1.5 text-left ${active ? "bg-hover" : "hover:bg-hover"}`}
                >
                  <span className="tabular w-5 text-xs text-subtle">{i + 1}</span>
                  <span className="size-2.5 shrink-0 rounded-xs" style={{ background: color }} />
                  <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                    {regionLabel(r, labelMode)}
                  </span>
                  <span className="tabular text-xs text-muted">{fmtPct(v)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-subtle">
          Click a region to inspect it. {regions.length} districts · TomTom Move · {meta.mapType}{" "}
          {meta.mapVersion}.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border bg-raised p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 text-lg font-medium tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-subtle">{hint}</div>
    </div>
  );
}

function InsightRow({
  icon,
  label,
  region,
  value,
  mode,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  region?: Region;
  value: string;
  mode: "en" | "ar";
  onClick: () => void;
}) {
  if (!region) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-start gap-2 rounded-sm px-1 py-1.5 text-left hover:bg-hover"
    >
      <span className="mt-0.5 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block truncate text-sm" dir="auto">
          {regionLabel(region, mode)}
        </span>
      </span>
      <span className="tabular shrink-0 text-xs text-accent">{value}</span>
    </button>
  );
}

function RegionDetail({ region, analysis }: { region: Region; analysis: Analysis }) {
  const labelMode = useOdStore((s) => s.labelMode);
  const openPair = useOdStore((s) => s.openPair);
  const tripTypes = useOdStore((s) => s.tripTypes);
  const n = analysis.regions.length;
  const matrix = buildFilteredMatrix(analysis, tripTypes);
  const outgoing = analysis.regions
    .map((d) => ({ d, v: matrix[region.id * n + d.id] ?? 0 }))
    .filter((x) => x.v > 0 && x.d.id !== region.id)
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const incoming = analysis.regions
    .map((o) => ({ o, v: matrix[o.id * n + region.id] ?? 0 }))
    .filter((x) => x.v > 0 && x.o.id !== region.id)
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);

  return (
    <section className="rounded-lg border border-border bg-raised p-4">
      <div className="text-xs text-muted">Region detail</div>
      <h3 className="mt-1 text-base font-medium" dir="auto">
        {regionLabel(region, labelMode)}
      </h3>
      <p className="text-xs text-subtle" dir="auto">
        {labelMode === "en" ? region.name : region.en}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          Origin <span className="tabular float-right text-fg">{fmtPct(region.origin)}</span>
        </div>
        <div>
          Dest <span className="tabular float-right text-fg">{fmtPct(region.dest)}</span>
        </div>
        <div>
          Via <span className="tabular float-right text-fg">{fmtPct(region.via)}</span>
        </div>
        <div>
          Internal <span className="tabular float-right text-fg">{fmtPct(region.internal)}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs text-muted">Top destinations</div>
          {outgoing.map(({ d, v }) => (
            <button
              key={d.id}
              type="button"
              className="flex min-h-9 w-full items-center justify-between gap-2 py-0.5 text-left text-xs hover:text-accent"
              onClick={() => openPair(region.id, d.id)}
            >
              <span className="truncate" dir="auto">
                {regionLabel(d, labelMode)}
              </span>
              <span className="tabular text-muted">{fmtPct(v)}</span>
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs text-muted">Top origins</div>
          {incoming.map(({ o, v }) => (
            <button
              key={o.id}
              type="button"
              className="flex min-h-9 w-full items-center justify-between gap-2 py-0.5 text-left text-xs hover:text-accent"
              onClick={() => openPair(o.id, region.id)}
            >
              <span className="truncate" dir="auto">
                {regionLabel(o, labelMode)}
              </span>
              <span className="tabular text-muted">{fmtPct(v)}</span>
            </button>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => openPair(region.id, outgoing[0]?.d.id ?? region.id)}
      >
        Open in Flows Explorer
      </Button>
    </section>
  );
}
