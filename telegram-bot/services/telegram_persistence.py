"""Firestore persistence for Telegram state used by stateless webhook instances."""

from __future__ import annotations

import asyncio
import base64
import json
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

from telegram.ext import BasePersistence, PersistenceInput

from services.firestore_client import get_db

STATE_COLLECTION = "telegramBotState"
STATE_TTL = timedelta(hours=24)


def _encode(value: Any) -> Any:
    """Encode the small JSON-like context values used by bot workflows."""
    if isinstance(value, datetime):
        return {"__wip_type__": "datetime", "value": value.isoformat()}
    if isinstance(value, tuple):
        return {"__wip_type__": "tuple", "items": [_encode(item) for item in value]}
    if isinstance(value, list):
        return [_encode(item) for item in value]
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise TypeError("Telegram state dictionaries must have string keys")
        return {key: _encode(item) for key, item in value.items()}
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    raise TypeError(f"Unsupported Telegram state type: {type(value).__name__}")


def _decode(value: Any) -> Any:
    if isinstance(value, list):
        return [_decode(item) for item in value]
    if isinstance(value, dict):
        tagged_type = value.get("__wip_type__")
        if tagged_type == "datetime":
            return datetime.fromisoformat(value["value"])
        if tagged_type == "tuple":
            return tuple(_decode(item) for item in value["items"])
        return {key: _decode(item) for key, item in value.items()}
    return value


def _encoded_key(key: tuple) -> str:
    raw = json.dumps(list(key), separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


class FirestorePersistence(BasePersistence[dict, dict, dict]):
    """Persist user workflow data and named conversations across function calls."""

    def __init__(self) -> None:
        super().__init__(
            store_data=PersistenceInput(
                bot_data=False,
                chat_data=False,
                user_data=True,
                callback_data=False,
            ),
            update_interval=1,
        )

    @staticmethod
    def _records():
        return get_db().collection(STATE_COLLECTION).document("records").collection("items")

    async def get_user_data(self) -> dict[int, dict]:
        # User state is loaded on demand by refresh_user_data for the current update.
        return {}

    async def update_user_data(self, user_id: int, data: dict) -> None:
        reference = self._records().document(f"user_{user_id}")

        def write() -> None:
            if not data:
                reference.delete()
                return
            reference.set({
                "data": _encode(data),
                "updatedAt": datetime.now(timezone.utc),
                "expiresAt": datetime.now(timezone.utc) + STATE_TTL,
            })

        await asyncio.to_thread(write)

    async def refresh_user_data(self, user_id: int, user_data: dict) -> None:
        reference = self._records().document(f"user_{user_id}")

        def read() -> dict | None:
            snapshot = reference.get()
            if not snapshot.exists:
                return None
            stored = snapshot.to_dict() or {}
            expires_at = stored.get("expiresAt")
            if isinstance(expires_at, datetime) and expires_at <= datetime.now(timezone.utc):
                reference.delete()
                return None
            value = stored.get("data")
            return _decode(value) if isinstance(value, dict) else None

        restored = await asyncio.to_thread(read)
        user_data.clear()
        if restored:
            user_data.update(restored)

    async def drop_user_data(self, user_id: int) -> None:
        await asyncio.to_thread(self._records().document(f"user_{user_id}").delete)

    async def get_conversations(self, name: str) -> dict[tuple, object]:
        collection = self._records()

        def read() -> dict[tuple, object]:
            now = datetime.now(timezone.utc)
            restored: dict[tuple, object] = {}
            for snapshot in collection.stream():
                data = snapshot.to_dict() or {}
                if data.get("kind") != "conversation" or data.get("name") != name:
                    continue
                expires_at = data.get("expiresAt")
                if isinstance(expires_at, datetime) and expires_at <= now:
                    snapshot.reference.delete()
                    continue
                key = data.get("key")
                if isinstance(key, list) and "state" in data:
                    restored[tuple(key)] = _decode(data["state"])
            return restored

        return await asyncio.to_thread(read)

    async def update_conversation(self, name: str, key: tuple, new_state: object | None) -> None:
        name_hash = sha256(name.encode("utf-8")).hexdigest()
        reference = self._records().document(f"conversation_{name_hash}_{_encoded_key(key)}")

        def write() -> None:
            if new_state is None:
                reference.delete()
                return
            now = datetime.now(timezone.utc)
            reference.set({
                "key": list(key),
                "kind": "conversation",
                "name": name,
                "state": _encode(new_state),
                "updatedAt": now,
                "expiresAt": now + STATE_TTL,
            })

        await asyncio.to_thread(write)

    async def get_chat_data(self) -> dict[int, dict]:
        return {}

    async def update_chat_data(self, chat_id: int, data: dict) -> None:
        del chat_id, data

    async def drop_chat_data(self, chat_id: int) -> None:
        del chat_id

    async def get_bot_data(self) -> dict:
        return {}

    async def update_bot_data(self, data: dict) -> None:
        del data

    async def get_callback_data(self):
        return None

    async def update_callback_data(self, data) -> None:
        del data

    async def refresh_chat_data(self, chat_id: int, chat_data: dict) -> None:
        del chat_id, chat_data

    async def refresh_bot_data(self, bot_data: dict) -> None:
        del bot_data

    async def flush(self) -> None:
        return None
