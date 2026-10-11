"""Live evaluation of comment classification against the synthetic labelled set.

    python -m evaluation.run_comment_eval            # from backend/, with AI_PROVIDER/AI_MODEL/AI_API_KEY in backend/.env

Calls the configured provider through the same prompt, schema validation and alias mapping as production (no database
writes; usage is not recorded). Prints accuracy/macro-F1 and writes ``evaluation/results/<timestamp>.json`` (git-ignored).
This costs provider tokens. 30 synthetic examples are a smoke test of label behaviour, not a measure of production accuracy.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.ai.prompts import COMMENTS_PROMPT_VERSION, COMMENTS_SYSTEM, data_block
from app.ai.providers import build_provider
from app.ai.safety import injection_suspected, sanitize_untrusted
from app.ai.schemas import CommentLabelBatch, json_schema
from app.core.config import get_settings

from .scoring import load_dataset, score


def classify_all(dataset: list[dict], provider, batch_size: int) -> dict[str, dict]:
    predictions: dict[str, dict] = {}
    for start in range(0, len(dataset), batch_size):
        batch = dataset[start:start + batch_size]
        aliases = {f"c{i + 1}": item["id"] for i, item in enumerate(batch)}
        payload = [{"id": alias, "text": sanitize_untrusted(item["text"])} for alias, item in zip(aliases, batch)]
        result = provider.complete_structured(system=COMMENTS_SYSTEM, user=f"Classify each comment.\n{data_block('COMMENTS', payload)}",
                                              schema_name="CommentLabelBatch", schema=json_schema(CommentLabelBatch), max_output_tokens=2000)
        for label in CommentLabelBatch.model_validate(result.data).labels:
            if label.id in aliases:
                predictions[aliases[label.id]] = label.model_dump()
    return predictions


def main() -> int:
    settings = get_settings()
    if not settings.ai_enabled:
        print("AI_PROVIDER is 'none' — configure a provider in backend/.env to run the live evaluation.")
        return 2
    dataset = load_dataset()
    provider = build_provider(settings)
    try:
        predictions = classify_all(dataset, provider, settings.ai_comment_batch_size)
    finally:
        provider.close()
    report = score(dataset, predictions)
    report["injection_heuristic_recall"] = sum(1 for d in dataset if d["injection"] and injection_suspected(d["text"])) / max(1, sum(d["injection"] for d in dataset))
    report.update({"provider": settings.ai_provider, "model": settings.ai_model, "prompt_version": COMMENTS_PROMPT_VERSION,
                   "run_at": datetime.now(timezone.utc).isoformat()})
    out_dir = Path(__file__).with_name("results")
    out_dir.mkdir(exist_ok=True)
    path = out_dir / f"comments-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json"
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("n", "covered", "sentiment_accuracy", "intent_accuracy", "lead_signal_accuracy", "intent_macro_f1")}, indent=2))
    print(f"Full report: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
