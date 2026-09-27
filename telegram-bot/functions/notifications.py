"""Firestore trigger for proximity-based Telegram notifications."""

from __future__ import annotations

import logging

from firebase_functions import firestore_fn
from services.notification_service import is_eligible, notify_nearby_users
from functions.secrets import BOT_TOKEN_SECRET

logger = logging.getLogger(__name__)
@firestore_fn.on_document_written(
    document="events/{eventId}",
    region="europe-west1",
    secrets=[BOT_TOKEN_SECRET],
)
def onEventWritten(event) -> None:
    after = event.data.after
    if after is None or not after.exists:
        return
    event_data = after.to_dict() or {}
    if not is_eligible(event_data):
        return
    try:
        sent = notify_nearby_users(event.params["eventId"], event_data, BOT_TOKEN_SECRET.value)
        logger.info("Processed event %s; sent %d Telegram notification(s)", event.params["eventId"], sent)
    except Exception:
        logger.exception("Telegram notification processing failed for event %s", event.params["eventId"])
        raise
