"""Load the saved model and score one patient at one decision time."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from features import FEATURES, CURVE_MINUTES, feature_vector, last_decision_index, reasons, row_at
from generate_signals import DAYS, STEPS_PER_DAY, simulate_patient

DATA = ROOT / "data"
MODEL_PATH = ROOT / "backend" / "models" / "baseline.joblib"
DEMO_PATH = ROOT / "backend" / "outputs" / "demo_patient.json"
METRICS_PATH = ROOT / "backend" / "outputs" / "metrics.json"
ALERT_AT = 0.60


class TwinStore:
    def __init__(self) -> None:
        bundle = joblib.load(MODEL_PATH)
        self.spike = bundle["spike"]
        self.curves = bundle["curves"]
        self.people = self._load_people()
        self.series = self._load_series()
        self.demo = json.loads(DEMO_PATH.read_text(encoding="utf-8"))
        self.metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))

    def _load_people(self) -> dict[str, dict]:
        frame = pd.read_csv(DATA / "patients_baseline.csv")
        return {row["patient_id"]: row for row in frame.to_dict(orient="records")}

    def _load_series(self) -> dict[str, dict]:
        frame = pd.read_csv(DATA / "signals.csv")
        series = {}
        for patient_id, group in frame.groupby("patient_id", sort=False):
            series[patient_id] = {
                "glucose": group["glucose_mg_dl"].to_numpy(dtype=float),
                "heart": group["heart_rate_bpm"].to_numpy(dtype=float),
                "steps": group["steps"].to_numpy(dtype=float),
                "sleep": group["sleep_hours_last_night"].to_numpy(dtype=float),
                "stamps": group["timestamp"].tolist(),
            }
        return series

    def patient_ids(self) -> list[str]:
        return list(self.people)

    def _arrays(self, patient_id: str, sleep_hours: float | None, step_scale: float):
        cached = self.series[patient_id]
        if sleep_hours is None and step_scale == 1.0:
            return cached["glucose"], cached["heart"], cached["steps"], cached["sleep"], cached["stamps"]
        nights = [float(cached["sleep"][day * STEPS_PER_DAY]) for day in range(DAYS)]
        if sleep_hours is not None:
            nights[-1] = sleep_hours
        rows = simulate_patient(self.people[patient_id], night_override=nights, step_scale=step_scale)
        return (
            np.asarray([row[2] for row in rows], dtype=float),
            np.asarray([row[3] for row in rows], dtype=float),
            np.asarray([row[4] for row in rows], dtype=float),
            np.asarray([row[5] for row in rows], dtype=float),
            [row[1] for row in rows],
        )

    def _index(self, stamps: list[str], at: str | None) -> int:
        if at is None:
            return last_decision_index(len(stamps))
        try:
            return stamps.index(at)
        except ValueError as exc:
            raise KeyError(at) from exc

    def score(
        self,
        patient_id: str,
        at: str | None = None,
        sleep_hours: float | None = None,
        step_scale: float = 1.0,
    ) -> dict:
        if patient_id not in self.people:
            raise KeyError(patient_id)
        glucose, heart, steps, sleep, stamps = self._arrays(patient_id, sleep_hours, step_scale)
        index = self._index(stamps, at)
        record = row_at(glucose, heart, steps, sleep, stamps, self.people[patient_id], index)
        vector = pd.DataFrame([feature_vector(record)], columns=FEATURES)
        probability = float(self.spike.predict(vector)[0])
        start = max(0, index - 72)
        window = []
        for position in range(start, index + 1):
            window.append(
                {
                    "timestamp": stamps[position],
                    "glucose_mg_dl": round(float(glucose[position]), 1),
                    "heart_rate_bpm": int(heart[position]),
                    "steps": int(steps[position]),
                }
            )
        return {
            "patient_id": patient_id,
            "decision_time": record["decision_time"],
            "spike_probability": round(probability, 4),
            "alert": probability >= ALERT_AT,
            "curve": [
                {
                    "minutes": minutes,
                    "glucose_mg_dl": round(float(self.curves[minutes].predict(vector)[0]), 1),
                }
                for minutes in CURVE_MINUTES
            ],
            "reasons": reasons(record),
            "model": "lightgbm",
            "synthetic": True,
            "scenario": {"sleep_hours": sleep_hours, "step_scale": step_scale},
            "window": window,
            "record": {
                "age": record["age"],
                "sex": self.people[patient_id]["sex"],
                "bmi": record["bmi"],
                "hba1c": record["hba1c"],
                "hba1c_source": self.people[patient_id]["hba1c_source"],
                "cohort": record["cohort"],
                "diabetes_duration_years": record["diabetes_duration_years"],
                "on_metformin": bool(record["on_metformin"]),
                "on_sulfonylurea": bool(record["on_sulfonylurea"]),
                "on_insulin": bool(record["on_insulin"]),
                "systolic_bp": record["systolic_bp"],
                "diastolic_bp": float(self.people[patient_id]["diastolic_bp"]),
                "has_hypertension": bool(record["has_hypertension"]),
                "has_ckd": bool(record["has_ckd"]),
            },
        }

    def cohort(self) -> list[dict]:
        rows = []
        for patient_id, person in self.people.items():
            scored = self.score(patient_id)
            rows.append(
                {
                    "patient_id": patient_id,
                    "age": int(person["age"]),
                    "hba1c": float(person["hba1c"]),
                    "cohort": person["cohort"],
                    "risk": scored["spike_probability"],
                    "alert": scored["alert"],
                }
            )
        rows.sort(key=lambda item: item["risk"], reverse=True)
        return rows
