import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Histogram } from "@/lib/od/types";

type Props = {
  title: string;
  histogram: Histogram;
  maxBars?: number;
};

export function MiniHistogram({ title, histogram, maxBars = 24 }: Props) {
  const data = useMemo(() => {
    const labels = histogram.labels;
    const values = histogram.values;
    const n = Math.min(labels.length, values.length, maxBars);
    const step = Math.max(1, Math.ceil(labels.length / n));
    const out: { label: string; value: number }[] = [];
    for (let i = 0; i < labels.length; i += step) {
      let sum = 0;
      for (let j = i; j < Math.min(i + step, values.length); j++) sum += values[j] ?? 0;
      const lab = labels[i];
      out.push({ label: formatBin(lab, histogram.unit), value: sum });
    }
    return out;
  }, [histogram, maxBars]);

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h3>
        {histogram.unit ? <span className="text-xs text-subtle">{histogram.unit}</span> : null}
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#8b939e", fontSize: 9 }}
              interval="preserveStartEnd"
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(158,182,200,0.08)" }}
              contentStyle={{
                background: "#1c232e",
                border: "1px solid #2a3340",
                borderRadius: 8,
                fontSize: 12,
                color: "#e8eaed",
              }}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, "Share"]}
            />
            <Bar dataKey="value" fill="#3d8aa0" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatBin(label: number, unit?: string) {
  if (unit === "min" || unit === "km" || unit === "km/h") return String(label);
  return `${label}`;
}
