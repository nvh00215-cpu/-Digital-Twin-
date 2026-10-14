"""Doctor view. Talks only to the GlycoTwin API."""

from __future__ import annotations

import requests
import streamlit as st

API = "http://127.0.0.1:8000"
st.set_page_config(page_title="GlycoTwin", layout="wide")


def get(path: str, **params):
    try:
        response = requests.get(f"{API}{path}", params=params, timeout=60)
    except requests.RequestException:
        st.error("The twin is unavailable. Start the API first: py -3 -m uvicorn backend.src.api:app --port 8000")
        st.stop()
    if response.status_code != 200:
        st.error(response.text)
        st.stop()
    return response.json()


st.title("GlycoTwin")
st.caption("Synthetic patient. Decision support. Not a treatment order.")
page = st.sidebar.radio("View", ["Cohort", "Patient twin", "About this result"])

if page == "Cohort":
    rows = get("/patients")
    demo = get("/health")["demo_patient"]["patient_id"]
    st.write(f"Pinned demo patient: `{demo}`")
    st.dataframe(
        rows,
        width="stretch",
        hide_index=True,
        column_config={
            "risk": st.column_config.NumberColumn("2-hour risk", format="%.2f"),
            "hba1c": st.column_config.NumberColumn("HbA1c", format="%.1f"),
        },
    )

elif page == "Patient twin":
    health = get("/health")
    roster = get("/patients")
    ids = [row["patient_id"] for row in roster]
    demo_id = health["demo_patient"]["patient_id"]
    choice = st.selectbox("Patient", ids, index=ids.index(demo_id) if demo_id in ids else 0)
    card = get(f"/patients/{choice}")
    left, center, right = st.columns([1, 1.4, 1])
    with left:
        st.subheader("Record")
        st.write(f"Age {card['age']}  ·  {card['sex']}  ·  BMI {card['bmi']}")
        st.write(f"{card['cohort']}  ·  {card['diabetes_duration_years']} years")
        st.write(f"HbA1c {card['hba1c']}% ({card['hba1c_source']})")
        st.write(f"Blood pressure {card['systolic_bp']}/{card['diastolic_bp']}")
        meds = []
        if card["on_metformin"]:
            meds.append("metformin")
        if card["on_sulfonylurea"]:
            meds.append("sulfonylurea")
        if card["on_insulin"]:
            meds.append("insulin")
        st.write("Medicines: " + (", ".join(meds) if meds else "none of the three flags"))
        st.write("Hypertension: " + ("yes" if card["has_hypertension"] else "no"))
        st.write("CKD: " + ("yes" if card["has_ckd"] else "no"))
    sleep = st.sidebar.slider("What-if: last night's sleep (hours)", 3.5, 9.0, 6.5, 0.1)
    steps = st.sidebar.slider("What-if: daytime step scale", 0.5, 3.0, 1.0, 0.1)
    use_what_if = st.sidebar.checkbox("Rescore with the what-if", value=False)
    params = {}
    if choice == demo_id and not use_what_if:
        params["at"] = health["demo_patient"]["decision_time"]
    if use_what_if:
        params["sleep_hours"] = sleep
        params["step_scale"] = steps
    scored = get(f"/patients/{choice}/predict", **params)
    with center:
        st.subheader("Last 6 hours")
        times = [point["timestamp"][11:16] for point in scored["window"]]
        st.line_chart(
            {"time": times, "glucose mg/dL": [point["glucose_mg_dl"] for point in scored["window"]]},
            x="time",
            y="glucose mg/dL",
        )
        st.line_chart(
            {"time": times, "steps": [point["steps"] for point in scored["window"]]},
            x="time",
            y="steps",
        )
    with right:
        st.subheader("Next 2 hours")
        risk = scored["spike_probability"]
        st.metric("Spike probability", f"{risk:.0%}", "Alert" if scored["alert"] else "Watch")
        st.caption("Alert when probability is 0.60 or higher. Threshold is 180 mg/dL.")
        curve = [{"minutes": point["minutes"], "glucose": point["glucose_mg_dl"]} for point in scored["curve"]]
        st.line_chart(curve, x="minutes", y="glucose")
        st.write("Why this score")
        for line in scored["reasons"]:
            st.write(f"- {line}")
        st.caption(f"Decision time {scored['decision_time']} · {scored['model']} · synthetic")

else:
    metrics = get("/metrics")
    st.subheader("Held-out patients")
    st.write(
        f"Test patients: {metrics['test_patients']}. "
        f"Positive rate: {metrics['test_positive_rate']:.1%}. "
        f"LightGBM AUROC: {metrics['auroc']}. "
        f"Current-glucose-only AUROC: {metrics['glucose_now_auroc']}. "
        f"Slope-only AUROC: {metrics['slope_only_auroc']}."
    )
    st.write(f"Curve mean absolute error (mg/dL): {metrics['curve_mae_mg_dl']}")
    band = metrics["same_glucose_band_140_to_160"]
    st.write(
        "Among decisions where glucose is already 140–160 mg/dL, "
        f"the 2-hour spike rate is {band['spike_rate_hba1c_below_7']:.1%} when HbA1c is under 7 "
        f"and {band['spike_rate_hba1c_7_or_higher']:.1%} when HbA1c is 7 or higher "
        f"({band['rows']} rows)."
    )
    st.write(
        "The wearable series is simulated from each patient's Synthea record with seed 2026. "
        "Metrics measure that simulated cohort. They are not a clinical validation."
    )
