import { z } from "zod";

/** From backend/src/predict.py ALERT_AT. The API returns `alert`, not this number. */
export const ALERT_AT = 0.6;

/** Display bands. High matches the backend alert. Moderate and Low are UI groupings. */
export const MODERATE_AT = 0.3;

export type RiskBand = "high" | "moderate" | "low";

export function riskBand(risk: number): RiskBand {
  if (risk >= ALERT_AT) return "high";
  if (risk >= MODERATE_AT) return "moderate";
  return "low";
}

export function sleepFromReasons(reasons: string[]): number | null {
  for (const line of reasons) {
    const match = line.match(/Short sleep last night \(([\d.]+) h\)/);
    if (match) return Number(match[1]);
  }
  return null;
}

const pointSchema = z.object({
  timestamp: z.string(),
  glucose_mg_dl: z.number(),
  heart_rate_bpm: z.number(),
  steps: z.number(),
});

export const patientSchema = z.object({
  patient_id: z.string(),
  age: z.number(),
  hba1c: z.number(),
  cohort: z.string(),
  risk: z.number(),
  alert: z.boolean(),
});

export const patientListSchema = z.array(patientSchema);

export const recordSchema = z
  .object({
    patient_id: z.string(),
    age: z.number(),
    sex: z.string(),
    bmi: z.number(),
    hba1c: z.number(),
    hba1c_source: z.string(),
    cohort: z.string(),
    diabetes_duration_years: z.number(),
    on_metformin: z.boolean(),
    on_sulfonylurea: z.boolean(),
    on_insulin: z.boolean(),
    systolic_bp: z.number(),
    diastolic_bp: z.number(),
    has_hypertension: z.boolean(),
    has_ckd: z.boolean(),
  })
  .passthrough();

export const predictSchema = z.object({
  patient_id: z.string(),
  decision_time: z.string(),
  spike_probability: z.number(),
  alert: z.boolean(),
  curve: z.array(
    z.object({
      minutes: z.number(),
      glucose_mg_dl: z.number(),
    }),
  ),
  reasons: z.array(z.string()),
  model: z.string(),
  synthetic: z.boolean(),
  scenario: z.object({
    sleep_hours: z.number().nullable(),
    step_scale: z.number(),
  }),
  window: z.array(pointSchema),
});

export const metricsSchema = z
  .object({
    model: z.string(),
    test_patients: z.number(),
    test_rows: z.number(),
    test_positive_rate: z.number(),
    auroc: z.number(),
    auprc: z.number(),
    sensitivity_at_80_specificity: z.number(),
    "false_alarms_per_patient_day_at_0.60": z.number(),
    glucose_now_auroc: z.number(),
    slope_only_auroc: z.number(),
    curve_mae_mg_dl: z.object({
      "30": z.number(),
      "60": z.number(),
      "90": z.number(),
      "120": z.number(),
    }),
    same_glucose_band_140_to_160: z
      .object({
        rows: z.number(),
        spike_rate_hba1c_below_7: z.number(),
        spike_rate_hba1c_7_or_higher: z.number(),
      })
      .optional(),
    feature_gain: z
      .array(
        z.object({
          feature: z.string(),
          gain: z.number(),
        }),
      )
      .optional(),
    synthetic: z.boolean(),
  })
  .passthrough();

export type PatientRow = z.infer<typeof patientSchema>;
export type RecordResponse = z.infer<typeof recordSchema>;
export type PredictResponse = z.infer<typeof predictSchema>;
export type MetricsResponse = z.infer<typeof metricsSchema>;
export type SeriesPoint = z.infer<typeof pointSchema>;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { accept: "application/json" } });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && body && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : "";
    if (response.status === 401 && detail === "sign in required") {
      throw new ApiError(
        "The API process on port 8000 is still asking for its own sign-in. The saved backend files do not. Restart that API yourself when you can.",
        401,
      );
    }
    if (response.status === 404) {
      throw new ApiError("This patient or decision time was not found.", 404);
    }
    throw new ApiError(detail || "The twin API could not complete this read.", response.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("The API response did not match the expected fields.", 502);
  }
  return parsed.data;
}

export function predictPath(
  id: string,
  options?: { at?: string | null; sleepHours?: number | null; stepScale?: number | null },
) {
  const params = new URLSearchParams();
  if (options?.at) params.set("at", options.at);
  if (options?.sleepHours != null) params.set("sleep_hours", String(options.sleepHours));
  if (options?.stepScale != null && options.stepScale !== 1) {
    params.set("step_scale", String(options.stepScale));
  }
  const query = params.toString();
  return `/api/patients/${encodeURIComponent(id)}/predict${query ? `?${query}` : ""}`;
}
