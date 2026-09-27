"""Firestore trigger: every vote on a resident report changes the report author's credibility.

Rules (keep in sync with CONFIG.CRED_* in src/config/constants.ts):
  * everyone starts at 50;
  * each "Yes, me too" on one of your reports: +1; each "No, it works for me": -0.5;
  * below 40, the account (users/{uid}.reportBlockedUntil) and the device that sent the report
    (blockedDevices/{deviceId}) cannot report for 7 days; after that the score starts again from 50.
Official events and votes on your own reports do not count. Firestore rules refuse new reports while blocked.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from firebase_functions import firestore_fn
from google.cloud import firestore

from services.firestore_client import get_db

logger = logging.getLogger(__name__)

CRED_START = 50.0
CRED_YES = 1.0
CRED_NO = 0.5
CRED_MIN = 40.0
REPORT_BLOCK = timedelta(days=7)


@firestore.transactional
def _apply(txn, user_ref, device_ref, delta: float, now: datetime) -> None:
    data = user_ref.get(transaction=txn).to_dict() or {}
    until = data.get("reportBlockedUntil")
    if until and until > now:
        return  # still blocked: the score is frozen until the block ends
    score = CRED_START if until else float(data.get("credibilityScore", CRED_START))
    score += delta
    patch = {"credibilityScore": score, "reportBlockedUntil": None, "updatedAt": firestore.SERVER_TIMESTAMP}
    if score < CRED_MIN:
        blocked_until = now + REPORT_BLOCK
        patch["reportBlockedUntil"] = blocked_until
        if device_ref is not None:
            txn.set(device_ref, {"until": blocked_until, "uid": user_ref.id}, merge=True)
    txn.set(user_ref, patch, merge=True)


@firestore_fn.on_document_created(document="events/{eventId}/votes/{deviceId}", region="europe-west1")
def onVoteCreated(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    if event.data is None:
        return
    vote = (event.data.to_dict() or {}).get("vote")
    if vote not in ("yes", "no"):
        return

    db = get_db()
    report = db.collection("events").document(event.params["eventId"]).get()
    if not report.exists:
        return
    r = report.to_dict() or {}
    author = r.get("authorId")
    if r.get("sourceType") != "citizen" or not isinstance(author, str) or not author:
        return
    if (event.data.to_dict() or {}).get("uid") == author:
        return  # your own vote on your own report does not count

    device = r.get("authorDeviceId")
    device_ref = db.collection("blockedDevices").document(device) if isinstance(device, str) and device else None
    delta = CRED_YES if vote == "yes" else -CRED_NO
    try:
        _apply(db.transaction(), db.collection("users").document(author), device_ref, delta, datetime.now(timezone.utc))
    except Exception:
        logger.exception("Could not update credibility for %s", author)
