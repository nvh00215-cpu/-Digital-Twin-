"""Decision rows shared by training and the API.

Features stop at the decision index. The label and the curve targets use
later glucose readings and are never copied into the feature list.
"""

from __future__ import annotations

import numpy as np

HISTORY = 72
HORIZON = 24
STEP = 6
SPIKE_MGDL = 180.0

FEATURES = [
    "glucose_now",
    "slope_30m",
    "mean_2h",
    "std_6h",
    "share_above_140_6h",
    "hour",
    "steps_2h",
    "sleep_hours",
    "hr_mean_2h",
    "hr_std_2h",
    "age",
    "bmi",
    "hba1c",
    "diabetes_duration_years",
    "on_metformin",
    "on_sulfonylurea",
    "on_insulin",
    "systolic_bp",
    "has_hypertension",
    "has_ckd",
    "sex_male",
]

CURVE_MINUTES = (30, 60, 90, 120)


def last_decision_index(n_rows: int) -> int:
    last = n_rows - HORIZON - 1
    if last < HISTORY:
        raise ValueError("series is shorter than 8 hours")
    steps_back = (last - HISTORY) % STEP
    return last - steps_back


def decision_indexes(n_rows: int) -> range:
    last = last_decision_index(n_rows)
    return range(HISTORY, last + 1, STEP)


def row_at(
    glucose: np.ndarray,
    heart: np.ndarray,
    steps: np.ndarray,
    sleep: np.ndarray,
    stamps: list[str],
    person: dict,
    index: int,
) -> dict:
    now = float(glucose[index])
    past6 = glucose[index - HISTORY : index + 1]
    past2 = glucose[index - 24 : index + 1]
    future = glucose[index + 1 : index + 1 + HORIZON]
    hr2 = heart[index - 24 : index + 1]
    record = {
        "decision_time": stamps[index],
        "cohort": person["cohort"],
        "label": int(np.any(future >= SPIKE_MGDL)),
        "glucose_now": round(now, 1),
        "slope_30m": round(now - float(glucose[index - 6]), 2),
        "mean_2h": round(float(past2.mean()), 2),
        "std_6h": round(float(past6.std()), 2),
        "share_above_140_6h": round(float(np.mean(past6 > 140.0)), 3),
        "hour": int(stamps[index][11:13]),
        "steps_2h": int(steps[index - 24 : index + 1].sum()),
        "sleep_hours": round(float(sleep[index]), 1),
        "hr_mean_2h": round(float(hr2.mean()), 2),
        "hr_std_2h": round(float(hr2.std()), 2),
        "age": int(person["age"]),
        "bmi": float(person["bmi"]),
        "hba1c": float(person["hba1c"]),
        "diabetes_duration_years": float(person["diabetes_duration_years"]),
        "on_metformin": int(person["on_metformin"]),
        "on_sulfonylurea": int(person["on_sulfonylurea"]),
        "on_insulin": int(person["on_insulin"]),
        "systolic_bp": float(person["systolic_bp"]),
        "has_hypertension": int(person["has_hypertension"]),
        "has_ckd": int(person["has_ckd"]),
        "sex_male": int(person["sex"] == "M"),
    }
    for minutes in CURVE_MINUTES:
        record[f"y_glucose_{minutes}"] = round(float(glucose[index + minutes // 5]), 1)
    return record


def feature_vector(record: dict) -> list[float]:
    return [float(record[name]) for name in FEATURES]


def reasons(record: dict) -> list[str]:
    lines = []
    if record["slope_30m"] >= 8:
        lines.append("Glucose is rising")
    elif record["slope_30m"] <= -8:
        lines.append("Glucose is falling")
    if record["glucose_now"] >= 160:
        lines.append(f"Current glucose is {record['glucose_now']} mg/dL")
    if record["sleep_hours"] < 6:
        lines.append(f"Short sleep last night ({record['sleep_hours']} h)")
    if record["steps_2h"] < 300:
        lines.append("Low activity in the last 2 hours")
    if record["hba1c"] >= 7:
        lines.append(f"HbA1c is {record['hba1c']}%")
    if record["on_insulin"] == 1:
        lines.append("Insulin is on the record")
    return lines[:4] or ["Recent glucose is the main signal"]
