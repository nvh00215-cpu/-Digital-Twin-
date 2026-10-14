"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PredictResponse } from "@/lib/api";

type Row = {
  label: string;
  glucose: number | null;
  forecast: number | null;
};

function rows(predict: PredictResponse): Row[] {
  const history: Row[] = predict.window.map((point) => ({
    label: point.timestamp.slice(11, 16),
    glucose: point.glucose_mg_dl,
    forecast: null,
  }));
  if (history.length > 0) {
    history[history.length - 1] = {
      ...history[history.length - 1],
      forecast: history[history.length - 1].glucose,
    };
  }
  for (const point of predict.curve) {
    history.push({
      label: `+${point.minutes}m`,
      glucose: null,
      forecast: point.glucose_mg_dl,
    });
  }
  return history;
}

export function GlucoseChart({ predict }: { predict: PredictResponse }) {
  const data = rows(predict);
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimate(!media.matches);
  }, []);

  const summary = predict.curve
    .map((point) => `${point.minutes} min ${point.glucose_mg_dl} mg/dL`)
    .join(", ");

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
          Recent glucose
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--chart-3)]" />
          Forecast
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-px w-4 border-t border-dashed border-[var(--status-danger)]" />
          180 mg/dL
        </span>
      </div>
      <div className="h-[280px] w-full" role="img" aria-label={`Glucose and 2-hour forecast. ${summary}. Threshold 180 mg/dL.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.14)" />
            <XAxis dataKey="label" tick={{ fill: "#8A8A90", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: "#8A8A90", fontSize: 11 }} axisLine={false} tickLine={false} width={40} unit="" />
            <Tooltip
              contentStyle={{
                background: "#1E1E20",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [`${value} mg/dL`, name === "glucose" ? "Glucose" : "Forecast"]}
            />
            <ReferenceLine y={180} stroke="#FF4D4F" strokeDasharray="4 4" label={{ value: "180", fill: "#8A8A90", fontSize: 11 }} />
            <Line type="monotone" dataKey="glucose" stroke="#F062C0" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={animate} />
            <Line type="monotone" dataKey="forecast" stroke="#E7F43C" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={animate} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="mt-4 w-full text-left text-xs text-secondary">
        <caption className="mb-2 text-left text-secondary">Forecast values</caption>
        <thead>
          <tr>
            <th className="py-1 font-normal">Minutes ahead</th>
            <th className="py-1 font-normal">Glucose</th>
          </tr>
        </thead>
        <tbody>
          {predict.curve.map((point) => (
            <tr key={point.minutes} className="border-t border-[var(--border-subtle)]">
              <td className="py-1 tabular-nums">{point.minutes}</td>
              <td className="py-1 font-mono tabular-nums text-ink">{point.glucose_mg_dl} mg/dL</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
