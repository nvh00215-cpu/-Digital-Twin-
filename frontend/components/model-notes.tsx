"use client";

import { useQuery } from "@tanstack/react-query";
import { HeldOutMoments } from "@/components/held-out-moments";
import { PanelCard } from "@/components/panel-card";
import { StatTile } from "@/components/stat-tile";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getJson, metricsSchema } from "@/lib/api";
import { percent } from "@/lib/utils";

const featureLabels: Record<string, string> = {
  glucose_now: "Glucose now",
  hour: "Hour of day",
  hba1c: "HbA1c",
  std_6h: "6-hour glucose spread",
  mean_2h: "2-hour glucose mean",
  slope_30m: "30-minute slope",
  share_above_140_6h: "Share above 140 mg/dL",
  steps_2h: "Steps in 2 hours",
};

export function ModelNotes() {
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: ({ signal }) => getJson("/api/metrics", metricsSchema, signal),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PanelCard title="Data">
        <p className="text-sm leading-relaxed text-secondary">
          Static record fields come from a Synthea extract. The 14-day wearable series is simulated at 5-minute
          steps: glucose, heart rate, steps, and one sleep value copied across each day. Seed 2026. These are not
          device recordings and not lab continuous glucose.
        </p>
      </PanelCard>
      <PanelCard title="Model">
        <p className="text-sm leading-relaxed text-secondary">
          LightGBM scores the chance that glucose reaches 180 mg/dL within 2 hours. Four more boosters estimate
          glucose at 30, 60, 90, and 120 minutes. The alert flag is true at or above 60%. That cutoff lives in the
          model code and is not its own response field. The curve does not decide the alert.
        </p>
      </PanelCard>
      <PanelCard title="Held-out metrics" className="xl:col-span-2">
        {metrics.isPending ? <Skeleton className="h-28" /> : null}
        {metrics.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip label="Metrics unavailable" variant="danger" />
            <p className="text-sm text-secondary">{metrics.error instanceof ApiError ? metrics.error.message : "Request failed."}</p>
            <Button variant="ghost" type="button" onClick={() => metrics.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
        {metrics.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="AUROC" value={metrics.data.auroc.toFixed(4)} detail={`${metrics.data.test_patients} held-out patients`} />
              <StatTile label="AUPRC" value={metrics.data.auprc.toFixed(4)} detail={`Positive rate ${percent(metrics.data.test_positive_rate)}`} />
              <StatTile label="Sensitivity" value={metrics.data.sensitivity_at_80_specificity.toFixed(4)} detail="At 80% specificity" />
              <StatTile
                label="False alarms"
                value={metrics.data["false_alarms_per_patient_day_at_0.60"].toFixed(3)}
                detail="Per patient-day at 60%"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Glucose-only AUROC" value={metrics.data.glucose_now_auroc.toFixed(4)} />
              <StatTile label="Slope-only AUROC" value={metrics.data.slope_only_auroc.toFixed(4)} />
              <StatTile label="Curve MAE 30 min" value={`${metrics.data.curve_mae_mg_dl["30"]}`} detail="mg/dL" />
              <StatTile label="Curve MAE 120 min" value={`${metrics.data.curve_mae_mg_dl["120"]}`} detail="mg/dL" />
            </div>
            {metrics.data.same_glucose_band_140_to_160 ? (
              <p className="text-sm text-secondary">
                In the same 140–160 mg/dL band ({metrics.data.same_glucose_band_140_to_160.rows} rows), the 2-hour
                spike rate is {percent(metrics.data.same_glucose_band_140_to_160.spike_rate_hba1c_below_7)} when
                HbA1c is under 7% and {percent(metrics.data.same_glucose_band_140_to_160.spike_rate_hba1c_7_or_higher)} when
                HbA1c is 7% or higher.
              </p>
            ) : null}
            {metrics.data.feature_gain ? (
              <ul className="space-y-1 text-sm text-secondary">
                {metrics.data.feature_gain.slice(0, 8).map((item) => (
                  <li key={item.feature}>
                    {featureLabels[item.feature] ?? item.feature}
                    <span className="ml-2 font-mono tabular-nums text-ink">{Math.round(item.gain)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </PanelCard>
      <HeldOutMoments />
      <PanelCard title="Limits" className="xl:col-span-2">
        <p className="text-sm leading-relaxed text-secondary">
          High scores describe this formula-generated series. They are not clinical validation. The screen never
          recommends a drug dose. A morning review can sort who to look at first. It is not a treatment order.
        </p>
      </PanelCard>
    </div>
  );
}
