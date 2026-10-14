"""Turn patients_baseline.csv and signals.csv into one training row per decision.

A decision is taken every 30 minutes. Features use only the 6 hours ending
at that time. The label is 1 when any glucose reading in the next 2 hours
is 180 mg/dL or higher. Curve targets are the glucose values at +30, +60,
+90, and +120 minutes. Patients, not timestamps, are assigned to train,
validation, and test. Seed 2026.
"""

from __future__ import annotations

import csv
import json
import random
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import CURVE_MINUTES, FEATURES, decision_indexes, row_at

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
OUT = DATA / "processed"
SEED = 2026

COLUMNS = (
    ["patient_id", "decision_time", "split", "cohort", "label"]
    + FEATURES
    + [f"y_glucose_{minutes}" for minutes in CURVE_MINUTES]
)


def assign_splits(baseline: list[dict]) -> dict[str, str]:
    groups: dict[str, list[str]] = {"diabetes": [], "prediabetes": []}
    for row in baseline:
        groups[row["cohort"]].append(row["patient_id"])
    splits: dict[str, str] = {}
    rng = random.Random(SEED)
    for ids in groups.values():
        rng.shuffle(ids)
        n_train = int(round(len(ids) * 0.70))
        n_val = int(round(len(ids) * 0.15))
        for patient_id in ids[:n_train]:
            splits[patient_id] = "train"
        for patient_id in ids[n_train : n_train + n_val]:
            splits[patient_id] = "validation"
        for patient_id in ids[n_train + n_val :]:
            splits[patient_id] = "test"
    return splits


def load_baseline() -> dict[str, dict]:
    people = {}
    with (DATA / "patients_baseline.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            people[row["patient_id"]] = row
    return people


def main() -> None:
    baseline = load_baseline()
    splits = assign_splits(list(baseline.values()))
    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / "train_rows.csv"
    counts = {name: [0, 0] for name in ("train", "validation", "test")}
    by_cohort = {"diabetes": [0, 0], "prediabetes": [0, 0]}
    written = 0

    with (DATA / "signals.csv").open(encoding="utf-8", newline="") as source, out_path.open(
        "w", encoding="utf-8", newline=""
    ) as target:
        reader = csv.DictReader(source)
        writer = csv.DictWriter(target, fieldnames=COLUMNS)
        writer.writeheader()
        current_id = None
        bucket: list[dict] = []

        def flush(patient_id: str, rows: list[dict]) -> None:
            nonlocal written
            if patient_id not in baseline or not rows:
                return
            person = baseline[patient_id]
            glucose = np.asarray([float(row["glucose_mg_dl"]) for row in rows])
            heart = np.asarray([float(row["heart_rate_bpm"]) for row in rows])
            steps = np.asarray([float(row["steps"]) for row in rows])
            sleep = np.asarray([float(row["sleep_hours_last_night"]) for row in rows])
            stamps = [row["timestamp"] for row in rows]
            split = splits[patient_id]
            for index in decision_indexes(len(rows)):
                record = row_at(glucose, heart, steps, sleep, stamps, person, index)
                record["patient_id"] = patient_id
                record["split"] = split
                writer.writerow(record)
                counts[split][0] += 1
                counts[split][1] += record["label"]
                by_cohort[person["cohort"]][0] += 1
                by_cohort[person["cohort"]][1] += record["label"]
                written += 1

        for row in reader:
            patient_id = row["patient_id"]
            if current_id is None:
                current_id = patient_id
            if patient_id != current_id:
                flush(current_id, bucket)
                bucket = []
                current_id = patient_id
            bucket.append(row)
        if current_id is not None:
            flush(current_id, bucket)

    report = {
        "seed": SEED,
        "rows": written,
        "patients": len(baseline),
        "positive_rate_by_split": {
            name: round(labels / max(total, 1), 4) for name, (total, labels) in counts.items()
        },
        "rows_by_split": {name: total for name, (total, _) in counts.items()},
        "positive_rate_by_cohort": {
            name: round(labels / max(total, 1), 4) for name, (total, labels) in by_cohort.items()
        },
        "label": "1 if any glucose sample in (t, t+2h] is >= 180 mg/dL",
        "feature_window": "6 hours ending at decision_time, inclusive",
        "decision_every_minutes": 30,
        "curve_targets_minutes": list(CURVE_MINUTES),
    }
    (OUT / "dataset_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
