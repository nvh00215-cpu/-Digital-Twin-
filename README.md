# GlycoTwin

Doctor-facing digital twin for Type 2 diabetes. It fuses one synthetic patient's clinic record with a 14-day wearable series and estimates whether glucose will reach 180 mg/dL within the next 2 hours.

Demo video: paste a short unlisted YouTube link here.

Team: replace this line with the team leader, members, and college before you submit.

The patients are synthetic. Held-out scores measure this simulation. They are not a clinical validation. The screen never recommends a drug dose.

## Problem statement

Type 2 diabetes is managed mostly between visits. A clinic record (HbA1c, medicines, blood pressure, comorbidities) and a wearable stream (glucose, heart rate, steps, sleep) usually sit in different systems, so a morning review cannot see both at the decision time.

The adverse event is timed and specific: any glucose sample above 180 mg/dL in the next 2 hours. A glucose value alone is a weak call. Two people can sit in the same 140–160 mg/dL band and have very different odds once HbA1c is known. The product need is a doctor view that sorts who to open first, shows the near-term curve, and lets the doctor rescore sleep and steps. It is a review aid for a clinic morning list. It is not a treatment order and not a patient-facing diagnosis.

Constraints for this build: open or synthetic data only, no real patient photos, no public health identifiers, and no dose advice.

## Solution

GlycoTwin keeps both streams on one `patient_id`.

1. A static record row holds age, sex, BMI, HbA1c, diabetes duration, blood pressure, hypertension, chronic kidney disease, and whether metformin, a sulfonylurea, or insulin is on the record.
2. A 5-minute series for 14 days holds glucose, heart rate, steps, and one sleep value per night.
3. Every 30 minutes the model reads only the past 6 hours plus the record, then returns a 2-hour spike probability, an alert at 60%, and glucose at +30, +60, +90, and +120 minutes.
4. The doctor signs in, sees the panel sorted by that risk, and opens one twin. Sleep and step sliders call the same model again and show the new numbers on screen. Nothing is written back.

Same glucose band, different record: among 4,005 decision rows already at 140–160 mg/dL, the 2-hour spike rate is 0.8% when HbA1c is under 7% and 29.7% when HbA1c is 7% or higher. Fusion changes the call when the recent trace looks the same.

## Architecture

```text
Synthea CSVs ---------------------> patients_baseline.csv
                                          |
                                          | patient_id
                                          v
formula wearable generator -------> signals.csv
                                          |
                                          v
decision rows every 30 min -------> train_rows.csv
  features end at time t                  |
  label uses (t, t+2h] only               v
                                    LightGBM bundle
                                    spike + 4 curve heads
                                          |
                                          v
                         FastAPI 127.0.0.1:8000  (reads only)
                                          |
                                          v
                         Next.js doctor UI :3000
                         browser never calls port 8000
```

| Layer | Role |
|---|---|
| Data | Synthea clinic fields plus a seeded wearable generator. Same patient id on every row. |
| Features | 6-hour window ending at the decision. The label and the curve targets use later glucose and are never copied into the feature list. |
| Model | One LightGBM classifier for the spike. Four LightGBM regressors for the curve. Saved in `backend/models/baseline.joblib`. |
| API | `GET /patients`, `GET /patients/{id}`, `GET /patients/{id}/series`, `GET /patients/{id}/predict`, `GET /metrics`, `GET /health`. What-if is a GET with `sleep_hours` and `step_scale`. It does not persist. |
| Doctor UI | Next.js App Router. Sign-in, risk-sorted list, one twin, model notes. The browser calls only Next.js. Next.js proxies to the API after a session cookie check. |
| Access | Doctor login lives in the UI. Passwords are bcrypt hashes in env. Each twin view appends doctor, patient id, and time to `frontend/logs/access.log`. |

### How to run

From the project folder, the trained bundle is already in the repo. To rebuild from scratch:

```powershell
py -3 -m pip install -r backend/requirements.txt
py -3 data/generate_signals.py
py -3 backend/src/make_dataset.py
py -3 backend/src/train_baseline.py
py -3 backend/src/validate_data.py
py -3 backend/src/write_docs.py
```

`validate_data.py` resimulates the first two patients and checks glucose and sleep against `signals.csv`, then recomputes labels. Seed 2026 makes a second run match. Notes are in `data/DATA_NOTES.txt`.

Start the API, then the doctor UI:

```powershell
py -3 -m uvicorn backend.src.api:app --port 8000
```

```powershell
cd frontend
copy .env.example .env.local
node scripts/hash-password.mjs "your-password"
npm install
npm run dev
```

Put the printed hash in `frontend/.env.local` as `DOCTOR_PASSWORD_HASH`. Write each `$` in that hash as `\$`. Set `DOCTOR_USERNAME` and a long `SESSION_SECRET`.

Open http://localhost:3000. `npm run build` then `npm run start` serves the same UI on port 3000.

## AI / Technical implementation

**Cohort.** 339 synthetic patients with diabetes or prediabetes. 222,384 decision rows, one every 30 minutes. Positive label: any glucose sample in the next 2 hours is at least 180 mg/dL. Cohort positive rate is 37.1% in diabetes and 5.6% in prediabetes.

