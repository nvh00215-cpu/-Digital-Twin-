"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CircleActionButton } from "@/components/circle-action-button";
import { DataRow, RowValue } from "@/components/data-row";
import { PanelCard } from "@/components/panel-card";
import { StatTile } from "@/components/stat-tile";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ALERT_AT, ApiError, getJson, patientListSchema, riskBand, type RiskBand } from "@/lib/api";
import { percent } from "@/lib/utils";

const tabs: { id: "all" | RiskBand; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High" },
  { id: "moderate", label: "Moderate" },
  { id: "low", label: "Low" },
];

const chipVariant = {
  high: "danger",
  moderate: "warning",
  low: "success",
} as const;

export function PatientList() {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const [band, setBand] = useState<(typeof tabs)[number]["id"]>("all");
  const patients = useQuery({
    queryKey: ["patients"],
    queryFn: ({ signal }) => getJson("/api/patients", patientListSchema, signal),
    staleTime: 30 * 60 * 1000,
  });

  const counts = useMemo(() => {
    const rows = patients.data ?? [];
    return {
      high: rows.filter((row) => riskBand(row.risk) === "high").length,
      moderate: rows.filter((row) => riskBand(row.risk) === "moderate").length,
      low: rows.filter((row) => riskBand(row.risk) === "low").length,
    };
  }, [patients.data]);

  const visible = useMemo(() => {
    return (patients.data ?? []).filter((row) => {
      const matchesId = !query || row.patient_id.toLowerCase().includes(query);
      const matchesBand = band === "all" || riskBand(row.risk) === band;
      return matchesId && matchesBand;
    });
  }, [patients.data, query, band]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="High risk" value={patients.data ? String(counts.high) : "—"} detail={`At or above ${Math.round(ALERT_AT * 100)}%`} />
        <StatTile label="Moderate risk" value={patients.data ? String(counts.moderate) : "—"} detail="30% to just under 60%" />
        <StatTile label="Low risk" value={patients.data ? String(counts.low) : "—"} detail="Under 30%" />
      </div>
      <PanelCard title="Patients">
        <div className="mb-4 flex h-11 w-fit gap-1 rounded-full bg-raised p-1" role="tablist" aria-label="Risk filter">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={band === tab.id}
              onClick={() => setBand(tab.id)}
              className={
                band === tab.id
                  ? "h-9 rounded-full bg-surface px-4 text-sm text-ink"
                  : "h-9 rounded-full px-4 text-sm text-secondary"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        {patients.isPending ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <p className="text-sm text-secondary">Scoring the cohort. This can take a minute.</p>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : null}
        {patients.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip label="Could not load patients" variant="danger" />
            <p className="text-sm text-secondary">{patients.error instanceof ApiError ? patients.error.message : "Request failed."}</p>
            <Button variant="ghost" type="button" onClick={() => patients.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
        {patients.data && visible.length === 0 ? (
          <p className="text-sm text-secondary">No patients match this search or risk filter.</p>
        ) : null}
        <div className="space-y-3">
          {visible.map((row) => {
            const level = riskBand(row.risk);
            return (
              <DataRow
                key={row.patient_id}
                initials={row.patient_id.slice(0, 2).toUpperCase()}
                title={row.patient_id}
                subtitle={`${row.cohort} · ${row.age} y · HbA1c ${row.hba1c.toFixed(1)}%`}
                values={
                  <>
                    <RowValue label="Age" value={`${row.age} y`} />
                    <RowValue label="HbA1c" value={`${row.hba1c.toFixed(1)}%`} />
                    <RowValue label="2-hour risk" value={percent(row.risk)} />
                  </>
                }
                chip={<StatusChip label={level[0].toUpperCase() + level.slice(1)} variant={chipVariant[level]} />}
                action={<CircleActionButton href={`/patients/${row.patient_id}`} label={`Open twin for ${row.patient_id}`} />}
              />
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
