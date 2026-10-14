"""Doctor-facing API. The dashboard is the only client."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query

from backend.src.predict import TwinStore

app = FastAPI(title="GlycoTwin")
STORE: TwinStore | None = None


@app.on_event("startup")
def startup() -> None:
    global STORE
    STORE = TwinStore()


def store() -> TwinStore:
    if STORE is None:
        raise HTTPException(status_code=503, detail="model is still loading")
    return STORE


@app.get("/health")
def health() -> dict:
    model = store()
    return {"status": "ok", "model": "lightgbm", "synthetic": True, "demo_patient": model.demo}


@app.get("/metrics")
def metrics() -> dict:
    return store().metrics


@app.get("/patients")
def patients() -> list[dict]:
    return store().cohort()


@app.get("/patients/{patient_id}")
def patient(patient_id: str) -> dict:
    try:
        return store().score(patient_id)["record"] | {"patient_id": patient_id}
    except KeyError:
        raise HTTPException(status_code=404, detail="unknown patient") from None


@app.get("/patients/{patient_id}/series")
def series(patient_id: str, hours: int = Query(default=6, ge=1, le=24)) -> list[dict]:
    try:
        window = store().score(patient_id)["window"]
    except KeyError:
        raise HTTPException(status_code=404, detail="unknown patient") from None
    keep = hours * 12
    return window[-keep:]


@app.get("/patients/{patient_id}/predict")
def predict(
    patient_id: str,
    at: str | None = None,
    sleep_hours: float | None = Query(default=None, ge=3.5, le=9.0),
    step_scale: float = Query(default=1.0, ge=0.2, le=4.0),
) -> dict:
    try:
        scored = store().score(patient_id, at=at, sleep_hours=sleep_hours, step_scale=step_scale)
    except KeyError:
        raise HTTPException(status_code=404, detail="unknown patient or decision time") from None
    scored.pop("record", None)
    return scored
