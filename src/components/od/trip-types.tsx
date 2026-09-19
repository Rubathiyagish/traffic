import { ALL_TRIP_TYPES, TRIP_TYPES, type TripType } from "@/lib/od/types";
import { useOdStore } from "@/lib/od/store";
import { cn } from "@/lib/utils";

export function TripTypeFilter({ compact = false }: { compact?: boolean }) {
  const tripTypes = useOdStore((s) => s.tripTypes);
  const toggleTripType = useOdStore((s) => s.toggleTripType);
  const setTripTypes = useOdStore((s) => s.setTripTypes);
  const allOn = tripTypes.length === ALL_TRIP_TYPES.length;

  return (
    <div className="flex items-center gap-1 overflow-x-auto" aria-label="Trip types">
      <button
        type="button"
        onClick={() => setTripTypes([...ALL_TRIP_TYPES])}
        className={cn(
          "h-9 shrink-0 rounded-sm px-2.5 text-xs transition-[color,background-color] duration-150",
          allOn ? "bg-raised text-fg" : "text-muted hover:text-fg",
        )}
      >
        All
      </button>
      {TRIP_TYPES.map((t) => {
        const on = tripTypes.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            onClick={() => toggleTripType(t.id)}
            className={cn(
              "h-9 shrink-0 rounded-sm border px-2.5 text-xs transition-[color,background-color,border-color] duration-150",
              on
                ? cn("border-transparent text-bg", chipOn(t.id))
                : "border-border text-muted hover:text-fg",
            )}
          >
            {compact ? t.label.slice(0, 3) : t.label}
          </button>
        );
      })}
    </div>
  );
}

function chipOn(id: TripType) {
  if (id === "contained") return "bg-accent";
  if (id === "inbound") return "bg-role-o";
  if (id === "outbound") return "bg-role-d";
  return "bg-role-v";
}

export function TypeMixBar({
  contained,
  inbound,
  outbound,
  through,
}: {
  contained: number;
  inbound: number;
  outbound: number;
  through: number;
}) {
  const total = contained + inbound + outbound + through || 1;
  const parts: { id: TripType; v: number; className: string }[] = [
    { id: "contained", v: contained, className: "bg-accent" },
    { id: "inbound", v: inbound, className: "bg-role-o" },
    { id: "outbound", v: outbound, className: "bg-role-d" },
    { id: "through", v: through, className: "bg-role-v" },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-hover">
        {parts.map((p) => (
          <div
            key={p.id}
            className={p.className}
            style={{ width: `${(p.v / total) * 100}%` }}
            title={`${p.id} ${p.v.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {TRIP_TYPES.map((t, i) => (
          <div key={t.id} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted">
              <span className={cn("size-2 rounded-xs", parts[i]!.className)} />
              {t.label}
            </span>
            <span className="tabular text-fg">{parts[i]!.v.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
