"""Authenticated Telegram webhook endpoint for Firebase Cloud Functions."""

from __future__ import annotations

import asyncio
import hmac
import logging
from datetime import datetime, timedelta, timezone

from firebase_admin import firestore
from firebase_functions import https_fn
from telegram import Update

from bot.app import build_app
from services.firestore_client import get_db
from services.telegram_persistence import FirestorePersistence
from functions.secrets import BOT_TOKEN_SECRET, TELEGRAM_WEBHOOK_SECRET

logger = logging.getLogger(__name__)
UPDATE_LEASE = timedelta(minutes=2)
UPDATE_RETENTION = timedelta(days=3)


def _claim_update(update_id: int) -> str:
    """Claim an update, returning ``claimed``, ``done``, or ``busy``."""
    db = get_db()
    reference = db.collection("telegramWebhookUpdates").document(str(update_id))
    transaction = db.transaction()

    @firestore.transactional
    def claim(txn):
        now = datetime.now(timezone.utc)
        snapshot = reference.get(transaction=txn)
        data = snapshot.to_dict() or {}
        if data.get("status") == "processed":
            return "done"
        lease = data.get("leaseUntil")
        if data.get("status") == "processing" and isinstance(lease, datetime) and lease > now:
            return "busy"
        txn.set(reference, {
            "status": "processing",
            "leaseUntil": now + UPDATE_LEASE,
            "expiresAt": now + UPDATE_RETENTION,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return "claimed"

    return claim(transaction)


def _finish_update(update_id: int, status: str) -> None:
    reference = get_db().collection("telegramWebhookUpdates").document(str(update_id))
    now = datetime.now(timezone.utc)
    reference.set({
        "status": status,
        "leaseUntil": None,
        "expiresAt": now + UPDATE_RETENTION,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)


async def _process_update(payload: dict, bot_token: str) -> None:
    application = build_app(token=bot_token, persistence=FirestorePersistence())
    initialized = False
    try:
        await application.initialize()
        initialized = True
        update = Update.de_json(payload, application.bot)
        await application.process_update(update)
        await application.update_persistence()
    finally:
        if initialized:
            await application.shutdown()


@https_fn.on_request(
    region="europe-west1",
    timeout_sec=60,
    concurrency=1,
    max_instances=1,
    secrets=[BOT_TOKEN_SECRET, TELEGRAM_WEBHOOK_SECRET],
)
def telegramWebhook(req: https_fn.Request) -> https_fn.Response:
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)
    if req.content_length is not None and req.content_length > 1_000_000:
        return https_fn.Response("Request too large", status=413)

    expected_secret = TELEGRAM_WEBHOOK_SECRET.value
    provided_secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not expected_secret or not hmac.compare_digest(provided_secret, expected_secret):
        return https_fn.Response("Unauthorized", status=401)

    payload = req.get_json(silent=True)
    if not isinstance(payload, dict) or type(payload.get("update_id")) is not int:
        return https_fn.Response("Invalid Telegram update", status=400)

    update_id = payload["update_id"]
    try:
        claim = _claim_update(update_id)
    except Exception:
        logger.exception("Could not claim Telegram update %s", update_id)
        return https_fn.Response("Temporarily unavailable", status=503)
    if claim in {"done", "busy"}:
        return https_fn.Response("OK", status=200)

    try:
        asyncio.run(_process_update(payload, BOT_TOKEN_SECRET.value))
        _finish_update(update_id, "processed")
    except Exception:
        logger.exception("Telegram webhook update %s failed", update_id)
        try:
            _finish_update(update_id, "failed")
        except Exception:
            logger.exception("Could not release Telegram update %s", update_id)
        return https_fn.Response("Processing failed", status=500)
    return https_fn.Response("OK", status=200)
