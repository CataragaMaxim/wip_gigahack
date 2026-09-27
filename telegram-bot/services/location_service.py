"""Manage the three Telegram notification locations for a linked user."""

from __future__ import annotations

from google.cloud import firestore

from services.firestore_client import get_db

LOCATION_SLOTS = {
    "home": ("acasa", "home", "Acasă"),
    "work": ("serviciu", "work", "Serviciu"),
    "person": ("persoana", "person", "Persoană"),
}


def list_locations(uid: str) -> dict[str, dict | None]:
    """Return slot data from the same subcollection used by the web app."""
    collection = get_db().collection("users").document(uid).collection("locations")
    snapshots = {snapshot.id: snapshot.to_dict() or {} for snapshot in collection.stream()}
    return {slot: snapshots.get(document_id) for slot, (document_id, _kind, _label) in LOCATION_SLOTS.items()}


def save_location(uid: str, slot: str, latitude: float, longitude: float) -> None:
    """Create or replace a fixed slot while retaining the app's location shape."""
    if slot not in LOCATION_SLOTS:
        raise ValueError("Unknown location slot")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("Location coordinates are outside valid ranges")

    document_id, kind, label = LOCATION_SLOTS[slot]
    reference = get_db().collection("users").document(uid).collection("locations").document(document_id)
    reference.set({
        "kind": kind,
        "name": label,
        "address": label,
        "location": firestore.GeoPoint(latitude, longitude),
        "prefs": {"utilitati": True},
    })


def delete_location(uid: str, slot: str) -> bool:
    """Delete a known fixed slot; return whether it existed."""
    if slot not in LOCATION_SLOTS:
        raise ValueError("Unknown location slot")
    document_id = LOCATION_SLOTS[slot][0]
    reference = get_db().collection("users").document(uid).collection("locations").document(document_id)
    snapshot = reference.get()
    if not snapshot.exists:
        return False
    reference.delete()
    return True
