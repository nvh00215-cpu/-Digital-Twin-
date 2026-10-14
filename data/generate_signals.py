"""Build patients_baseline.csv and signals.csv from the Synthea sample.

The wearable rows are simulated. Synthea has clinic labs, not a 5-minute
sensor. Glucose is anchored to the ADAG average-glucose formula
(28.7 x HbA1c - 46.7), then shifted by meals, steps, sleep, and insulin.

This sample's diabetes HbA1c values are often below a diabetic range, and
some are below 4%. Those raw values are kept in hba1c_raw. The value used
for the trace is written to hba1c, with hba1c_source saying whether it came
from the lab or was imputed from the diagnosis.
"""

from __future__ import annotations

import csv
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SYNTHEA = ROOT / "synthea" / "csv" / "csv"
BASELINE_PATH = ROOT / "patients_baseline.csv"
SIGNALS_PATH = ROOT / "signals.csv"

DAYS = 14
STEP_MINUTES = 5
STEPS_PER_DAY = 24 * 60 // STEP_MINUTES
START = datetime(2026, 1, 5, 0, 0, 0)
REFERENCE = date(2020, 1, 1)
SEED = 2026

MEAL_MINUTES = (8 * 60, 13 * 60 + 30, 21 * 60)


def latest_obs(path: Path, descriptions: set[str]) -> dict[str, dict[str, tuple[str, float]]]:
    found: dict[str, dict[str, tuple[str, float]]] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            desc = row["DESCRIPTION"]
            if desc not in descriptions:
                continue
            try:
                value = float(row["VALUE"])
            except ValueError:
                continue
            patient = found.setdefault(row["PATIENT"], {})
            previous = patient.get(desc)
            if previous is None or row["DATE"] >= previous[0]:
                patient[desc] = (row["DATE"], value)
    return found


def load_conditions(path: Path) -> dict[str, dict]:
    people: dict[str, dict] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            desc = row["DESCRIPTION"]
            low = desc.lower()
            person = people.setdefault(
                row["PATIENT"],
                {
                    "diabetes": False,
                    "prediabetes": False,
                    "hypertension": False,
                    "ckd": False,
                    "condition_start": None,
                },
            )
            is_diabetes = (
                low == "diabetes"
                or "type 2 diabetes" in low
                or "type ii diabetes" in low
                or low.startswith("diabetic")
            )
            if is_diabetes:
                person["diabetes"] = True
            elif low == "prediabetes":
                person["prediabetes"] = True
            else:
                is_diabetes = False
            if "hypertension" in low:
                person["hypertension"] = True
            if "renal" in low or "chronic kidney" in low:
                person["ckd"] = True
            if is_diabetes or low == "prediabetes":
                start = row["START"][:10]
                current = person["condition_start"]
                if current is None or start < current:
                    person["condition_start"] = start
    return people


def load_med_flags(path: Path) -> dict[str, dict[str, bool]]:
    flags: dict[str, dict[str, bool]] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            low = row["DESCRIPTION"].lower()
            person = flags.setdefault(
                row["PATIENT"],
                {"metformin": False, "sulfonylurea": False, "insulin": False},
            )
            if "metformin" in low:
                person["metformin"] = True
            if any(name in low for name in ("glipizide", "glyburide", "glimepiride")):
                person["sulfonylurea"] = True
            if "insulin" in low or "humulin" in low or "humalog" in low:
                person["insulin"] = True
    return flags


def age_on(birth: str, on: date) -> int:
    born = datetime.strptime(birth[:10], "%Y-%m-%d").date()
    years = on.year - born.year - ((on.month, on.day) < (born.month, born.day))
    return max(18, min(years, 90))


def years_between(start: str, on: date) -> float:
    began = datetime.strptime(start[:10], "%Y-%m-%d").date()
    return round(max(0.5, (on - began).days / 365.25), 1)


def choose_hba1c(raw: float | None, diabetes: bool, rng: random.Random) -> tuple[float, str]:
    plausible = raw is not None and 4.5 <= raw <= 14.0
    if diabetes:
        if plausible and raw >= 6.5:
            return round(raw, 1), "synthea_lab"
        # Diagnosis says diabetes, but this sample's lab is missing or not in range.
        return round(rng.uniform(6.6, 8.4), 1), "imputed_from_diagnosis"
    if plausible and raw < 6.5:
        return round(raw, 1), "synthea_lab"
    return round(rng.uniform(5.6, 6.3), 1), "imputed_from_diagnosis"


