"""Telegram settings for notification delivery and event trust filters."""

from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.constants import ChatType
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from bot.keyboards import main_menu_keyboard, settings_keyboard
from bot.texts import TEXTS, text_pattern
from services.settings_service import (
    get_notification_settings,
    set_min_trust_score,
    set_notifications_enabled,
)

logger = logging.getLogger(__name__)
THRESHOLD_PENDING_KEY = "telegram_min_trust_score_pending"


def _private(update: Update) -> bool:
    return bool(update.effective_chat and update.effective_chat.type == ChatType.PRIVATE)


async def settings_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message, chat = update.effective_message, update.effective_chat
    if message is None or chat is None:
        return
    if not _private(update):
        await message.reply_text(TEXTS["settings_private_only"])
        return
    context.user_data.pop(THRESHOLD_PENDING_KEY, None)
    try:
        current = await asyncio.to_thread(get_notification_settings, chat.id)
    except Exception:
        logger.exception("Could not load Telegram notification settings")
        await message.reply_text(TEXTS["settings_failed"])
        return
    if current is None:
        await message.reply_text(TEXTS["settings_login_required"], reply_markup=main_menu_keyboard())
        return
    _, enabled, threshold = current
    await message.reply_text(TEXTS["settings_intro"], reply_markup=main_menu_keyboard())
    await message.reply_text(
        TEXTS["settings_status_on"] if enabled else TEXTS["settings_status_off"],
        reply_markup=settings_keyboard(enabled, threshold),
    )


async def toggle_notifications(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["settings_private_only"])
        return
    try:
        current = await asyncio.to_thread(get_notification_settings, chat.id)
        if current is None:
            await query.edit_message_text(TEXTS["settings_login_required"])
            return
        uid, enabled, threshold = current
        changed = await asyncio.to_thread(set_notifications_enabled, chat.id, uid, not enabled)
        if not changed:
            await query.edit_message_text(TEXTS["settings_login_required"])
            return
    except Exception:
        logger.exception("Could not update Telegram notification settings")
        await query.edit_message_text(TEXTS["settings_failed"])
        return
    await query.edit_message_text(
        TEXTS["settings_status_on"] if not enabled else TEXTS["settings_status_off"],
        reply_markup=settings_keyboard(not enabled, threshold),
    )


async def change_threshold(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["settings_private_only"])
        return
    try:
        current = await asyncio.to_thread(get_notification_settings, chat.id)
    except Exception:
        logger.exception("Could not verify account before trust threshold update")
        await query.edit_message_text(TEXTS["settings_failed"])
        return
    if current is None:
        await query.edit_message_text(TEXTS["settings_login_required"])
        return
    context.user_data[THRESHOLD_PENDING_KEY] = current[0]
    await query.edit_message_text(TEXTS["settings_threshold_prompt"])


async def clear_threshold(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["settings_private_only"])
        return
    try:
        current = await asyncio.to_thread(get_notification_settings, chat.id)
        if current is None or not await asyncio.to_thread(set_min_trust_score, chat.id, current[0], None):
            await query.edit_message_text(TEXTS["settings_login_required"])
            return
        refreshed = await asyncio.to_thread(get_notification_settings, chat.id)
    except Exception:
        logger.exception("Could not clear event trust threshold")
        await query.edit_message_text(TEXTS["settings_failed"])
        return
    context.user_data.pop(THRESHOLD_PENDING_KEY, None)
    enabled = refreshed[1] if refreshed else True
    await query.edit_message_text(
        TEXTS["settings_threshold_cleared"],
        reply_markup=settings_keyboard(enabled, None),
    )


async def receive_threshold(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message, chat = update.effective_message, update.effective_chat
    expected_uid = context.user_data.get(THRESHOLD_PENDING_KEY)
    if message is None or chat is None or not isinstance(expected_uid, str):
        return
    if not _private(update):
        context.user_data.pop(THRESHOLD_PENDING_KEY, None)
        await message.reply_text(TEXTS["settings_private_only"])
        return
    value = (message.text or "").strip()
    if len(value) > 3 or not value.isascii() or not value.isdigit() or not 0 <= int(value) <= 100:
        await message.reply_text(TEXTS["settings_threshold_invalid"])
        return
    try:
        changed = await asyncio.to_thread(set_min_trust_score, chat.id, expected_uid, int(value))
        if not changed:
            context.user_data.pop(THRESHOLD_PENDING_KEY, None)
            await message.reply_text(TEXTS["settings_login_required"], reply_markup=main_menu_keyboard())
            return
        current = await asyncio.to_thread(get_notification_settings, chat.id)
    except Exception:
        logger.exception("Could not save minimum event trust score")
        await message.reply_text(TEXTS["settings_failed"])
        return
    context.user_data.pop(THRESHOLD_PENDING_KEY, None)
    threshold = current[2] if current else int(value)
    enabled = current[1] if current else True
    await message.reply_text(
        TEXTS["settings_threshold_saved"].format(score=int(value))
        + "\n"
        + TEXTS["settings_threshold_unscored"],
        reply_markup=settings_keyboard(enabled, threshold),
    )


def register_settings_handlers(application) -> None:
    application.add_handler(CommandHandler("setari", settings_start))
    application.add_handler(MessageHandler(filters.Regex(text_pattern("menu_settings")), settings_start))
    application.add_handler(CallbackQueryHandler(toggle_notifications, pattern=r"^settings:notifications:toggle$"))
    application.add_handler(CallbackQueryHandler(change_threshold, pattern=r"^settings:threshold:change$"))
    application.add_handler(CallbackQueryHandler(clear_threshold, pattern=r"^settings:threshold:none$"))
    application.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND
        & ~filters.Regex(text_pattern("menu_report", "menu_vote", "menu_locations", "menu_settings", "menu_language", "menu_cancel")),
        receive_threshold,
    ))
