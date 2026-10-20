"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Droplets, Footprints, Moon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GlucoseChart } from "@/components/glucose-chart";
import { PanelCard } from "@/components/panel-card";
import { SameGlucose } from "@/components/same-glucose";
import { SignalChart } from "@/components/signal-chart";
import { StatTile } from "@/components/stat-tile";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  ALERT_AT,
  ApiError,
  getJson,
  predictPath,
  predictSchema,
  recordSchema,
  sleepFromReasons,
} from "@/lib/api";
import { DECISION_STAMPS, decisionIndex } from "@/lib/replay";
import { formatStamp, percent } from "@/lib/utils";

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusChip label="Unavailable" variant="danger" />
      <p className="text-sm text-secondary">{message}</p>
      <Button variant="ghost" type="button" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function medicineLine(record: {
  on_metformin: boolean;
  on_sulfonylurea: boolean;
  on_insulin: boolean;
}) {
  const names = [
    record.on_metformin ? "Metformin" : null,
    record.on_sulfonylurea ? "Sulfonylurea" : null,
    record.on_insulin ? "Insulin" : null,
  ].filter(Boolean);
  return names.length > 0 ? names.join(", ") : "None on record";
}

export function PatientTwin({ id, initialAt }: { id: string; initialAt?: string }) {
  const [sleep, setSleep] = useState(7);
  const [sleepTouched, setSleepTouched] = useState(false);
  const [stepScale, setStepScale] = useState(1);
  const [applied, setApplied] = useState<{ sleepHours: number | null; stepScale: number }>({
    sleepHours: null,
    stepScale: 1,
  });
  const [at, setAt] = useState<string | null>(initialAt && DECISION_STAMPS.includes(initialAt) ? initialAt : null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setApplied({
        sleepHours: sleepTouched ? Math.round(sleep * 10) / 10 : null,
        stepScale: Math.round(stepScale * 10) / 10,
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [sleep, sleepTouched, stepScale]);

  const scenarioOn = applied.sleepHours != null || applied.stepScale !== 1;
  const record = useQuery({
    queryKey: ["record", id],
    queryFn: ({ signal }) => getJson(`/api/patients/${encodeURIComponent(id)}`, recordSchema, signal),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
  const baseline = useQuery({
    queryKey: ["predict", id, at, "baseline"],
    queryFn: ({ signal }) => getJson(predictPath(id, { at }), predictSchema, signal),
    staleTime: 30 * 60 * 1000,
    refetchInterval: at == null ? 30 * 60 * 1000 : false,
  });
  const scenario = useQuery({
    queryKey: ["predict", id, at, applied.sleepHours, applied.stepScale],
    queryFn: ({ signal }) =>
      getJson(
        predictPath(id, { at, sleepHours: applied.sleepHours, stepScale: applied.stepScale }),
        predictSchema,
        signal,
      ),
    enabled: scenarioOn,
    staleTime: 30 * 60 * 1000,
  });

  const message = (error: unknown) => (error instanceof ApiError ? error.message : "Request failed.");
  const scored = scenarioOn && scenario.data ? scenario.data : baseline.data;
  const activeError = scenarioOn && scenario.isError ? scenario.error : baseline.error;
  const activePending = baseline.isPending || (scenarioOn && scenario.isPending && !scenario.data);
  const sleepHours = baseline.data ? sleepFromReasons(baseline.data.reasons) : null;
  const alert = scored ? scored.alert || scored.spike_probability >= ALERT_AT : false;
  const replayIndex = decisionIndex(at);

  let changeSentence = "";
  if (scenarioOn && baseline.data && scenario.data) {
    const parts: string[] = [];
    if (applied.sleepHours != null) {
      parts.push(
        sleepHours != null
          ? `Sleep ${sleepHours.toFixed(1)} h to ${applied.sleepHours.toFixed(1)} h`
          : `Sleep set to ${applied.sleepHours.toFixed(1)} h`,
      );
    }
    if (applied.stepScale !== 1) {
      parts.push(`step scale set to ${applied.stepScale.toFixed(1)}×`);
    }
    changeSentence = `${parts.join(" and ")} moved the 2-hour risk from ${percent(baseline.data.spike_probability)} to ${percent(scenario.data.spike_probability)}. Nothing is saved.`;
  }

  return (
    <div className="space-y-4">
      <Link href="/patients" className="inline-flex h-10 items-center text-sm text-secondary hover:text-ink">
        Back to patients
      </Link>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <PanelCard title="Record">
            {record.isPending ? <Skeleton className="h-28" /> : null}
            {record.isError ? <PanelError message={message(record.error)} onRetry={() => record.refetch()} /> : null}
            {record.data ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="HbA1c" value={`${record.data.hba1c.toFixed(1)}%`} detail={record.data.hba1c_source.replaceAll("_", " ")} />
                  <StatTile label="BMI" value={record.data.bmi.toFixed(1)} />
                  <StatTile label="Blood pressure" value={`${Math.round(record.data.systolic_bp)}/${Math.round(record.data.diastolic_bp)}`} detail="mmHg" />
                  <StatTile label="Duration" value={`${record.data.diabetes_duration_years.toFixed(1)}`} detail="years" />
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3"><dt className="text-secondary">Patient</dt><dd className="truncate font-mono text-xs">{record.data.patient_id}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-secondary">Cohort</dt><dd>{record.data.cohort}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-secondary">Age</dt><dd className="tabular-nums">{record.data.age} y</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-secondary">Sex</dt><dd>{record.data.sex}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-secondary">Hypertension</dt><dd>{yesNo(record.data.has_hypertension)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-secondary">CKD</dt><dd>{yesNo(record.data.has_ckd)}</dd></div>
                  <div className="flex justify-between gap-3 sm:col-span-2"><dt className="text-secondary">Medicines on record</dt><dd>{medicineLine(record.data)}</dd></div>
                </dl>
              </div>
            ) : null}
          </PanelCard>

          <SameGlucose />

          <PanelCard
            title="Glucose"
            icon={<Droplets size={16} strokeWidth={1.75} />}
            action={
              <Button variant="ghost" type="button" onClick={() => baseline.refetch()}>
                Refresh
              </Button>
            }
          >
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-secondary" htmlFor="replay-slider">
                  Decision time
                </label>
                <span className="font-mono text-sm tabular-nums text-ink">{formatStamp(DECISION_STAMPS[replayIndex])}</span>
              </div>
              <Slider
                id="replay-slider"
                className="mt-3"
                min={0}
                max={DECISION_STAMPS.length - 1}
                step={1}
                value={[replayIndex]}
                aria-label="Decision time across the 14 days"
                onValueChange={([value]) => setAt(DECISION_STAMPS[value])}
              />
              <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span>{formatStamp(DECISION_STAMPS[0])}</span>
                <span>{formatStamp(DECISION_STAMPS[DECISION_STAMPS.length - 1])}</span>
              </div>
            </div>
            {activePending ? <Skeleton className="h-[280px]" /> : null}
            {baseline.isError || (scenarioOn && scenario.isError) ? (
              <PanelError
                message={message(activeError)}
                onRetry={() => {
                  void baseline.refetch();
                  if (scenarioOn) void scenario.refetch();
                }}
              />
            ) : null}
            {scored && scored.window.length === 0 ? (
              <p className="text-sm text-secondary">No recent glucose window was returned for this decision.</p>
            ) : null}
            {scored && scored.window.length > 0 ? <GlucoseChart predict={scored} /> : null}
          </PanelCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <PanelCard title="Heart rate" icon={<Activity size={16} strokeWidth={1.75} />}>
              {activePending ? <Skeleton className="h-40" /> : null}
              {scored && scored.window.length > 0 ? (
                <SignalChart points={scored.window} dataKey="heart_rate_bpm" color="#5B6CFF" unit="bpm" label="Heart rate" />
              ) : null}
            </PanelCard>
            <PanelCard title="Steps" icon={<Footprints size={16} strokeWidth={1.75} />}>
              {activePending ? <Skeleton className="h-40" /> : null}
              {scored && scored.window.length > 0 ? (
                <SignalChart points={scored.window} dataKey="steps" color="#E7F43C" unit="steps" label="Steps" />
              ) : null}
              {scored ? (
                <p className="mt-2 text-xs text-muted">
                  Each point is one 5-minute bin. The what-if control scales those steps; it does not set a step target.
                </p>
              ) : null}
            </PanelCard>
          </div>
          <PanelCard title="Sleep" icon={<Moon size={16} strokeWidth={1.75} />}>
            {baseline.isPending ? <Skeleton className="h-16" /> : null}
            {baseline.data && sleepHours != null ? (
              <p className="font-mono text-[28px] font-semibold tabular-nums">
                {sleepHours.toFixed(1)} <span className="text-base font-medium text-secondary">hours</span>
              </p>
            ) : null}
            {baseline.data && sleepHours == null ? (
              <div>
                <p className="text-sm text-ink">Sleep hours are not in the series response.</p>
                <p className="mt-1 text-sm text-secondary">
                  The API includes last night only inside a short-sleep reason, and only when sleep is under 6 hours.
                </p>
              </div>
            ) : null}
          </PanelCard>
        </div>

        <aside className="space-y-4">
          {scored && alert ? (
            <section className="rounded-3xl bg-accent p-5 text-on-accent">
              <p className="text-xs">2-hour spike alert</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{percent(scored.spike_probability)}</p>
              <p className="mt-2 text-sm">
                At or above the {Math.round(ALERT_AT * 100)}% threshold. Decision {formatStamp(scored.decision_time)}.
              </p>
              <a href="#reasons" className="mt-4 inline-flex h-10 items-center rounded-full bg-app px-5 text-sm text-ink">
                Review signals
              </a>
            </section>
          ) : null}
          {scored && !alert ? (
            <PanelCard title="Alert">
              <StatusChip label="Below alert threshold" variant="neutral" />
              <p className="mt-3 font-mono text-[28px] font-semibold tabular-nums">{percent(scored.spike_probability)}</p>
              <p className="mt-1 text-sm text-secondary">Decision {formatStamp(scored.decision_time)}. Threshold {Math.round(ALERT_AT * 100)}%.</p>
            </PanelCard>
          ) : null}

          <PanelCard title="What-if">
            <p className="mb-4 text-sm text-secondary">Results stay on this screen. Nothing is saved.</p>
            <label className="text-xs text-secondary" htmlFor="sleep-slider">
              Last night sleep
            </label>
            <div className="mt-2 flex items-center gap-3">
              <Slider
                id="sleep-slider"
                min={3.5}
                max={9}
                step={0.1}
                value={[sleep]}
                aria-label="Last night sleep in hours"
                onValueChange={([value]) => {
                  setSleep(value);
                  setSleepTouched(true);
                }}
              />
              <span className="w-16 text-right font-mono text-sm tabular-nums">{sleepTouched ? `${sleep.toFixed(1)} h` : "Recorded"}</span>
            </div>
            <label className="mt-4 block text-xs text-secondary" htmlFor="step-slider">
              Step scale
            </label>
            <div className="mt-2 flex items-center gap-3">
              <Slider
                id="step-slider"
                min={0.2}
                max={4}
                step={0.1}
                value={[stepScale]}
                aria-label="Step scale"
                onValueChange={([value]) => setStepScale(value)}
              />
              <span className="w-16 text-right font-mono text-sm tabular-nums">{stepScale.toFixed(1)}×</span>
            </div>
            <Button
              variant="ghost"
              type="button"
              className="mt-3"
              onClick={() => {
                setSleep(7);
                setSleepTouched(false);
                setStepScale(1);
              }}
            >
              Use recorded night and steps
            </Button>
            {scenario.isPending && scenarioOn ? <Skeleton className="mt-3 h-12" /> : null}
            {changeSentence ? <p className="mt-3 text-sm text-ink">{changeSentence}</p> : null}
          </PanelCard>

          <PanelCard title="Reasons">
            <ul id="reasons" className="space-y-2 text-sm text-ink">
              {baseline.isPending ? <Skeleton className="h-16" /> : null}
              {(scenarioOn ? scenario.data : baseline.data)?.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
