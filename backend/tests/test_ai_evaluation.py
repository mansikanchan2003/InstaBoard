"""Evaluation suite (deterministic parts run always; the live provider evaluation is opt-in).

* Dataset integrity: every synthetic comment has valid labels.
* Scoring correctness: accuracy / per-class F1 on scripted predictions with known answers.
* Injection heuristic: recall on the attack examples and no false positives on the rest (deterministic).
* Campaign scenarios: the analytics formulas on synthetic data with hand-computed expected values.
* Live: ``INSTABOARD_LIVE_AI_EVAL=1`` runs the configured provider over the dataset (costs tokens; skipped otherwise).
"""

from __future__ import annotations

import os

import pytest

from app.ai.safety import injection_suspected
from app.ai.schemas import CommentLabel
from app.services.intelligence import analytics
from evaluation.scoring import load_dataset, score

DATASET = load_dataset()
INTENTS = set(CommentLabel.model_fields["intent"].annotation.__args__)  # type: ignore[attr-defined]


def test_dataset_is_well_formed():
    assert len(DATASET) == 30 and len({d["id"] for d in DATASET}) == 30
    for d in DATASET:
        assert d["sentiment"] in ("positive", "neutral", "negative") and d["intent"] in INTENTS and isinstance(d["lead_signal"], bool)
    assert {d["intent"] for d in DATASET} == INTENTS  # every category is represented


def test_scoring_math_on_known_predictions():
    gold = DATASET[:4]
    predictions = {
        gold[0]["id"]: {**{k: gold[0][k] for k in ("sentiment", "intent", "lead_signal")}},
        gold[1]["id"]: {**{k: gold[1][k] for k in ("sentiment", "lead_signal")}, "intent": "other"},
        gold[2]["id"]: {**{k: gold[2][k] for k in ("sentiment", "intent", "lead_signal")}},
        # gold[3] missing → counted wrong, coverage 3/4
    }
    result = score(gold, predictions)
    assert result["covered"] == 3 and result["intent_accuracy"] == 0.5 and result["sentiment_accuracy"] == 0.75
    assert result["intent_per_class"]["pricing_inquiry"]["recall"] == 0.0
    assert result["intent_confusion"]["pricing_inquiry"] == {"other": 1}


def test_perfect_predictions_score_one():
    predictions = {d["id"]: {k: d[k] for k in ("sentiment", "intent", "lead_signal")} for d in DATASET}
    result = score(DATASET, predictions)
    assert result["intent_accuracy"] == result["sentiment_accuracy"] == result["lead_signal_accuracy"] == result["intent_macro_f1"] == 1.0


def test_injection_heuristic_on_the_dataset():
    attacks = [d for d in DATASET if d["injection"]]
    benign = [d for d in DATASET if not d["injection"]]
    assert all(injection_suspected(d["text"]) for d in attacks)  # recall 3/3 on this set
    assert not any(injection_suspected(d["text"]) for d in benign)  # no false positives on this set


# Campaign scenarios: synthetic rows with hand-computed expectations for the documented formulas.
SCENARIOS = [
    ("all complete", [{"reach": 1000, "likes": 50, "comments": 10, "shares": 5, "saves": 15}, {"reach": 3000, "likes": 90, "comments": 20, "shares": 10, "saves": 0}],
     {"n": 2, "missing": 0, "engagements": 200, "reach": 4000, "rate": 5.0}),
    ("reach-weighted, not mean of ratios", [{"reach": 100, "likes": 50, "comments": 0, "shares": 0, "saves": 0}, {"reach": 9900, "likes": 50, "comments": 0, "shares": 0, "saves": 0}],
     {"n": 2, "missing": 0, "engagements": 100, "reach": 10000, "rate": 1.0}),
    ("missing value excluded from both sides", [{"reach": 1000, "likes": 10, "comments": 0, "shares": 0, "saves": 0}, {"reach": 5000, "likes": None, "comments": 9, "shares": 9, "saves": 9}],
     {"n": 1, "missing": 1, "engagements": 10, "reach": 1000, "rate": 1.0}),
    ("nothing measurable", [{"reach": None, "likes": 1, "comments": 1, "shares": 1, "saves": 1}], {"n": 0, "missing": 1, "engagements": None, "reach": None, "rate": None}),
]


@pytest.mark.parametrize("name,rows,expected", SCENARIOS, ids=[s[0] for s in SCENARIOS])
def test_campaign_scenarios(name, rows, expected):
    assert analytics.engagement_totals(rows) == expected


def test_conversion_and_change_definitions():
    assert analytics.safe_ratio(3, 12) == 25.0  # 3 converted of 12 attributed leads
    assert analytics.safe_ratio(12, 4000, 1000.0) == 3.0  # 12 leads per 4,000 reach → 3 per 1,000
    assert analytics.pct_change(80, 100) == -20.0 and abs(analytics.pct_change(80, 100)) >= analytics.NOTABLE_CHANGE_PCT


@pytest.mark.skipif(os.environ.get("INSTABOARD_LIVE_AI_EVAL") != "1", reason="live provider evaluation is opt-in (INSTABOARD_LIVE_AI_EVAL=1; costs tokens)")
def test_live_comment_classification_evaluation():  # pragma: no cover - requires a configured provider
    from app.ai.providers import build_provider
    from app.core.config import get_settings
    from evaluation.run_comment_eval import classify_all

    settings = get_settings()
    provider = build_provider(settings)
    try:
        result = score(DATASET, classify_all(DATASET, provider, settings.ai_comment_batch_size))
    finally:
        provider.close()
    print(result)
    assert result["covered"] == len(DATASET)
