"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleActionButton } from "@/components/circle-action-button";
import { PanelCard } from "@/components/panel-card";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getJson, predictPath, predictSchema } from "@/lib/api";
import { FALSE_ALARM_MOMENT, HIT_MOMENT, type HeldOutMoment } from "@/lib/cases";
import { formatStamp, percent } from "@/lib/utils";

function Moment({ moment }: { moment: HeldOutMoment }) {
  const predict = useQuery({
    queryKey: ["predict", moment.patientId, moment.at, "case"],
    queryFn: ({ signal }) =>
      getJson(predictPath(moment.patientId, { at: moment.at }), predictSchema, signal),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <PanelCard title={moment.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-secondary">{moment.patientId}</p>
          <p className="mt-1 text-sm text-ink">{formatStamp(moment.at)}</p>
        </div>
        <CircleActionButton
          href={`/patients/${moment.patientId}?at=${encodeURIComponent(moment.at)}`}
          label={`Open ${moment.title}`}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusChip label={moment.outcome === "spike" ? "Spike in the next 2 hours" : "No spike in the next 2 hours"} variant={moment.outcome === "spike" ? "danger" : "success"} />
        <StatusChip label={`HbA1c ${moment.hba1c.toFixed(1)}%`} variant="neutral" />
        <StatusChip label={`${moment.glucoseMgDl.toFixed(1)} mg/dL`} variant="info" />
      </div>
      {predict.isPending ? <Skeleton className="mt-4 h-16" /> : null}
      {predict.isError ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusChip label="Could not score this moment" variant="danger" />
          <Button variant="ghost" type="button" onClick={() => predict.refetch()}>
            Retry
          </Button>
          <p className="text-sm text-secondary">
            {predict.error instanceof ApiError ? predict.error.message : "Request failed."}
          </p>
        </div>
      ) : null}
      {predict.data ? (
        <p className="mt-4 text-sm text-ink">
          Model probability {percent(predict.data.spike_probability)}. Curve{" "}
          {predict.data.curve.map((point) => `${point.minutes} min ${point.glucose_mg_dl} mg/dL`).join(", ")}.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-secondary">{moment.detail}</p>
    </PanelCard>
  );
}

export function HeldOutMoments() {
  return (
    <>
      <Moment moment={HIT_MOMENT} />
      <Moment moment={FALSE_ALARM_MOMENT} />
    </>
  );
}