def meal_peaks_for_day(rng: random.Random, hba1c: float, cohort: str, insulin: bool) -> list[float]:
    """Peak meal rise in mg/dL. One meal each day is larger than the other two."""
    if cohort == "prediabetes":
        base = 50.0
    else:
        base = 58.0 + max(0.0, hba1c - 6.5) * 12.0
    if insulin:
        base *= 0.8
    scales = [0.7, 1.0, 1.05]
    scales[rng.randrange(3)] *= rng.uniform(1.55, 1.9)
    return [base * scale for scale in scales]


def meal_effect(minute_of_day: int, peaks: list[float]) -> float:
    total = 0.0
    for meal, peak in zip(MEAL_MINUTES, peaks):
        delta = minute_of_day - meal
        if 0 < delta < 210:
            x = delta / 55.0
            total += peak * x * math.exp(1.0 - x)
    return total


def build_baseline() -> list[dict]:
    patients: dict[str, dict] = {}
    with (SYNTHEA / "patients.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            patients[row["Id"]] = row

    conditions = load_conditions(SYNTHEA / "conditions.csv")
    meds = load_med_flags(SYNTHEA / "medications.csv")
    obs = latest_obs(
        SYNTHEA / "observations.csv",
        {
            "Hemoglobin A1c/Hemoglobin.total in Blood",
            "Body Mass Index",
            "Systolic Blood Pressure",
            "Diastolic Blood Pressure",
        },
    )

    rows = []
    for patient_id, condition in conditions.items():
        if patient_id not in patients:
            continue
        if not (condition["diabetes"] or condition["prediabetes"]):
            continue
        person = patients[patient_id]
        rng = random.Random(f"{SEED}:{patient_id}:hba1c")
        labs = obs.get(patient_id, {})
        raw = labs.get("Hemoglobin A1c/Hemoglobin.total in Blood")
        raw_value = None if raw is None else raw[1]
        hba1c, source = choose_hba1c(raw_value, condition["diabetes"], rng)
        bmi = labs.get("Body Mass Index", (None, rng.uniform(24, 32)))[1]
        sbp = labs.get("Systolic Blood Pressure", (None, 128.0))[1]
        dbp = labs.get("Diastolic Blood Pressure", (None, 82.0))[1]
        med = meds.get(patient_id, {})
        rows.append(
            {
                "patient_id": patient_id,
                "age": age_on(person["BIRTHDATE"], REFERENCE),
                "sex": person["GENDER"],
                "bmi": round(bmi, 1),
                "diabetes_duration_years": years_between(condition["condition_start"], REFERENCE),
                "cohort": "diabetes" if condition["diabetes"] else "prediabetes",
                "hba1c_raw": "" if raw_value is None else round(raw_value, 1),
                "hba1c": hba1c,
                "hba1c_source": source,
                "on_metformin": int(med.get("metformin", False)),
                "on_sulfonylurea": int(med.get("sulfonylurea", False)),
                "on_insulin": int(med.get("insulin", False)),
                "systolic_bp": round(sbp, 1),
                "diastolic_bp": round(dbp, 1),
                "has_hypertension": int(condition["hypertension"] or sbp >= 140 or dbp >= 90),
                "has_ckd": int(condition["ckd"]),
            }
        )
    rows.sort(key=lambda item: item["patient_id"])
    return rows


def simulate_patient(
    person: dict,
    night_override: list[float] | None = None,
    step_scale: float = 1.0,
) -> list[tuple]:
    """Simulate 14 days. Overrides do not change the random stream.

    night_override replaces drawn sleep after the draw. step_scale multiplies
    daytime steps after they are drawn. With neither set, the rows match
    signals.csv for seed 2026.
    """
    rng = random.Random(f"{SEED}:{person['patient_id']}:signals")
    hba1c = float(person["hba1c"])
    bmi = float(person["bmi"])
    age = int(person["age"])
    insulin = int(person["on_insulin"]) == 1
    fasting = 28.7 * hba1c - 46.7 - 28.0
    day_peaks = [
        meal_peaks_for_day(rng, hba1c, person["cohort"], insulin) for _ in range(DAYS)
    ]

    nights = []
    for _ in range(DAYS):
        center = 6.1 if hba1c >= 7 else 6.7
        if bmi >= 30:
            center -= 0.4
        nights.append(min(9.0, max(3.5, rng.gauss(center, 0.85))))
    if night_override is not None:
        if len(night_override) != DAYS:
            raise ValueError(f"night_override must have {DAYS} values")
        nights = [min(9.0, max(3.5, float(value))) for value in night_override]

    resting = 64 + max(0.0, bmi - 24) * 0.4 + max(0, age - 50) * 0.15
    recent_steps = [0] * 12
    output = []
    for index in range(DAYS * STEPS_PER_DAY):
        day = index // STEPS_PER_DAY
        minute = (index % STEPS_PER_DAY) * STEP_MINUTES
        sleep_hours = nights[day]
        wake = 7 * 60
        sleep_start = wake - int(sleep_hours * 60)
        if sleep_start < 0:
            asleep = minute >= (1440 + sleep_start) or minute < wake
        else:
            asleep = sleep_start <= minute < wake

        if asleep:
            drawn_steps = 0
        elif rng.random() < 0.12:
            drawn_steps = int(rng.uniform(40, 180))
        else:
            drawn_steps = int(rng.uniform(0, 25))
        steps = drawn_steps if step_scale == 1.0 else int(drawn_steps * step_scale)
        recent_steps.pop(0)
        recent_steps.append(steps)

        glucose = fasting
        glucose += meal_effect(minute, day_peaks[day])
        if insulin and 90 < (minute - MEAL_MINUTES[0]) < 180:
            glucose -= 14
        if sleep_hours < 6 and 5 * 60 <= minute <= 9 * 60:
            glucose += (6 - sleep_hours) * 7
        glucose -= min(20.0, 0.025 * sum(recent_steps))
        glucose += rng.gauss(0, 4)
        glucose = min(320.0, max(60.0, glucose))

        heart = resting + steps * 0.12 + rng.gauss(0, 2)
        heart = min(160, max(48, int(round(heart))))
        stamp = START + timedelta(minutes=index * STEP_MINUTES)
        output.append(
            (
                person["patient_id"],
                stamp.strftime("%Y-%m-%dT%H:%M:%S"),
                round(glucose, 1),
                heart,
                steps,
                round(sleep_hours, 1),
            )
        )
    return output


def main() -> None:
    baseline = build_baseline()
    with BASELINE_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(baseline[0].keys()))
        writer.writeheader()
        writer.writerows(baseline)

    high = 0
    total = 0
    diabetes_high = 0
    diabetes_total = 0
    prediabetes_high = 0
    prediabetes_total = 0
    with SIGNALS_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "patient_id",
                "timestamp",
                "glucose_mg_dl",
                "heart_rate_bpm",
                "steps",
                "sleep_hours_last_night",
            ]
        )
        for person in baseline:
            for row in simulate_patient(person):
                writer.writerow(row)
                total += 1
                is_high = row[2] >= 180
                if is_high:
                    high += 1
                if person["cohort"] == "diabetes":
                    diabetes_total += 1
                    diabetes_high += int(is_high)
                else:
                    prediabetes_total += 1
                    prediabetes_high += int(is_high)

    imputed = sum(1 for row in baseline if row["hba1c_source"] != "synthea_lab")
    diabetes_n = sum(1 for row in baseline if row["cohort"] == "diabetes")
    print(f"patients {len(baseline)}")
    print(f"diabetes {diabetes_n}")
    print(f"prediabetes {len(baseline) - diabetes_n}")
    print(f"hba1c imputed {imputed}")
    print(f"signal rows {total}")
    print(f"glucose>=180 {high} ({100 * high / total:.2f}%)")
    print(f"diabetes glucose>=180 {diabetes_high} ({100 * diabetes_high / diabetes_total:.2f}%)")
    print(
        f"prediabetes glucose>=180 {prediabetes_high} ({100 * prediabetes_high / prediabetes_total:.2f}%)"
    )
    print(f"wrote {BASELINE_PATH}")
    print(f"wrote {SIGNALS_PATH}")


if __name__ == "__main__":
    main()
