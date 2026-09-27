"""Locally poll Firestore and send Phase 6 alerts without Cloud Functions.

Run this in a second terminal beside ``dev_run.py``. Firestore markers are shared
with the eventual Cloud Function, so switching delivery adapters will not resend
events already delivered by this worker.
"""

from __future__ import annotations

import logging
import os
import time

from config import BOT_TOKEN
from services.firestore_client import get_db
from services.notification_service import is_eligible, notify_nearby_users

logger = logging.getLogger("local_notifications")
DEFAULT_INTERVAL_SECONDS = 30


def process_events() -> int:
    """Scan current events; per-recipient markers suppress duplicate messages."""
    db = get_db()
    sent = 0
    for snapshot in db.collection("events").stream():
        event = snapshot.to_dict() or {}
        if not is_eligible(event):
            continue
        try:
            sent += notify_nearby_users(snapshot.id, event, BOT_TOKEN)
        except Exception:
            # Keep processing other events. A later pass retries this event using
            # the same sending lease and per-chat delivery marker as production.
            logger.exception("Notification processing failed for event %s", snapshot.id)
    return sent


def main() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("APP_TELEGRAM_BOT_TOKEN is missing. Add it to telegram-bot/.env.")
    interval = int(os.getenv("TELEGRAM_NOTIFICATION_POLL_SECONDS", DEFAULT_INTERVAL_SECONDS))
    if interval < 5:
        raise ValueError("TELEGRAM_NOTIFICATION_POLL_SECONDS must be at least 5")

    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    logger.info("Starting local Telegram notification worker (poll interval: %ss)", interval)
    while True:
        try:
            sent = process_events()
            if sent:
                logger.info("Sent %d Telegram notification(s)", sent)
        except Exception:
            logger.exception("Firestore scan failed; will retry on the next pass")
        time.sleep(interval)


if __name__ == "__main__":
    main()
