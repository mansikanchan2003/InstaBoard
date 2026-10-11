"""The only structures model output may take. Everything is validated here before it is stored or returned.

Free-text fields are length-bounded; enums are closed; extra keys are rejected (``extra="forbid"``).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Sentiment = Literal["positive", "neutral", "negative"]
# Comment intent categories (documented in the README). "other" covers anything else.
Intent = Literal["product_inquiry", "pricing_inquiry", "contact_request", "interest", "complaint_support", "spam_irrelevant", "other"]
Priority = Literal["high", "medium", "low"]
Uncertainty = Literal["low", "medium", "high"]
InsightCategory = Literal["campaign", "content", "audience", "comments", "leads"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ------------------------------------------------------------------------------- insights
class InsightDraft(_Strict):
    title: str = Field(min_length=8, max_length=140)
    summary: str = Field(min_length=20, max_length=400)
    category: InsightCategory
    observation: str = Field(min_length=10, max_length=600, description="What the cited evidence shows. Numbers only from cited evidence.")
    explanation: str = Field(min_length=10, max_length=700, description="Why it may matter. No causal claims from correlation.")
    recommended_action: str = Field(min_length=10, max_length=300, description="A concrete next step for a human to review.")
    priority: Priority
    evidence_ids: list[str] = Field(min_length=1, max_length=8, description="IDs of the evidence facts this insight relies on.")


class InsightBatch(_Strict):
    insights: list[InsightDraft] = Field(max_length=12)
    insufficient_data_note: str | None = Field(default=None, max_length=300)


# ----------------------------------------------------------------------------- comments
class CommentLabel(_Strict):
    id: str = Field(max_length=40)
    sentiment: Sentiment
    intent: Intent
    lead_signal: bool
    priority: Priority
    uncertainty: Uncertainty
    explanation: str = Field(min_length=3, max_length=240)


class CommentLabelBatch(_Strict):
    labels: list[CommentLabel] = Field(max_length=50)


# -------------------------------------------------------------------------------- leads
class LeadSummary(_Strict):
    summary: str = Field(min_length=10, max_length=500)
    follow_up_reason: str = Field(min_length=5, max_length=300)
    suggested_next_action: str = Field(min_length=5, max_length=240)
    uncertainty: Uncertainty


def json_schema(model: type[BaseModel]) -> dict:
    """JSON schema sent to providers (Pydantic's schema; validation is always repeated locally)."""
    return model.model_json_schema()
