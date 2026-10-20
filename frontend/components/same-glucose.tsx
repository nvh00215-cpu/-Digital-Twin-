"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleActionButton } from "@/components/circle-action-button";
import { PanelCard } from "@/components/panel-card";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getJson, predictPath, predictSchema } from "@/lib/api";
import { SAME_GLUCOSE } from "@/lib/cases";
import { formatStamp, percent } from "@/lib/utils";

function Side({ moment }: { moment: (typeof SAME_GLUCOSE)[number] }) {
  const predict = useQuery({
    queryKey: ["predict", moment.patientId, moment.at, "band"],
    queryFn: ({ signal }) =>
      getJson(predictPath(moment.patientId, { at: moment.at }), predictSchema, signal),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{moment.title}</p>
          <p className="mt-1 font-mono text-xs text-secondary">{formatStamp(moment.at)}</p>
        </div>
        <CircleActionButton
          href={`/patients/${moment.patientId}?at=${encodeURIComponent(moment.at)}`}
          label={`Open ${moment.title} at ${moment.at}`}
        />
      </div>
      <p className="mt-4 font-mono text-[28px] font-semibold tabular-nums text-ink">
        {moment.glucoseMgDl.toFixed(1)} <span className="text-base font-medium text-secondary">mg/dL</span>
      </p>
      <p className="mt-1 text-sm text-secondary">HbA1c {moment.hba1c.toFixed(1)}%</p>
      {predict.isPending ? <Skeleton className="mt-3 h-8" /> : null}
      {predict.isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip label="Risk unavailable" variant="danger" />
          <Button variant="ghost" type="button" onClick={() => predict.refetch()}>
            Retry
          </Button>
          <p className="text-xs text-secondary">
            {predict.error instanceof ApiError ? predict.error.message : "Request failed."}
          </p>
        </div>
      ) : null}
      {predict.data ? (
        <p className="mt-3 text-sm text-ink">
          2-hour risk {percent(predict.data.spike_probability)}. Forecast{" "}
          {predict.data.curve.map((point) => `${point.minutes} min ${point.glucose_mg_dl}`).join(", ")} mg/dL.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-secondary">{moment.detail}</p>
    </div>
  );
}

export function SameGlucose() {
  return (
    <PanelCard title="Same glucose, different record">
      <p className="mb-4 text-sm text-secondary">
        Both held-out moments were at 148.5 mg/dL. In this 140–160 band the 2-hour spike rate is 0.8% when HbA1c is
        under 7% and 29.7% when HbA1c is 7% or higher.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {SAME_GLUCOSE.map((moment) => (
          <Side key={moment.patientId} moment={moment} />
        ))}
      </div>
    </PanelCard>
  );
}
