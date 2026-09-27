"""Thread-safe, once-initialized Firebase Admin / Firestore client."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client

from config import FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT

_lock = threading.Lock()
_db: Client | None = None


def get_db() -> Client:
    """Initialize Firebase Admin once and return its Firestore client."""
    global _db
    if _db is not None:
        return _db

    with _lock:
        if _db is not None:
            return _db

        in_managed_runtime = bool(
            os.getenv("K_SERVICE")
            or os.getenv("FUNCTION_TARGET")
            or os.getenv("FUNCTIONS_EMULATOR")
        )
        if not FIREBASE_PROJECT_ID and not in_managed_runtime:
            raise RuntimeError(
                "Set APP_FIREBASE_PROJECT_ID to a development Firebase project "
                "or emulator project before using Firestore locally."
            )

        try:
            app = firebase_admin.get_app()
        except ValueError:
            options = {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None
            credential = _load_credential() if FIREBASE_SERVICE_ACCOUNT else None
            app = firebase_admin.initialize_app(credential, options=options)

        _db = firestore.client(app=app)
        return _db


def _load_credential():
    """Load a service account from a JSON path or inline JSON, if configured."""
    value = FIREBASE_SERVICE_ACCOUNT.strip()
    if value.startswith("{"):
        return credentials.Certificate(json.loads(value))

    account_file = Path(value).expanduser()
    if not account_file.is_file():
        raise FileNotFoundError("APP_FIREBASE_SERVICE_ACCOUNT must name an existing JSON file")
    return credentials.Certificate(str(account_file))


class _LazyFirestoreClient:
    """Expose a db-like object while delaying credential initialization until use."""

    def __getattr__(self, attribute: str):
        return getattr(get_db(), attribute)


db = _LazyFirestoreClient()
