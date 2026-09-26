"""Firestore writes for citizen-reported events."""

from __future__ import annotations

from datetime import datetime, timezone

import pygeohash
from google.cloud import firestore

from services.firestore_client import get_db

ALLOWED_SUBTYPES = {"apa", "gaz", "electricitate"}
EVENT_TITLES = {
    "apa": "Lipsă apă",
    "gaz": "Lipsă gaz",
    "electricitate": "Fără energie electrică",
}


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
