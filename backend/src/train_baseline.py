"""Train the spike model and the 2-hour glucose curve.

Writes backend/models/baseline.joblib and backend/outputs/metrics.json.
The same seed and the same patient split make a second run match this one.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import CURVE_MINUTES, FEATURES

ROOT = Path(__file__).resolve().parents[2]
ROWS = ROOT / "data" / "processed" / "train_rows.csv"
MODEL_DIR = ROOT / "backend" / "models"
OUT = ROOT / "backend" / "outputs"
SEED = 2026


def roc_auc(label: np.ndarray, score: np.ndarray) -> float:
    order = np.argsort(score)
    ranked = label[order]
    n_pos = float(np.sum(ranked == 1))
    n_neg = float(np.sum(ranked == 0))
    if n_pos == 0 or n_neg == 0:
        return 0.0
    sorted_score = score[order]
    ranks = np.empty(len(ranked), dtype=float)
    start = 0
    while start < len(ranked):
        end = start + 1
        while end < len(ranked) and sorted_score[end] == sorted_score[start]:
            end += 1
        ranks[start:end] = 0.5 * (start + 1 + end)
        start = end
    sum_pos = float(np.sum(ranks[ranked == 1]))
    return (sum_pos - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)


def average_precision(label: np.ndarray, score: np.ndarray) -> float:
    order = np.argsort(-score)
    ranked = label[order]
    hits = np.cumsum(ranked == 1)
    precision = hits / np.arange(1, len(ranked) + 1)
    positives = ranked == 1
    if not np.any(positives):
        return 0.0
    return float(np.mean(precision[positives]))


def sensitivity_at_specificity(label: np.ndarray, score: np.ndarray, specificity: float) -> float:
    order = np.argsort(-score)
    ranked = label[order]
    negatives = max(int(np.sum(ranked == 0)), 1)
    positives = max(int(np.sum(ranked == 1)), 1)
    false_positives = 0
    true_positives = 0
    best = 0.0
    for value in ranked:
        if value == 1:
            true_positives += 1
        else:
            false_positives += 1
        if (negatives - false_positives) / negatives >= specificity:
            best = true_positives / positives
        else:
            break
    return best


def false_alarms_per_day(frame: pd.DataFrame, probability: np.ndarray, threshold: float) -> float:
    false_alarms = int(np.sum((probability >= threshold) & (frame["label"].to_numpy() == 0)))
    days = frame.groupby("patient_id")["decision_time"].nunique().sum() / 48.0
    return false_alarms / max(float(days), 1e-6)


def fit_binary(train_x, train_y, valid_x, valid_y) -> lgb.Booster:
    train_set = lgb.Dataset(train_x, label=train_y, feature_name=list(train_x.columns))
    valid_set = lgb.Dataset(valid_x, label=valid_y, reference=train_set)
    return lgb.train(
        {
            "objective": "binary",
            "metric": "auc",
            "learning_rate": 0.05,
            "num_leaves": 31,
            "bagging_fraction": 0.8,
            "bagging_freq": 1,
            "feature_fraction": 0.8,
            "seed": SEED,
            "verbosity": -1,
        },
        train_set,
        num_boost_round=300,
        valid_sets=[valid_set],
        callbacks=[lgb.early_stopping(30, verbose=False)],
    )


def fit_regressor(train_x, train_y, valid_x, valid_y) -> lgb.Booster:
    train_set = lgb.Dataset(train_x, label=train_y, feature_name=list(train_x.columns))
    valid_set = lgb.Dataset(valid_x, label=valid_y, reference=train_set)
    return lgb.train(
        {
            "objective": "regression",
            "metric": "l2",
            "learning_rate": 0.05,
            "num_leaves": 31,
            "bagging_fraction": 0.8,
            "bagging_freq": 1,
            "feature_fraction": 0.8,
            "seed": SEED,
            "verbosity": -1,
        },
        train_set,
        num_boost_round=200,
        valid_sets=[valid_set],
        callbacks=[lgb.early_stopping(20, verbose=False)],
    )


def choose_demo(test: pd.DataFrame) -> dict:
    candidates = test[
        (test["cohort"] == "diabetes")
        & (test["label"] == 1)
        & (test["glucose_now"].between(140, 175))
        & (test["slope_30m"] >= 8)
    ]
    if candidates.empty:
        candidates = test[(test["label"] == 1) & (test["slope_30m"] > 0)]
    row = candidates.iloc[0]
    return {
        "patient_id": row["patient_id"],
        "decision_time": row["decision_time"],
        "glucose_now": float(row["glucose_now"]),
        "slope_30m": float(row["slope_30m"]),
        "hba1c": float(row["hba1c"]),
    }


def main() -> None:
    frame = pd.read_csv(ROWS)
    train = frame[frame["split"] == "train"]
    valid = frame[frame["split"] == "validation"]
    test = frame[frame["split"] == "test"]
    spike = fit_binary(train[FEATURES], train["label"], valid[FEATURES], valid["label"])
    probability = spike.predict(test[FEATURES])
    labels = test["label"].to_numpy()
    curves = {}
    curve_mae = {}
    for minutes in CURVE_MINUTES:
        target = f"y_glucose_{minutes}"
        curves[minutes] = fit_regressor(train[FEATURES], train[target], valid[FEATURES], valid[target])
        predicted = curves[minutes].predict(test[FEATURES])
        curve_mae[str(minutes)] = round(float(np.mean(np.abs(predicted - test[target].to_numpy()))), 2)

    band = test[test["glucose_now"].between(140, 160)]
    high_a1c = band[band["hba1c"] >= 7]["label"].mean() if len(band) else 0
    low_a1c = band[band["hba1c"] < 7]["label"].mean() if len(band) else 0
    gain = spike.feature_importance(importance_type="gain")
    importance = sorted(
        ({"feature": name, "gain": round(float(value), 1)} for name, value in zip(FEATURES, gain)),
        key=lambda item: item["gain"],
        reverse=True,
    )
    metrics = {
        "seed": SEED,
        "model": "lightgbm",
        "test_patients": int(test["patient_id"].nunique()),
        "test_rows": int(len(test)),
        "test_positive_rate": round(float(labels.mean()), 4),
        "auroc": round(float(roc_auc(labels, probability)), 4),
        "auprc": round(float(average_precision(labels, probability)), 4),
        "sensitivity_at_80_specificity": round(sensitivity_at_specificity(labels, probability, 0.80), 4),
        "false_alarms_per_patient_day_at_0.60": round(false_alarms_per_day(test, probability, 0.60), 3),
        "glucose_now_auroc": round(float(roc_auc(labels, test["glucose_now"].to_numpy())), 4),
        "slope_only_auroc": round(float(roc_auc(labels, test["slope_30m"].to_numpy())), 4),
        "curve_mae_mg_dl": curve_mae,
        "same_glucose_band_140_to_160": {
            "rows": int(len(band)),
            "spike_rate_hba1c_below_7": round(float(low_a1c), 4),
            "spike_rate_hba1c_7_or_higher": round(float(high_a1c), 4),
        },
        "feature_gain": importance[:8],
        "synthetic": True,
    }
    demo = choose_demo(test)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    joblib.dump({"spike": spike, "curves": curves, "features": FEATURES}, MODEL_DIR / "baseline.joblib")
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (OUT / "demo_patient.json").write_text(json.dumps(demo, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    print(json.dumps(demo, indent=2))


if __name__ == "__main__":
    main()
