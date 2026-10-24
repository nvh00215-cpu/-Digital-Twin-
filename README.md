# GlycoTwin: Type 2 Diabetes Digital Twin

Youtube Demo Video : https://youtu.be/R-I0pyNmTA0

Live App : https://digital-twin-roan.vercel.app/

API Link : https://digital-twin-31qd.onrender.com

Happiest Health Digital Twin Challenge 2026

GlycoTwin is a doctor-facing digital twin for Type 2 diabetes. For one synthetic patient it joins a clinic record to a 14-day wearable trace and estimates whether glucose will reach 180 mg/dL in the next 2 hours.

The patients are synthetic. Held-out scores measure this simulation. They are not a clinical validation. The screen never recommends a drug dose.

## 1. Team details

| | |
|---|---|
| Team name | Aeternum |
| Team leader | Naveen V Hiremath |
| College | Dr Ambedkar Institute Of Technology |

## 2. Project title

GlycoTwin: Type 2 Diabetes Digital Twin

## 3. Problem statement and healthcare use case

Type 2 diabetes is managed mostly between visits. A clinic record (HbA1c, medicines, blood pressure, comorbidities) and a wearable stream (glucose, heart rate, steps, sleep) usually sit in different systems, so a morning review cannot see both at the decision time.

The adverse event is timed and specific: any glucose sample above 180 mg/dL in the next 2 hours. A glucose value alone is a weak call. Two people can sit in the same 140–160 mg/dL band and have very different odds once HbA1c is known.

**Use case.** A doctor reviews a diabetes panel before clinic. The list sorts who to open first, the twin shows the near-term glucose curve beside the record, and the doctor can rescore sleep and steps. It is a review aid for a clinic morning list. It is not a treatment order and not a patient-facing diagnosis.

**Constraints for this build.** Open or synthetic data only, no real patient photos, no public health identifiers, and no dose advice.

**The key result.** Among 4,005 decision rows already at 140–160 mg/dL, the 2-hour spike rate is 0.8% when HbA1c is under 7% and 29.7% when HbA1c is 7% or higher. Fusing the record with the wearable trace changes the call when the recent glucose looks the same.

## 4. Technical stack, AI/ML model and framework details

| Layer | Technology |
|---|---|
| Record data | Synthea synthetic clinic records (Walonoski et al., JAMIA, 2018) |
| Wearable data | Seeded formula generator (seed 2026): glucose, heart rate, steps, one sleep value per night, 5-minute series |
| ML | LightGBM: one classifier for the 2-hour spike and four regressors for the glucose curve |
| API | FastAPI (Python), read-only, 127.0.0.1:8000 |
| Doctor UI | Next.js App Router (TypeScript), port 3000, proxies to the API |
| Access | bcrypt-hashed password in env, httpOnly session cookie, access log |

### Data

339 synthetic patients with diabetes or prediabetes. The same `patient_id` joins both tables. The record holds age, sex, BMI, HbA1c, diabetes duration, blood pressure, hypertension, chronic kidney disease, and whether metformin, a sulfonylurea, or insulin is on the record. These are not real watches and not lab continuous glucose.

### Model

- Every 30 minutes the model sees only the past 6 hours plus the record. Features end at time `t`. Future glucose is used only as the label and as the four curve targets.
- **Spike label:** any glucose sample in (t, t+2h] at or above 180 mg/dL. 222,384 decision rows in total.
- **Alert:** the classifier probability at or above 0.60. The curve does not decide the alert.
- **Curve:** four LightGBM regressors draw glucose at +30, +60, +90 and +120 minutes.
- **Features:** current glucose, 30-minute slope, 2-hour mean, 6-hour spread, share of the last 6 hours above 140 mg/dL, hour, steps in 2 hours, sleep last night, 2-hour heart-rate mean and spread, plus the record fields.
- Top gain features: glucose now, hour, HbA1c, 6-hour spread, 2-hour mean, 30-minute slope, share above 140 mg/dL, steps in 2 hours.
- Saved in `backend/models/baseline.joblib`.

### Split and results

People are split by person (seed 2026, 70% train / 15% validation / 15% test, stratified by diabetes and prediabetes), so a test patient never appears in training. Test set: 52 patients, 34,112 rows, positive rate 11.95%.

| Score on 52 held-out patients | AUROC |
|---|---|
| Record plus wearables (fused) | 0.9857 |
| Current glucose only | 0.7505 |
| 30-minute slope only | 0.6191 |

AUPRC 0.9117. False alarms at the 0.60 threshold: 0.272 per patient-day. Curve mean absolute error: 5.46, 5.91, 6.36 and 7.55 mg/dL at +30, +60, +90 and +120 minutes.

**Why the AUROC is high.** The wearable series is generated from a known formula (HbA1c, meals, steps, sleep, insulin, small noise), so the model is recovering that generator. The number is an internal check against two simpler rules on the same rows. It is not evidence that the same score would hold on a Dexcom or Libre export.

