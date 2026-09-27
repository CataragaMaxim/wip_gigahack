"""Manually link a test Telegram chat to a Firebase UID for Spark local testing.

This is a local development helper, not an authentication flow. Use only with a
test Telegram account and a development Firebase project.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.firestore_client import get_db


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chat_id", type=int, help="positive private Telegram chat ID")
    parser.add_argument("firebase_uid", help="UID of the Firebase test account")
    args = parser.parse_args()
    if args.chat_id <= 0:
        parser.error("chat_id must be a positive private-chat ID")
    if not args.firebase_uid.strip():
        parser.error("firebase_uid cannot be empty")

    from config import FIREBASE_PROJECT_ID

    if not FIREBASE_PROJECT_ID:
        raise SystemExit("Set APP_FIREBASE_PROJECT_ID to your development project first.")
    confirmation = input(
        f"This will link Telegram chat {args.chat_id} to UID {args.firebase_uid} "
        f"in project {FIREBASE_PROJECT_ID}. Type LINK to continue: "
    )
    if confirmation != "LINK":
        raise SystemExit("Cancelled.")

    get_db().collection("telegramUsers").document(str(args.chat_id)).set(
        {
            "uid": args.firebase_uid.strip(),
            "linkedAt": datetime.now(timezone.utc),
        },
        merge=True,
    )
    print("Test Telegram account linked.")


if __name__ == "__main__":
    main()
