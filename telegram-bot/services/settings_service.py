"""Read and update notification settings for a linked Telegram account."""

from __future__ import annotations

from google.cloud import firestore

from services.firestore_client import get_db


def _references(chat_id: int):
    db = get_db()
    link_ref = db.collection("telegramUsers").document(str(chat_id))
    return db, link_ref


def get_notification_settings(chat_id: int) -> tuple[str, bool, int | float | None] | None:
    """Return the linked UID, notification setting, and optional event score threshold."""
    db, link_ref = _references(chat_id)
    link = link_ref.get().to_dict() or {}
    uid = link.get("uid")
    if not isinstance(uid, str) or not uid:
        return None
    profile = db.collection("users").document(uid).get().to_dict() or {}
    threshold = link.get("minTrustScore")
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not 0 <= threshold <= 100:
        threshold = None
    return uid, profile.get("notificationsEnabled") is not False, threshold


def set_notifications_enabled(chat_id: int, expected_uid: str, enabled: bool) -> bool:
    """Set the shared profile preference only if this chat is still linked to that UID."""
    if type(enabled) is not bool:
        raise ValueError("enabled must be a boolean")
    db, link_ref = _references(chat_id)
    profile_ref = db.collection("users").document(expected_uid)
    txn = db.transaction()

    @firestore.transactional
    def update(transaction):
        link = link_ref.get(transaction=transaction).to_dict() or {}
        if link.get("uid") != expected_uid:
            return False
        profile_snapshot = profile_ref.get(transaction=transaction)
        if not profile_snapshot.exists:
            return False
        transaction.set(profile_ref, {
            "notificationsEnabled": enabled,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return True

    return update(txn)


def set_min_trust_score(chat_id: int, expected_uid: str, threshold: int | None) -> bool:
    """Set or clear the event trustScore threshold for the currently linked account."""
    if threshold is not None and (type(threshold) is not int or not 0 <= threshold <= 100):
        raise ValueError("threshold must be an integer from 0 to 100 or None")
    db, link_ref = _references(chat_id)
    txn = db.transaction()

    @firestore.transactional
    def update(transaction):
        link_snapshot = link_ref.get(transaction=transaction)
        link = link_snapshot.to_dict() or {}
        if link.get("uid") != expected_uid:
            return False
        if threshold is None:
            transaction.update(link_ref, {"minTrustScore": firestore.DELETE_FIELD})
        else:
            transaction.update(link_ref, {"minTrustScore": threshold})
        return True

    return update(txn)
