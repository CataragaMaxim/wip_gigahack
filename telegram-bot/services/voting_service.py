"""Firestore queries and transactional voting for Telegram citizen reports."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from google.cloud import firestore

from services.firestore_client import get_db
from services.events_service import ALLOWED_SUBTYPES
from services.geo import haversine_m

VoteChoice = Literal["yes", "no"]
VoteSource = Literal["telegram", "web"]
VOTE_RADIUS_M = 1_000
CONFIRM_THRESHOLD = 3
CONTEST_MIN_DENIALS = 3
REPORT_EXPIRY_H = 6
CONFIRMED_EXPIRY_H = 24
MAX_RECENT_EVENTS = 500


class VoteError(Exception):
    """A vote could not be recorded because the event or vote is no longer valid."""


@dataclass(frozen=True)
class VoteCandidate:
    event_id: str
    title: str
    subtype: str
    distance_m: float
    confirmations: int
    denials: int
    status: str


@dataclass(frozen=True)
class VoteResult:
    confirmations: int
    denials: int
    status: str


def _count(value: object) -> int:
    return value if type(value) is int and value >= 0 else 0


def _event_time(data: dict, field: str, fallback: datetime | None = None) -> datetime | None:
    value = data.get(field)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    return fallback


def _event_status(data: dict, now: datetime) -> str:
    if data.get("resolvedAt"):
        return "resolved"

    confirmations = _count(data.get("confirmations"))
    denials = _count(data.get("denials"))
    if denials > confirmations and denials >= CONTEST_MIN_DENIALS:
        return "contested"

    created_at = _event_time(data, "createdAt")
    reported_at = _event_time(data, "reportedAt", created_at)
    age_hours = max(0.0, (now - reported_at).total_seconds() / 3600) if reported_at else 0.0
    if confirmations >= CONFIRM_THRESHOLD:
        return "expired" if age_hours > CONFIRMED_EXPIRY_H else "confirmed"
    return "expired" if age_hours > REPORT_EXPIRY_H else "reported"


def _location(data: dict) -> tuple[float, float] | None:
    point = data.get("location")
    if point is None:
        return None
    if hasattr(point, "latitude") and hasattr(point, "longitude"):
        return float(point.latitude), float(point.longitude)
    if isinstance(point, dict) and "lat" in point and "lng" in point:
        return float(point["lat"]), float(point["lng"])
    return None


def find_nearby_reports(
    *, voter_uid: str, latitude: float, longitude: float, now: datetime | None = None
) -> list[VoteCandidate]:
    """Find recent, active citizen reports within the product's 1 km voting radius."""
    now = now or datetime.now(timezone.utc)
    query = (
        get_db()
        .collection("events")
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(MAX_RECENT_EVENTS)
    )

    candidates: list[VoteCandidate] = []
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        if (
            data.get("sourceType") != "citizen"
            or data.get("subtype") not in ALLOWED_SUBTYPES
            or data.get("deletedAt")
            or data.get("authorId") == voter_uid
        ):
            continue

        start_at = _event_time(data, "startAt")
        if start_at and start_at > now:
            continue

        status = _event_status(data, now)
        if status not in {"reported", "confirmed", "contested"}:
            continue

        point = _location(data)
        if point is None:
            continue
        distance = haversine_m(latitude, longitude, *point)
        if distance > VOTE_RADIUS_M:
            continue

        candidates.append(
            VoteCandidate(
                event_id=snapshot.id,
                title=str(data.get("title") or "Raportare de utilitate"),
                subtype=str(data.get("subtype") or ""),
                distance_m=distance,
                confirmations=_count(data.get("confirmations")),
                denials=_count(data.get("denials")),
                status=status,
            )
        )

    return sorted(candidates, key=lambda event: event.distance_m)[:5]


def cast_vote(
    *,
    event_id: str,
    voter_uid: str | None,
    voter_id: str | None = None,
    legacy_device_id: str | None = None,
    vote: VoteChoice,
    source: VoteSource = "telegram",
    latitude: float,
    longitude: float,
    now: datetime | None = None,
) -> VoteResult:
    """Record one UID/device-keyed vote and update trusted counters atomically."""
    if vote not in {"yes", "no"}:
        raise ValueError("vote must be 'yes' or 'no'")
    now = now or datetime.now(timezone.utc)
    voter_id = voter_id or voter_uid
    if not voter_id:
        raise ValueError("voter_id is required")

    client = get_db()
    event_ref = client.collection("events").document(event_id)
    vote_ref = event_ref.collection("votes").document(voter_id)
    transaction = client.transaction()

    @firestore.transactional
    def _apply_vote(txn):
        event_snapshot = event_ref.get(transaction=txn)
        if not event_snapshot.exists:
            raise VoteError("event_missing")

        data = event_snapshot.to_dict() or {}
        if data.get("sourceType") != "citizen":
            raise VoteError("official_event")
        if data.get("subtype") not in ALLOWED_SUBTYPES or data.get("deletedAt"):
            raise VoteError("closed")
        if voter_uid and data.get("authorId") == voter_uid:
            raise VoteError("own_event")

        start_at = _event_time(data, "startAt")
        if start_at and start_at > now:
            raise VoteError("not_started")
        status = _event_status(data, now)
        if status in {"resolved", "expired"}:
            raise VoteError("closed")

        point = _location(data)
        if point is None or haversine_m(latitude, longitude, *point) > VOTE_RADIUS_M:
            raise VoteError("outside_radius")

        vote_snapshot = vote_ref.get(transaction=txn)
        if vote_snapshot.exists:
            raise VoteError("already_voted")
        if legacy_device_id:
            legacy_vote = event_ref.collection("votes").document(legacy_device_id).get(transaction=txn)
            if legacy_vote.exists:
                raise VoteError("already_voted")
        if voter_uid:
            # Older web releases used a browser ID for the document key while
            # still storing uid. Honor that vote after switching signed-in users
            # to UID-keyed IDs, so a deployment cannot reopen a second vote.
            prior_uid_vote = (
                event_ref.collection("votes")
                .where("uid", "==", voter_uid)
                .limit(1)
                .get(transaction=txn)
            )
            if prior_uid_vote:
                raise VoteError("already_voted")

        confirmations = _count(data.get("confirmations")) + (vote == "yes")
        denials = _count(data.get("denials")) + (vote == "no")
        updated_data = {**data, "confirmations": confirmations, "denials": denials}
        user_ref = client.collection("users").document(voter_uid) if voter_uid else None
        user_snapshot = user_ref.get(transaction=txn) if user_ref else None
        user_data = user_snapshot.to_dict() or {} if user_snapshot and user_snapshot.exists else {}
        stats = user_data.get("stats") if isinstance(user_data.get("stats"), dict) else {}
        stat_key = "confirmations" if vote == "yes" else "denials"
        current_stat = _count(stats.get(stat_key))

        txn.set(
            vote_ref,
            {
                "uid": voter_uid,
                "vote": vote,
                "source": source,
                "at": firestore.SERVER_TIMESTAMP,
            },
        )
        txn.update(
            event_ref,
            {
                "confirmations": confirmations,
                "denials": denials,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
        )
        # Keep per-account statistics in the same trusted transaction as the
        # vote. Client rules intentionally prevent users from editing stats.
        if user_ref and user_snapshot and user_snapshot.exists:
            txn.update(
                user_ref,
                {
                    f"stats.{stat_key}": current_stat + 1,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
            )
        return VoteResult(
            confirmations=confirmations,
            denials=denials,
            status=_event_status(updated_data, now),
        )

    return _apply_vote(transaction)
