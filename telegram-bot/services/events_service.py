"""Firestore writes for citizen-reported events."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import pygeohash
from google.cloud import firestore

from services.firestore_client import get_db
from services.geo import haversine_m, query_cells

ALLOWED_SUBTYPES = {"apa", "gaz", "electricitate"}
EVENT_TITLES = {
    "apa": "Lipsă apă",
    "gaz": "Lipsă gaz",
    "electricitate": "Fără energie electrică",
}
DUPLICATE_RADIUS_M = 300


@dataclass(frozen=True)
class NearbyDuplicate:
    event_id: str
    title: str
    distance_m: float


class DuplicateEventError(ValueError):
    def __init__(self, duplicate: NearbyDuplicate):
        self.duplicate = duplicate
        super().__init__("An active event already exists within the duplicate radius")


def _as_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return None


def _is_active_for_dedup(data: dict, now: datetime) -> bool:
    if data.get("deletedAt") or data.get("resolvedAt"):
        return False
    if data.get("sourceType") == "official":
        end_at = _as_datetime(data.get("endAt"))
        return end_at is None or end_at >= now

    reported_at = _as_datetime(data.get("reportedAt")) or _as_datetime(data.get("createdAt"))
    age_hours = max(0.0, (now - reported_at).total_seconds() / 3600) if reported_at else 0.0
    confirmations = data.get("confirmations")
    confirmations = confirmations if type(confirmations) is int and confirmations >= 0 else 0
    expiry_hours = 24 if confirmations >= 3 else 6
    return age_hours <= expiry_hours


def find_nearby_duplicate(
    *, latitude: float, longitude: float, now: datetime | None = None
) -> NearbyDuplicate | None:
    """Find the closest active utility event inside the web app's 300 m radius."""
    now = now or datetime.now(timezone.utc)
    events = get_db().collection("events")
    matches = {}
    for cell in query_cells(latitude, longitude, precision=6):
        query = events.where("geohash", ">=", cell).where("geohash", "<=", f"{cell}\uf8ff")
        for snapshot in query.stream():
            matches[snapshot.id] = snapshot

    nearest: NearbyDuplicate | None = None
    for snapshot in matches.values():
        data = snapshot.to_dict() or {}
        if data.get("category") != "utilitati" or not _is_active_for_dedup(data, now):
            continue
        point = data.get("location")
        if hasattr(point, "latitude") and hasattr(point, "longitude"):
            other_lat, other_lng = float(point.latitude), float(point.longitude)
        elif isinstance(point, dict) and "lat" in point and "lng" in point:
            other_lat, other_lng = float(point["lat"]), float(point["lng"])
        else:
            continue
        distance = haversine_m(latitude, longitude, other_lat, other_lng)
        if distance <= DUPLICATE_RADIUS_M and (nearest is None or distance < nearest.distance_m):
            nearest = NearbyDuplicate(
                event_id=snapshot.id,
                title=str(data.get("title") or "Raportare existentă"),
                distance_m=distance,
            )
    return nearest


def create_event(
    *,
    subtype: str,
    author_id: str,
    latitude: float,
    longitude: float,
    start_at: datetime | None = None,
) -> str:
    """Validate and write one event matching the web app's Firestore schema."""
    if subtype not in ALLOWED_SUBTYPES:
        raise ValueError("Unsupported utility subtype")
    if not author_id:
        raise ValueError("author_id is required")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("Location coordinates are outside valid ranges")
    if start_at is not None:
        if start_at.tzinfo is None or start_at.utcoffset() is None:
            raise ValueError("start_at must include a timezone")
        if start_at <= datetime.now(timezone.utc):
            raise ValueError("start_at must be in the future")

    duplicate = find_nearby_duplicate(latitude=latitude, longitude=longitude)
    if duplicate is not None:
        raise DuplicateEventError(duplicate)

    planned = start_at is not None
    payload = {
        "category": "utilitati",
        "subtype": subtype,
        "title": EVENT_TITLES[subtype],
        "sourceType": "citizen",
        "source": None,
        "feed": None,
        "severity": "total",
        "district": "",
        "streets": [],
        "location": firestore.GeoPoint(latitude, longitude),
        "path": None,
        "geohash": pygeohash.encode(latitude, longitude, precision=10),
        "confirmations": 0,
        "denials": 0,
        "authorId": author_id,
        "planned": planned,
        "startAt": start_at,
        "endAt": None,
        "resolvedAt": None,
        "updatedAt": None,
        "reportedAt": firestore.SERVER_TIMESTAMP,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "description": None,
        "photo": False,
        "radiusM": None,
    }
    result = get_db().collection("events").add(payload)
    # Firestore Client.add returns (update_time, DocumentReference).
    return result[1].id