### API

`GET /patients`, `GET /patients/{id}`, `GET /patients/{id}/series`, `GET /patients/{id}/predict`, `GET /metrics`, `GET /health`. What-if is a GET with `sleep_hours` and `step_scale`. It does not persist.

### Doctor UI features

1. **Risk-sorted list.** Sorted by 2-hour risk, with All, High, Moderate and Low filters and search by patient id. High matches the 0.60 alert. Moderate is 0.30 to just under 0.60 and Low is under 0.30.
2. **Record first.** A patient page opens with HbA1c, BMI, blood pressure, diabetes duration and medicines on record, then the glucose chart.
3. **Same glucose, different record.** Two held-out moments, both at 148.5 mg/dL, sit side by side. HbA1c 6.0% did not reach 180 mg/dL in the next 2 hours. HbA1c 7.8% did. Each card shows the live risk and forecast.
4. **14-day replay.** A slider moves the decision from 5 January 2026, 06:00 through 18 January 2026, 21:30. The chart, heart rate, steps, alert and forecast follow that time.
5. **What-if in words.** Sleep and step sliders rescore the same model and state the change in words. Nothing is saved.
6. **One hit and one miss.** Model notes pin one held-out alert that was right (glucose 176.5 mg/dL, then a real spike) and one that was wrong (glucose 168.2 mg/dL, alert on, no spike in the next 2 hours), each with patient id, time, probability and curve.
7. **Footer on every signed-in page:** "Synthetic data, not clinically validated."

### Architecture

The architecture diagram is in [`docs/GlycoTwin_Architecture.pdf`](docs/GlycoTwin_Architecture.pdf).

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

### How to run

The trained bundle is already in the repo. To rebuild from scratch:

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


##  Open-source license

MIT License. See [`LICENSE`](LICENSE). Synthea is used under its own open-source license.

##  Architecture diagram

[`docs/GlycoTwin_Architecture.pdf`](docs/GlycoTwin_Architecture.pdf)

##  Presentation and outcome

[`docs/GlycoTwin_SCR_Deck.pptx`](docs/GlycoTwin_SCR_Deck.pptx) covers the situation, the complication and the resolution.

**Outcome.**

- The fused model scores AUROC 0.986 on 52 held-out patients, against 0.751 for glucose alone and 0.619 for the 30-minute slope alone.
- In the 140–160 mg/dL band, the 2-hour spike rate is 0.8% when HbA1c is under 7% and 29.7% when it is 7% or higher.
- The doctor UI shows the risk-sorted list, the record first, two same-glucose moments, a 14-day replay, what-if sliders in words, and one right and one wrong alert.
- The high score describes a formula-generated series. It is not a clinical validation.

## Innovation and impact

**Innovation**

- **One patient, two clocks.** The join is on `patient_id` before any feature is built. A wearable-only or record-only model cannot make the 140–160 mg/dL comparison above.
- **A timed event, not a disease label.** The label is "glucose crosses 180 mg/dL inside the next 2 hours," computed from samples after the decision and kept out of the inputs.
- **Baselines on the same split.** Glucose-now and slope-only AUROC sit next to the fused model so the gain from the record is visible.
- **What-if without a new model.** Sleep and steps go back through the same simulator and the same LightGBM heads. The chart does not invent a medicine.
- **Privacy boundary.** The UI adds doctor login, an httpOnly session and an access log (`frontend/logs/access.log`). The prediction API stays a read-only local service. No real patient record is in the repo.

**Impact and scale path**

| Today | To serve a real clinic |
|---|---|
| Synthea fields and a formula wearable series | Consented CGM (Dexcom or Libre) and watch data, joined to the lab record inside the clinic |
| One doctor account in env | Clinic identity, assigned panels, and an audit log kept by the hospital |
| API bound to 127.0.0.1, model loaded in one process | A private deploy with the series store outside the request path |
| Scores on 52 held-out synthetic patients | A prospective check on real paired traces before any alert is shown to a patient |

**Ethics.** Training rows are synthetic and the repo has no public health identifiers. A high AUROC on this generator is a reason to keep the model in the lab, not a reason to deploy it.

## Repository layout

- `data/synthea/`: Synthea CSV sample
- `data/patients_baseline.csv`: one clinical row per diabetes or prediabetes patient
- `data/signals.csv`: simulated wearables, same patient id
- `data/processed/train_rows.csv`: model table
- `backend/models/baseline.joblib`: spike model and four curve models
- `backend/src/api.py`: read-only API on port 8000
- `frontend/`: Next.js doctor UI on port 3000
- `docs/GlycoTwin_Architecture.pdf`: architecture diagram
- `docs/GlycoTwin_SCR_Deck.pptx`: presentation
- `LICENSE`: MIT
