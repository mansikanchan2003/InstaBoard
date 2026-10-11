"""Scoring helpers for the comment-classification evaluation."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

DATASET = Path(__file__).with_name("comments_eval.jsonl")
FIELDS = ("sentiment", "intent", "lead_signal")


def load_dataset(path: Path = DATASET) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def score(gold: list[dict], predictions: dict[str, dict]) -> dict:
    """Accuracy per field, per-class precision/recall/F1 and macro-F1 for intent, coverage and a confusion table.
    Items without a prediction count as wrong (coverage is reported separately)."""
    out: dict = {"n": len(gold), "covered": sum(1 for g in gold if g["id"] in predictions)}
    for field in FIELDS:
        correct = sum(1 for g in gold if g["id"] in predictions and predictions[g["id"]].get(field) == g[field])
        out[f"{field}_accuracy"] = round(correct / len(gold), 4) if gold else None
    labels = sorted({g["intent"] for g in gold} | {p.get("intent") for p in predictions.values() if p.get("intent")})
    per_class, f1s = {}, []
    confusion: dict[str, Counter] = defaultdict(Counter)
    for g in gold:
        confusion[g["intent"]][predictions.get(g["id"], {}).get("intent", "<missing>")] += 1
    for label in labels:
        tp = sum(1 for g in gold if g["intent"] == label and predictions.get(g["id"], {}).get("intent") == label)
        fp = sum(1 for g in gold if g["intent"] != label and predictions.get(g["id"], {}).get("intent") == label)
        fn = sum(1 for g in gold if g["intent"] == label and predictions.get(g["id"], {}).get("intent") != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4), "support": tp + fn}
        if tp + fn:
            f1s.append(f1)
    out["intent_per_class"] = per_class
    out["intent_macro_f1"] = round(sum(f1s) / len(f1s), 4) if f1s else None
    out["intent_confusion"] = {k: dict(v) for k, v in confusion.items()}
    return out
