"""AI comment classification (predictions only — originals are never modified, nothing is sent to Instagram).

* Sources: ``workspace`` = the ``comments`` table; ``instagram`` = ``instagram_comments`` fetched with the account's
  permission (Phase 5). Both are tenant-scoped.
* Untrusted text: sanitised, length-bounded and sent as delimited JSON under *local* aliases (c1, c2 …) — no database
  ids, usernames, handles or locations reach the model. Returned ids must be exactly the aliases sent; anything else
  is ignored. The model has no tools, so a comment cannot trigger an action. Heuristically suspicious text
  (``injection_suspected``) is still classified but always left for human review.
* Idempotent: a comment is skipped when a classification for the same classifier version (prompt version + model)
  and the same text hash exists. Changing the prompt/model creates a new version, so reprocessing is deliberate.
* Human review: ``review`` stores the corrected labels next to (not over) the AI prediction.
"""

from __future__ import annotations

import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.ai.prompts import COMMENTS_PROMPT_VERSION, COMMENTS_SYSTEM, data_block
from app.ai.safety import injection_suspected, sanitize_untrusted
from app.ai.schemas import CommentLabelBatch
from app.ai.service import AIGateway
from app.core.config import Settings
from app.core.errors import NotFoundError, UnprocessableError
from app.models import Comment, CommentClassification, InstagramComment
from app.services.common import utcnow

SENTIMENTS = ("positive", "neutral", "negative")
INTENTS = ("product_inquiry", "pricing_inquiry", "contact_request", "interest", "complaint_support", "spam_irrelevant", "other")


def classifier_version(gateway: AIGateway) -> str:
    return f"{COMMENTS_PROMPT_VERSION}|{gateway.model_key}"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _load(db: Session, source: str, ids: list[str] | None, limit: int) -> list[tuple[str, str]]:
    if source == "workspace":
        query = select(Comment.id, Comment.text).order_by(Comment.received_at.desc())
        if ids:
            query = query.where(Comment.id.in_(ids))
    elif source == "instagram":
        query = select(InstagramComment.id, InstagramComment.text).where(InstagramComment.text.is_not(None)).order_by(InstagramComment.commented_at.desc().nulls_last())
        if ids:
            query = query.where(InstagramComment.id.in_(ids))
    else:
        raise UnprocessableError("Unknown comment source.", details={"field": "source"})
    return [(cid, text or "") for cid, text in db.execute(query.limit(limit * 3))]


def pending_comments(db: Session, gateway: AIGateway, source: str, ids: list[str] | None, limit: int) -> list[tuple[str, str, str]]:
    """(comment id, sanitised text, text hash) for comments without a current classification."""
    version = classifier_version(gateway)
    rows = _load(db, source, ids, limit)
    done = {(cid, h) for cid, h in db.execute(select(CommentClassification.comment_id, CommentClassification.text_hash).where(
        CommentClassification.source == source, CommentClassification.classifier_version == version,
        CommentClassification.comment_id.in_([r[0] for r in rows] or [""])))}
    out = []
    for cid, text in rows:
        clean = sanitize_untrusted(text)
        h = text_hash(clean)
        if clean and (cid, h) not in done:
            out.append((cid, clean, h))
        if len(out) >= limit:
            break
    return out


def classify(db: Session, settings: Settings, gateway: AIGateway, *, source: str, ids: list[str] | None, job_id: str | None,
             progress=lambda stage, pct: None) -> dict:
    pending = pending_comments(db, gateway, source, ids, settings.ai_comment_job_limit)
    version = classifier_version(gateway)
    stored = skipped = 0
    batch_size = settings.ai_comment_batch_size
    batches = [pending[i:i + batch_size] for i in range(0, len(pending), batch_size)]
    for index, batch in enumerate(batches, 1):
        aliases = {f"c{n + 1}": item for n, item in enumerate(batch)}
        payload = [{"id": alias, "text": item[1]} for alias, item in aliases.items()]
        gen = gateway.generate(task="comment_classification", prompt_version=COMMENTS_PROMPT_VERSION, schema=CommentLabelBatch, job_id=job_id,
                               system=COMMENTS_SYSTEM, user=f"Classify each comment.\n{data_block('COMMENTS', payload)}")
        seen: set[str] = set()
        for label in gen.output.labels:  # type: ignore[attr-defined]
            if label.id not in aliases or label.id in seen:
                continue  # never trust ids the model invents or repeats
            seen.add(label.id)
            cid, clean, h = aliases[label.id]
            suspicious = injection_suspected(clean)
            result = db.execute(insert(CommentClassification).values(
                id=f"cls_{secrets.token_hex(8)}", workspace_id=gateway.workspace_id, source=source, comment_id=cid, text_hash=h,
                classifier_version=version, sentiment=label.sentiment, intent=label.intent, lead_signal=label.lead_signal,
                priority="high" if suspicious and label.priority == "low" else label.priority,
                uncertainty="high" if suspicious else label.uncertainty, explanation=sanitize_untrusted(label.explanation, max_chars=240),
                injection_suspected=suspicious, review_status="unreviewed", job_id=job_id,
            ).on_conflict_do_nothing(constraint="uq_comment_classifications_version").returning(CommentClassification.id))
            stored += int(result.scalar() is not None)
        skipped += len(aliases) - len(seen)
        db.commit()  # each batch is durable; a retry continues with the remaining comments
        progress("classifying", 10 + int(85 * index / max(len(batches), 1)))
    return {"source": source, "requested": len(pending), "classified": stored, "unlabelled": skipped, "classifierVersion": version}


def latest_for(db: Session, source: str, comment_ids: list[str] | None, review_status: str | None, limit: int) -> list[CommentClassification]:
    query = select(CommentClassification).where(CommentClassification.source == source).order_by(
        CommentClassification.comment_id, CommentClassification.created_at.desc())
    if comment_ids:
        query = query.where(CommentClassification.comment_id.in_(comment_ids))
    if review_status:
        query = query.where(CommentClassification.review_status == review_status)
    latest: dict[str, CommentClassification] = {}
    for row in db.scalars(query.limit(limit * 4)):
        latest.setdefault(row.comment_id, row)  # newest classification per comment
    return list(latest.values())[:limit]


def review(db: Session, classification_id: str, *, member_id: str, status: str, sentiment: str | None, intent: str | None,
           lead_signal: bool | None) -> CommentClassification:
    row = db.get(CommentClassification, classification_id)
    if row is None:
        raise NotFoundError("Comment classification", classification_id)
    if status == "corrected" and sentiment is None and intent is None and lead_signal is None:
        raise UnprocessableError("A correction needs at least one corrected label.")
    row.review_status = status
    row.reviewed_sentiment = sentiment if status == "corrected" else None
    row.reviewed_intent = intent if status == "corrected" else None
    row.reviewed_lead_signal = lead_signal if status == "corrected" else None
    row.reviewed_by_member_id, row.reviewed_at = member_id, utcnow()
    return row
