"""Check that the tables match the generator and the label rule.

Exits with status 1 when a check fails. Writes data/processed/validation.json.
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from features import decision_indexes, row_at
from generate_signals import simulate_patient


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_baseline() -> dict[str, dict]:
    people = {}
    with (DATA / "patients_baseline.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            people[row["patient_id"]] = row
    return people


def check_generator_match(people: dict[str, dict], sample_ids: list[str]) -> None:
    wanted = set(sample_ids)
    seen = {patient_id: [] for patient_id in wanted}
    with (DATA / "signals.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["patient_id"] in wanted:
                seen[row["patient_id"]].append(row)
    for patient_id in sample_ids:
        simulated = simulate_patient(people[patient_id])
        stored = seen[patient_id]
        if len(simulated) != len(stored):
            raise AssertionError(f"{patient_id} row count {len(stored)} != {len(simulated)}")
        for index, (sim, row) in enumerate(zip(simulated, stored)):
            if sim[1] != row["timestamp"] or f"{sim[2]:.1f}" != f"{float(row['glucose_mg_dl']):.1f}":
                raise AssertionError(f"{patient_id} diverges at row {index}")
            if f"{sim[5]:.1f}" != f"{float(row['sleep_hours_last_night']):.1f}":
                raise AssertionError(f"{patient_id} sleep diverges at row {index}")


def check_labels(people: dict[str, dict], sample_ids: list[str]) -> int:
    wanted = set(sample_ids)
    series: dict[str, list[dict]] = {patient_id: [] for patient_id in wanted}
    with (DATA / "signals.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["patient_id"] in wanted:
                series[row["patient_id"]].append(row)
    expected = {}
    for patient_id, rows in series.items():
        glucose = np.asarray([float(row["glucose_mg_dl"]) for row in rows])
        heart = np.asarray([float(row["heart_rate_bpm"]) for row in rows])
        steps = np.asarray([float(row["steps"]) for row in rows])
        sleep = np.asarray([float(row["sleep_hours_last_night"]) for row in rows])
        stamps = [row["timestamp"] for row in rows]
        for index in decision_indexes(len(rows)):
            record = row_at(glucose, heart, steps, sleep, stamps, people[patient_id], index)
            expected[(patient_id, record["decision_time"])] = record["label"]
    checked = 0
    with (DATA / "processed" / "train_rows.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["patient_id"], row["decision_time"])
            if key not in expected:
                continue
            if int(row["label"]) != expected[key]:
                raise AssertionError(f"label mismatch at {key}")
            checked += 1
    if checked != len(expected):
        raise AssertionError(f"checked {checked} labels, expected {len(expected)}")
    return checked


def check_sleep_and_join(people: dict[str, dict]) -> dict:
    missing = 0
    patient_days: dict[tuple[str, str], set[str]] = {}
    glucose_by_patient: dict[str, list[float]] = {}
    with (DATA / "signals.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            patient_id = row["patient_id"]
            if patient_id not in people:
                missing += 1
                continue
            day = row["timestamp"][:10]
            patient_days.setdefault((patient_id, day), set()).add(row["sleep_hours_last_night"])
            glucose_by_patient.setdefault(patient_id, []).append(float(row["glucose_mg_dl"]))
    varying_days = sum(1 for values in patient_days.values() if len(values) != 1)
    per_patient_nights = {}
    for (patient_id, _day), values in patient_days.items():
        per_patient_nights.setdefault(patient_id, set()).update(values)
    flat_patients = sum(1 for values in per_patient_nights.values() if len(values) < 2)
    hba1c = []
    mean_glucose = []
    for patient_id, values in glucose_by_patient.items():
        hba1c.append(float(people[patient_id]["hba1c"]))
        mean_glucose.append(float(np.mean(values)))
    correlation = float(np.corrcoef(hba1c, mean_glucose)[0, 1])
    if missing:
        raise AssertionError(f"{missing} signal rows have no baseline record")
    if varying_days:
        raise AssertionError("sleep changes inside a calendar day")
    if flat_patients:
        raise AssertionError(f"{flat_patients} patients have only one sleep value")
    if correlation < 0.8:
        raise AssertionError(f"HbA1c and mean glucose correlation is {correlation:.3f}")
    return {
        "signal_patients": len(glucose_by_patient),
        "baseline_patients": len(people),
        "hba1c_mean_glucose_correlation": round(correlation, 4),
        "sleep_values_per_day": 1,
    }


def main() -> None:
    people = load_baseline()
    sample_ids = sorted(people)[:2]
    check_generator_match(people, sample_ids)
    labels_checked = check_labels(people, sample_ids)
    summary = check_sleep_and_join(people)
    report = {
        "passed": True,
        "generator_matches_signals_for": sample_ids,
        "labels_recomputed": labels_checked,
        "patients_baseline_sha256": sha256(DATA / "patients_baseline.csv"),
        "signals_sha256": sha256(DATA / "signals.csv"),
        **summary,
    }
    out = DATA / "processed" / "validation.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"VALIDATION FAILED: {exc}")
        sys.exit(1)
