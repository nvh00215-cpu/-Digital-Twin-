"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/api";

export function SignalChart({
  points,
  dataKey,
  color,
  unit,
  label,
}: {
  points: SeriesPoint[];
  dataKey: "heart_rate_bpm" | "steps";
  color: string;
  unit: string;
  label: string;
}) {
  const data = points.map((point) => ({
    label: point.timestamp.slice(11, 16),
    value: point[dataKey],
  }));
  const latest = data.at(-1)?.value;
  return (
    <div>
      <div className="h-40 w-full" role="img" aria-label={`${label}. Latest ${latest ?? "unknown"} ${unit}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.14)" />
            <XAxis dataKey="label" tick={{ fill: "#8A8A90", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis tick={{ fill: "#8A8A90", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{
                background: "#1E1E20",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} ${unit}`, label]}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-secondary">
        Latest {label.toLowerCase()}: <span className="font-mono tabular-nums text-ink">{latest ?? "—"} {unit}</span>
      </p>
    </div>
  );
}
