"""One-time Telegram account-link tokens stored in Firestore."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from google.cloud import firestore as google_firestore

from config import AUTH_LINK_TTL_MINUTES
from services.firestore_client import get_db

AUTH_LINK_COLLECTION = "authLinkTokens"
TELEGRAM_USERS_COLLECTION = "telegramUsers"


class AuthLinkError(Exception):
    """Base class for invalid, expired, or already-consumed auth links."""


def _token_document_id(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_auth_link(chat_id: int) -> tuple[str, datetime]:
    """Create a short-lived token; only its SHA-256 digest is stored."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=AUTH_LINK_TTL_MINUTES)
    get_db().collection(AUTH_LINK_COLLECTION).document(_token_document_id(token)).set(
        {
            "chatId": str(chat_id),
            "createdAt": google_firestore.SERVER_TIMESTAMP,
            "expiresAt": expires_at,
        }
    )
    return token, expires_at


def consume_auth_link(token: str, uid: str) -> int:
    """Atomically consume a valid token and link its Telegram chat to ``uid``."""
    if not token or not uid or len(token) > 256:
        raise AuthLinkError("Invalid or expired sign-in link")

    client = get_db()
    token_ref = client.collection(AUTH_LINK_COLLECTION).document(_token_document_id(token))
    transaction = client.transaction()

    @google_firestore.transactional
    def _consume(txn):
        token_snapshot = token_ref.get(transaction=txn)
        if not token_snapshot.exists:
            return None

        token_data = token_snapshot.to_dict() or {}
        expires_at = token_data.get("expiresAt")
        chat_id_value = token_data.get("chatId")
        if not isinstance(expires_at, datetime) or expires_at <= datetime.now(timezone.utc):
            txn.delete(token_ref)
            return None
        if not isinstance(chat_id_value, str) or not chat_id_value.isdigit():
            txn.delete(token_ref)
            return None

        telegram_ref = client.collection(TELEGRAM_USERS_COLLECTION).document(chat_id_value)
        user_snapshot = telegram_ref.get(transaction=txn)
        current_user = user_snapshot.to_dict() or {}
        min_trust_score = current_user.get("minTrustScore") if current_user.get("uid") == uid else None

        txn.set(
            telegram_ref,
            {
                "uid": uid,
                "minTrustScore": min_trust_score,
                "linkedAt": google_firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        txn.delete(token_ref)
        return int(chat_id_value)

    chat_id = _consume(transaction)
    if chat_id is None:
        raise AuthLinkError("Invalid or expired sign-in link")
    return chat_id


def unlink_telegram_account(chat_id: int) -> bool:
    """Delete a chat's account link and any outstanding login tokens."""
    client = get_db()
    chat_ref = client.collection(TELEGRAM_USERS_COLLECTION).document(str(chat_id))
    was_linked = chat_ref.get().exists
    chat_ref.delete()

    pending = (
        client.collection(AUTH_LINK_COLLECTION)
        .where("chatId", "==", str(chat_id))
        .limit(450)
    )
    while True:
        snapshots = list(pending.stream())
        if not snapshots:
            break
        batch = client.batch()
        for snapshot in snapshots:
            batch.delete(snapshot.reference)
        batch.commit()

    return was_linked
