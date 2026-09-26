"""Telegram login and logout commands."""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from telegram import Update
from telegram.constants import ChatType
from telegram.ext import ContextTypes

from bot.keyboards import auth_login_keyboard
from bot.texts import TEXTS
from config import FIREBASE_AUTH_PAGE_URL
from services.auth_service import create_auth_link, unlink_telegram_account

logger = logging.getLogger(__name__)


def _auth_url(page_url: str, token: str) -> str:
    parts = urlsplit(page_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["token"] = token
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def login(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    message = update.effective_message
    chat = update.effective_chat
    if message is None or chat is None:
        return
    if chat.type != ChatType.PRIVATE:
        await message.reply_text(TEXTS["login_private_only"])
        return
    if not FIREBASE_AUTH_PAGE_URL:
        await message.reply_text(TEXTS["login_page_unconfigured"])
        return

    try:
        token, _ = await asyncio.to_thread(create_auth_link, chat.id)
        await message.reply_text(
            TEXTS["login_created"],
            reply_markup=auth_login_keyboard(_auth_url(FIREBASE_AUTH_PAGE_URL, token)),
        )
    except Exception:
        logger.exception("Could not create Telegram account-link token")
        await message.reply_text(TEXTS["login_failed"])


async def logout(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    message = update.effective_message
    chat = update.effective_chat
    if message is None or chat is None:
        return
    if chat.type != ChatType.PRIVATE:
        await message.reply_text(TEXTS["logout_private_only"])
        return

    try:
        was_linked = await asyncio.to_thread(unlink_telegram_account, chat.id)
        await message.reply_text(TEXTS["logout_done"] if was_linked else TEXTS["logout_not_linked"])
    except Exception:
        logger.exception("Could not unlink Telegram account")
        await message.reply_text(TEXTS["logout_failed"])
