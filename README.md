# GlycoTwin

Type 2 diabetes digital twin for the Happiest Health Digital Twin Challenge 2026. For one synthetic patient it joins a Synthea health record to a 5-minute wearable series and estimates whether glucose will reach 180 mg/dL in the next 2 hours.

The patients are synthetic. The glucose trace is simulated from that patient's HbA1c, meals, steps, sleep, and insulin. Held-out scores measure that simulation. They are not a clinical validation. The screen does not recommend a drug dose.

## Team

Replace this line with the team leader, members, and college before you submit.

## Result on held-out patients

Seed 2026. 52 test patients, split by person.

| Score | AUROC |
|---|---|
| LightGBM, record plus wearables | 0.986 |
| Current glucose only | 0.751 |
| 30-minute slope only | 0.619 |

False alarms at probability 0.60: 0.27 per patient-day. Curve error is about 5.5 to 7.6 mg/dL from +30 to +120 minutes.

When current glucose is already 140–160 mg/dL, the 2-hour spike rate is 0.8% if HbA1c is under 7 and 29.7% if HbA1c is 7 or higher. The record changes the call when the recent glucose looks the same.

## Reproduce

From this folder:

```powershell
py -3 -m pip install -r backend/requirements.txt
py -3 data/generate_signals.py
py -3 backend/src/make_dataset.py
py -3 backend/src/train_baseline.py
py -3 backend/src/validate_data.py
py -3 backend/src/write_docs.py
```

`validate_data.py` resimulates the first two patients and checks every glucose and sleep value against `signals.csv`. It also recomputes their labels. Seed 2026 makes a second run match. Details are in `data/DATA_NOTES.txt`.

## Run the demo

```powershell
py -3 -m uvicorn backend.src.api:app --port 8000
py -3 -m streamlit run frontend/app.py
```

Open the Streamlit URL. The cohort list is sorted by 2-hour risk. The pinned demo patient opens on a rising glucose trace. The sidebar can rescore last night's sleep and the daytime step scale. Both edits go back through the same simulator and the same model.

## Layout

- `data/synthea/` — Synthea CSV sample (Walonoski et al., JAMIA, 2018)
- `data/patients_baseline.csv` — one clinical row per diabetes or prediabetes patient
- `data/signals.csv` — simulated wearables, same patient id
- `data/processed/train_rows.csv` — model table
- `backend/models/baseline.joblib` — spike model and four curve models
- `docs/architecture.pdf` and `docs/presentation.pdf`
- License: MIT (`LICENSE`)

## Submission checklist

Fill in the team block above. Record a 15–20 minute unlisted YouTube demo and paste the link here. Keep this repository public.