**Split.** By patient, seed 2026, 70% train / 15% validation / 15% test, stratified by diabetes and prediabetes. A person in the test set contributes no training rows. Test set: 52 patients, 34,112 rows, positive rate 11.95%.

**Features used at time t.** Current glucose, 30-minute slope, 2-hour mean, 6-hour spread, share of the last 6 hours above 140 mg/dL, hour, steps in 2 hours, sleep last night, 2-hour heart-rate mean and spread, plus the record fields above. Future glucose is used only as the label and as the four curve targets.

**Model.** Native LightGBM. The alert is the classifier probability at or above 0.60. The curve does not decide the alert. Top gain features: glucose now, hour, HbA1c, 6-hour spread, 2-hour mean, 30-minute slope, share above 140 mg/dL, steps in 2 hours.

**Held-out comparison.**

| Score | AUROC |
|---|---|
| Record plus wearables | 0.9857 |
| Current glucose only | 0.7505 |
| 30-minute slope only | 0.6191 |

AUPRC 0.9117. Sensitivity at 80% specificity 0.9998. False alarms at the 0.60 threshold: 0.272 per patient-day. Curve mean absolute error: 5.46, 5.91, 6.36, and 7.55 mg/dL at +30, +60, +90, and +120 minutes.

**Why the AUROC is high.** The wearable series is generated from a known formula (HbA1c, meals, steps, sleep, insulin, small noise). The model is recovering that generator. The number is an internal check against two simpler rules on the same rows. It is not evidence that the same score would hold on a Dexcom or Libre export.

**What-if.** `GET /patients/{id}/predict?sleep_hours=&step_scale=` rebuilds the last night and the step scale in memory, then rescores. The UI displays the result. The API does not store it.

**Doctor UI checks.** Risk list with All / High / Moderate / Low. High matches the 0.60 alert. Moderate is 0.30 to just under 0.60 and Low is under 0.30; those two bands are display groups because the API returns a probability and an alert flag. Search is by patient id. The twin shows the history, the four forecast points, a dashed 180 mg/dL line, heart rate, steps, the record, and the reasons. Sleep hours are not a field on the series payload; the panel says so, and shows hours only when the API includes a short-sleep reason.

## Innovation and creativity

- **One patient, two clocks.** The join is on `patient_id` before any feature is built. A wearable-only or record-only model cannot make the 140–160 mg/dL comparison above.
- **A timed event, not a disease label.** The label is "glucose crosses 180 mg/dL inside the next 2 hours," computed from samples after the decision and kept out of the inputs.
- **Baselines on the same split.** Glucose-now and slope-only AUROC sit next to the fused model so the gain from the record is visible.
- **What-if without a new model.** Sleep and steps go back through the same simulator and the same LightGBM heads. The doctor sees a different risk. The chart does not invent a medicine.
- **Clinic workflow.** The list is sorted by risk for a morning review. The alert, the curve, and the record are on one page. Sign-out, model notes, and the synthetic-data footer are the only other navigation.
- **Privacy boundary.** The UI adds doctor login, an httpOnly session, and an access log. The prediction API stays a read-only local service. No real patient record is in the repo.

## Impact and scalability

**Who it is for.** A doctor reviewing a synthetic diabetes panel before clinic. The list answers "who is closest to a 2-hour spike," and the twin answers "what in the record and the last 6 hours is driving that."

**What changes in the visit.** The doctor opens high-risk rows first, sees HbA1c beside the trace, and can ask what last night's sleep or today's steps would do to the same model. The screen stops there. It does not choose a drug or a dose.

**What would have to be true at a larger scale.**

| Today | To serve a real clinic |
|---|---|
| Synthea fields and a formula wearable series | Consented CGM (Dexcom or Libre) and watch data, joined to the lab record inside the clinic |
| One doctor account in env | Clinic identity, assigned panels, and an audit log kept by the hospital |
| API bound to 127.0.0.1, model loaded in one process | A private deploy with the series store outside the request path |
| Scores on 52 held-out synthetic patients | A prospective check on real paired traces before any alert is shown to a patient |

**Ethics.** Training rows are synthetic. The repo has no public health identifiers. Avatars are initials. The footer on every signed-in page reads "Synthetic data, not clinically validated." A high AUROC on this generator is a reason to keep the model in the lab, not a reason to deploy it.

**Scale path that stays honest.** The same decision row (record + 6-hour window + 2-hour label) can be retrained when a clinic has consented pairs. The doctor page, the 180 mg/dL line, the 60% alert, and the what-if display do not have to change. The weights do. Until that dataset exists, GlycoTwin is a working prototype of the fusion, the timed prediction, and the morning-review screen.

## Submission

Put the public GitHub URL in the required repository field. Leave the live deployment field empty unless a host is actually serving http://localhost:3000. Paste the short demo link under the title if you record one.

## Layout

- `data/synthea/` — Synthea CSV sample (Walonoski et al., JAMIA, 2018)
- `data/patients_baseline.csv` — one clinical row per diabetes or prediabetes patient
- `data/signals.csv` — simulated wearables, same patient id
- `data/processed/train_rows.csv` — model table
- `backend/models/baseline.joblib` — spike model and four curve models
- `backend/src/api.py` — read-only API on port 8000
- `frontend/` — Next.js doctor UI on port 3000
- `docs/architecture.pdf` and `docs/presentation.pdf`
- License: MIT (`LICENSE`)
