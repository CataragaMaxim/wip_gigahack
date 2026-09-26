"""Read and print one event document to verify local Firestore access."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.firestore_client import get_db


def _json_value(value):
    if hasattr(value, "latitude") and hasattr(value, "longitude"):
        return {"latitude": value.latitude, "longitude": value.longitude}
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if hasattr(value, "path"):
        return value.path
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("event_id", nargs="?", help="specific events document ID")
    args = parser.parse_args()

    client = get_db()
    if args.event_id:
        snapshot = client.collection("events").document(args.event_id).get()
        snapshots = [snapshot] if snapshot.exists else []
    else:
        snapshots = list(client.collection("events").limit(1).stream())

    if not snapshots:
        raise SystemExit("No event document found.")

    snapshot = snapshots[0]
    document = snapshot.to_dict() or {}
    location = document.get("location")
    if location is not None and hasattr(location, "latitude") and hasattr(location, "longitude"):
        document["location"] = {
            "latitude": location.latitude,
            "longitude": location.longitude,
        }

    print(json.dumps({"id": snapshot.id, **document}, ensure_ascii=False, indent=2, default=_json_value))


if __name__ == "__main__":
    main()
