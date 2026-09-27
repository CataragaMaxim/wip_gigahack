"""Send one proximity alert per linked Telegram chat and eligible event."""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from google.cloud import firestore

from services.events_service import ALLOWED_SUBTYPES
from services.geo import haversine_m
from services.firestore_client import get_db
from bot.texts import localized_text

logger = logging.getLogger(__name__)
IMPACT_RADIUS_M = 250
CONFIRM_THRESHOLD = 3
CONTEST_MIN_DENIALS = 3
REPORT_EXPIRY_H = 6
CONFIRMED_EXPIRY_H = 24
LEASE_MINUTES = 2


def _count(value: object) -> int:
    return value if type(value) is int and value >= 0 else 0


def _time(data: dict, key: str) -> datetime | None:
    value = data.get(key)
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return None


def _point(value: object) -> tuple[float, float] | None:
    if hasattr(value, "latitude") and hasattr(value, "longitude"):
        return float(value.latitude), float(value.longitude)
    if isinstance(value, dict) and "lat" in value and "lng" in value:
        return float(value["lat"]), float(value["lng"])
    return None


def _status(data: dict, now: datetime) -> str:
    if data.get("resolvedAt"):
        return "resolved"
    if data.get("sourceType") == "official":
        end = _time(data, "endAt")
        return "expired" if end and end < now else "official"
    yes, no = _count(data.get("confirmations")), _count(data.get("denials"))
    if no > yes and no >= CONTEST_MIN_DENIALS:
        return "contested"
    reported = _time(data, "reportedAt") or _time(data, "createdAt")
    age = max(0, (now - reported).total_seconds() / 3600) if reported else 0
    if yes >= CONFIRM_THRESHOLD:
        return "expired" if age > CONFIRMED_EXPIRY_H else "confirmed"
    return "expired" if age > REPORT_EXPIRY_H else "reported"


def is_eligible(data: dict, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if data.get("subtype") not in ALLOWED_SUBTYPES or data.get("deletedAt") or data.get("resolvedAt"):
        return False
    if data.get("sourceType") == "official":
        start, end = _time(data, "startAt"), _time(data, "endAt")
        return (start is None or start <= now) and (end is None or end >= now)
    if data.get("sourceType") != "citizen":
        return False
    start = _time(data, "startAt")
    return (start is None or start <= now) and _status(data, now) in {"reported", "confirmed"}


def _send_message(token: str, chat_id: str, event: dict, location: dict, distance_m: float, language: str) -> None:
    title_keys = {"apa": "event_title_apa", "gaz": "event_title_gaz", "electricitate": "event_title_electricitate"}
    if event.get("sourceType") == "citizen" and event.get("subtype") in title_keys:
        title = localized_text(language, title_keys[event["subtype"]])
    else:
        title = str(event.get("title") or localized_text(language, "event_title_apa"))
    location_defaults = {"Acasă": "location_home", "Serviciu": "location_work", "Persoană": "location_person"}
    stored_place = location.get("name") or location.get("address")
    place = localized_text(language, location_defaults[stored_place]) if stored_place in location_defaults else str(stored_place or localized_text(language, "location_saved"))
    if event.get("sourceType") == "official":
        status = localized_text(language, "notification_official")
    elif _status(event, datetime.now(timezone.utc)) == "confirmed":
        status = localized_text(language, "notification_confirmed")
    else:
        status = localized_text(language, "notification_new")
    payload = {
        "chat_id": chat_id,
        "text": f"{status}: {title}\n{localized_text(language, 'notification_near').format(place=place, distance=round(distance_m))}\n{localized_text(language, 'notification_details')}",
    }
    request = Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=12) as response:
        result = json.loads(response.read())
    if not result.get("ok"):
        raise RuntimeError("Telegram sendMessage failed")


def _claim(marker_ref, now: datetime) -> bool:
    db = get_db()
    txn = db.transaction()

    @firestore.transactional
    def claim(transaction):
        snap = marker_ref.get(transaction=transaction)
        marker = snap.to_dict() or {}
        lease = marker.get("leaseUntil")
        if marker.get("status") == "sent":
            return False
        if marker.get("status") == "sending" and isinstance(lease, datetime) and lease > now:
            return False
        transaction.set(marker_ref, {
            "status": "sending",
            "leaseUntil": now + timedelta(minutes=LEASE_MINUTES),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return True

    return claim(txn)


def notify_nearby_users(event_id: str, event: dict, bot_token: str) -> int:
    """Notify eligible nearby linked users; markers make retries idempotent."""
    if not is_eligible(event):
        return 0
    event_point = _point(event.get("location"))
    if event_point is None:
        logger.warning("Skipping event %s without a valid location", event_id)
        return 0

    db = get_db()
    sent = 0
    for link in db.collection("telegramUsers").stream():
        link_data = link.to_dict() or {}
        uid = link_data.get("uid")
        if not isinstance(uid, str) or not uid:
            continue
        profile_snap = db.collection("users").document(uid).get()
        profile = profile_snap.to_dict() or {}
        # The web app represents a banned account in both fields today. Treat either
        # signal as authoritative so a partially updated profile cannot receive alerts.
        if (
            profile.get("notificationsEnabled") is False
            or profile.get("banned") is True
            or (type(profile.get("userType")) is int and profile.get("userType") == 0)
        ):
            continue
        threshold = link_data.get("minTrustScore")
        if threshold is not None:
            score = event.get("trustScore")
            if score is None and event.get("sourceType") == "official":
                # Official feed notices are trusted by source in the product model.
                score = 100
            if (
                isinstance(threshold, bool)
                or not isinstance(threshold, (int, float))
                or not 0 <= threshold <= 100
                or (isinstance(threshold, float) and not math.isfinite(threshold))
                or isinstance(score, bool)
                or not isinstance(score, (int, float))
                or not 0 <= score <= 100
                or (isinstance(score, float) and not math.isfinite(score))
                or score < threshold
            ):
                continue

        nearest = None
        for saved in db.collection("users").document(uid).collection("locations").stream():
            location = saved.to_dict() or {}
            if not (location.get("prefs") or {}).get("utilitati", True):
                continue
            point = _point(location.get("location"))
            if point is None:
                continue
            distance = haversine_m(point[0], point[1], event_point[0], event_point[1])
            if distance <= IMPACT_RADIUS_M and (nearest is None or distance < nearest[0]):
                nearest = (distance, location)
        if nearest is None:
            continue

        marker = db.collection("events").document(event_id).collection("telegramNotifications").document(link.id)
        now = datetime.now(timezone.utc)
        if not _claim(marker, now):
            continue
        try:
            preference = db.collection("telegramBotPreferences").document(link.id).get().to_dict() or {}
            language = preference.get("language") if preference.get("language") in {"ro", "en", "ru"} else "ro"
            _send_message(bot_token, link.id, event, nearest[1], nearest[0], language)
            marker.set({"status": "sent", "sentAt": firestore.SERVER_TIMESTAMP, "leaseUntil": None}, merge=True)
            sent += 1
        except Exception as exc:
            error_type = type(exc).__name__
            if isinstance(exc, HTTPError):
                error_type = f"{error_type}:{exc.code}"
            marker.set({"status": "failed", "error": error_type, "leaseUntil": None, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
            # The Telegram API URL contains the bot token; only log a safe error class/status.
            logger.warning(
                "Telegram delivery failed for event %s (%s); continuing with other recipients",
                event_id,
                error_type,
            )
            continue
    return sent
