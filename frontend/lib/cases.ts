/** Held-out test-split moments. Outcome is the label, which the live API does not return. */

export type HeldOutMoment = {
  patientId: string;
  at: string;
  glucoseMgDl: number;
  hba1c: number;
  outcome: "spike" | "no-spike";
  title: string;
  detail: string;
};

export const SAME_GLUCOSE: HeldOutMoment[] = [
  {
    patientId: "f95a8235-5c43-4926-84fb-391822847c30",
    at: "2026-01-10T08:30:00",
    glucoseMgDl: 148.5,
    hba1c: 6.0,
    outcome: "no-spike",
    title: "HbA1c 6.0%",
    detail: "Same glucose, lower HbA1c. This held-out row did not reach 180 mg/dL in the next 2 hours.",
  },
  {
    patientId: "714b9c18-783d-4f52-aa64-cc3a05a286d9",
    at: "2026-01-09T20:30:00",
    glucoseMgDl: 148.5,
    hba1c: 7.8,
    outcome: "spike",
    title: "HbA1c 7.8%",
    detail: "Same glucose, higher HbA1c. This held-out row did reach 180 mg/dL in the next 2 hours.",
  },
];

export const HIT_MOMENT: HeldOutMoment = {
  patientId: "6ec18ddf-e9ee-421a-9033-456f558c7b4b",
  at: "2026-01-06T21:30:00",
  glucoseMgDl: 176.5,
  hba1c: 7.5,
  outcome: "spike",
  title: "Alert that was right",
  detail: "Glucose was 176.5 mg/dL, still under 180. The next 2 hours did reach 180 mg/dL.",
};

export const FALSE_ALARM_MOMENT: HeldOutMoment = {
  patientId: "852f4588-ba8f-4eeb-94fe-5c3c974ab114",
  at: "2026-01-06T14:00:00",
  glucoseMgDl: 168.2,
  hba1c: 6.2,
  outcome: "no-spike",
  title: "Alert that was wrong",
  detail: "Glucose was 168.2 mg/dL. The model crossed the 60% line. The next 2 hours did not reach 180 mg/dL.",
};
