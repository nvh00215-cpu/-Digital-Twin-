"""Write the architecture and results PDFs from the saved metrics."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
METRICS = json.loads((ROOT / "backend" / "outputs" / "metrics.json").read_text(encoding="utf-8"))
REPORT = json.loads((ROOT / "data" / "processed" / "dataset_report.json").read_text(encoding="utf-8"))


def architecture(pdf: PdfPages) -> None:
    figure, axis = plt.subplots(figsize=(11, 8.5))
    axis.set_xlim(0, 10)
    axis.set_ylim(0, 10)
    axis.axis("off")
    axis.set_title("GlycoTwin architecture", loc="left", fontsize=16)
    boxes = [
        (0.4, 7.6, "Synthea CSV\npatients, conditions,\nobservations, medicines"),
        (3.6, 7.6, "patients_baseline.csv\none row per person\nseed 2026"),
        (6.8, 7.6, "signals.csv\n5-minute glucose,\nheart rate, steps, sleep"),
        (2.0, 5.2, "Decision table\nevery 30 min\nfeatures end at time t"),
        (6.2, 5.2, "LightGBM\nspike probability\n+ glucose at +30/60/90/120"),
        (4.0, 2.6, "FastAPI 127.0.0.1:8000\n/patients  /series  /predict"),
        (4.0, 0.8, "Streamlit doctor view\nrecord, window, alert, what-if"),
    ]
    for x, y, text in boxes:
        axis.text(
            x,
            y,
            text,
            ha="center",
            va="center",
            fontsize=9,
            bbox={"boxstyle": "round", "facecolor": "white", "edgecolor": "black"},
        )
    axis.text(0.4, 0.3, "Same patient_id on the record and the wearable series. Synthetic glucose is not a watch recording.", fontsize=8)
    pdf.savefig(figure)
    plt.close(figure)


def results(pdf: PdfPages) -> None:
    pages = [
        (
            "GlycoTwin",
            "Type 2 diabetes twin. Predict whether glucose reaches 180 mg/dL in the next 2 hours.\n\n"
            "Add the team name and college on this page before submission.\n\n"
            f"Patients: {REPORT['patients']}. Decision rows: {REPORT['rows']}.\n"
            f"Diabetes 2-hour spike rate: {REPORT['positive_rate_by_cohort']['diabetes']}.\n"
            f"Prediabetes 2-hour spike rate: {REPORT['positive_rate_by_cohort']['prediabetes']}.\n"
            "Split by patient, seed 2026: 70% train, 15% validation, 15% test.",
        ),
        (
            "Data",
            "Static record: Synthea sample, diabetes and prediabetes only.\n"
            "HbA1c below a diabetic range is kept as hba1c_raw and replaced for the\n"
            "simulator. The source column says synthea_lab or imputed_from_diagnosis.\n\n"
            "Wearables: 14 days, every 5 minutes, generated with seed 2026 from\n"
            "28.7 x HbA1c - 46.7, meals at 08:00, 13:30 and 21:00, steps, sleep, and insulin.\n"
            "Sleep is one value per night, copied onto that calendar day.\n\n"
            "Rebuild: py -3 data/generate_signals.py\n"
            "         py -3 backend/src/make_dataset.py\n"
            "Check:   py -3 backend/src/validate_data.py",
        ),
        (
            "Held-out result",
            f"LightGBM AUROC: {METRICS['auroc']}\n"
            f"Current glucose alone AUROC: {METRICS['glucose_now_auroc']}\n"
            f"30-minute slope alone AUROC: {METRICS['slope_only_auroc']}\n"
            f"False alarms per patient-day at probability 0.60: {METRICS['false_alarms_per_patient_day_at_0.60']}\n"
            f"Curve mean absolute error (mg/dL): {METRICS['curve_mae_mg_dl']}\n\n"
            "Same current glucose, 140 to 160 mg/dL:\n"
            f"  spike rate if HbA1c < 7: {METRICS['same_glucose_band_140_to_160']['spike_rate_hba1c_below_7']}\n"
            f"  spike rate if HbA1c >= 7: {METRICS['same_glucose_band_140_to_160']['spike_rate_hba1c_7_or_higher']}\n\n"
            "The score is on simulated patients. It is not a clinical validation.",
        ),
    ]
    for title, body in pages:
        figure, axis = plt.subplots(figsize=(11, 8.5))
        axis.axis("off")
        axis.set_title(title, loc="left", fontsize=16)
        axis.text(0.02, 0.95, body, va="top", ha="left", fontsize=11, family="monospace", transform=axis.transAxes)
        pdf.savefig(figure)
        plt.close(figure)


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    with PdfPages(DOCS / "architecture.pdf") as pdf:
        architecture(pdf)
    with PdfPages(DOCS / "presentation.pdf") as pdf:
        results(pdf)
    print(f"wrote {DOCS / 'architecture.pdf'}")
    print(f"wrote {DOCS / 'presentation.pdf'}")


if __name__ == "__main__":
    main()
