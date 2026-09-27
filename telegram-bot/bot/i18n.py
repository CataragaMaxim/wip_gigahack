"""Per-chat language preference for Telegram updates."""

from __future__ import annotations

import asyncio
import logging
from contextvars import ContextVar

from services.firestore_client import get_db
from telegram import Update
from telegram.ext import ContextTypes

DEFAULT_LANGUAGE = "ro"
SUPPORTED_LANGUAGES = ("ro", "en", "ru")
_current_language: ContextVar[str] = ContextVar("telegram_language", default=DEFAULT_LANGUAGE)
logger = logging.getLogger(__name__)


def current_language() -> str:
    return _current_language.get()


def set_current_language(language: str) -> None:
    _current_language.set(language if language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE)


def get_saved_language(chat_id: int) -> str:
    snapshot = get_db().collection("telegramBotPreferences").document(str(chat_id)).get()
    language = (snapshot.to_dict() or {}).get("language")
    return language if language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def save_language(chat_id: int, language: str) -> None:
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError("Unsupported language")
    get_db().collection("telegramBotPreferences").document(str(chat_id)).set(
        {"language": language}, merge=True
    )


async def load_update_language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Load the saved chat language before regular handlers render text."""
    chat = update.effective_chat
    if chat is None or update.effective_user is None:
        set_current_language(DEFAULT_LANGUAGE)
        return
    user_data = context.user_data
    if user_data is None:
        set_current_language(DEFAULT_LANGUAGE)
        return
    preferences = user_data.setdefault("telegram_languages_by_chat", {})
    cached = preferences.get(str(chat.id))
    if cached in SUPPORTED_LANGUAGES:
        set_current_language(cached)
        return
    try:
        language = await asyncio.to_thread(get_saved_language, chat.id)
    except Exception:
        logger.exception("Could not load Telegram language preference")
        language = DEFAULT_LANGUAGE
    preferences[str(chat.id)] = language
    set_current_language(language)
