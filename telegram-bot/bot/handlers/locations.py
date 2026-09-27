"""Private Telegram flow for saving Home, Work, and Person alert locations."""

from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.constants import ChatType
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from bot.keyboards import location_menu_keyboard, location_slot_keyboard, remove_reply_keyboard, saved_location_keyboard
from bot.texts import TEXTS, text_pattern
from services.firestore_client import get_db
from services.location_service import LOCATION_SLOTS, delete_location, list_locations, save_location

logger = logging.getLogger(__name__)
LOCATION_PENDING_KEY = "telegram_location_pending"


async def _linked_uid(chat_id: int) -> str | None:
    def read_link() -> str | None:
        snapshot = get_db().collection("telegramUsers").document(str(chat_id)).get()
        uid = (snapshot.to_dict() or {}).get("uid")
        return uid if isinstance(uid, str) and uid else None

    return await asyncio.to_thread(read_link)


def _private(update: Update) -> bool:
    return bool(update.effective_chat and update.effective_chat.type == ChatType.PRIVATE)


async def locations_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message, chat = update.effective_message, update.effective_chat
    if message is None or chat is None:
        return
    if not _private(update):
        await message.reply_text(TEXTS["location_private_only"])
        return
    try:
        uid = await _linked_uid(chat.id)
        if not uid:
            await message.reply_text(TEXTS["location_login_required"])
            return
        locations = await asyncio.to_thread(list_locations, uid)
    except Exception:
        logger.exception("Could not load saved Telegram alert locations")
        await message.reply_text(TEXTS["location_failed"])
        return
    context.user_data.pop("telegram_vote_location_pending", None)
    context.user_data.pop("telegram_vote_session", None)
    context.user_data.pop("telegram_min_trust_score_pending", None)
    context.user_data.pop(LOCATION_PENDING_KEY, None)
    await message.reply_text(TEXTS["location_menu"], reply_markup=location_menu_keyboard(locations))


async def choose_location_slot(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["location_private_only"])
        return
    slot = (query.data or "").rsplit(":", 1)[-1]
    if slot not in LOCATION_SLOTS:
        await query.edit_message_text(TEXTS["location_failed"])
        return
    try:
        uid = await _linked_uid(chat.id)
        if not uid:
            await query.edit_message_text(TEXTS["location_login_required"])
            return
        locations = await asyncio.to_thread(list_locations, uid)
    except Exception:
        logger.exception("Could not read selected Telegram alert location")
        await query.edit_message_text(TEXTS["location_failed"])
        return
    label = TEXTS[f"location_{slot}"]
    is_saved = locations.get(slot) is not None
    await query.edit_message_text(
        TEXTS["location_slot"].format(label=label, status=TEXTS["location_saved"] if is_saved else TEXTS["location_empty"]),
        reply_markup=location_slot_keyboard(slot, is_saved),
    )


async def request_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["location_private_only"])
        return
    slot = (query.data or "").rsplit(":", 1)[-1]
    if slot not in LOCATION_SLOTS:
        await query.edit_message_text(TEXTS["location_failed"])
        return
    try:
        uid = await _linked_uid(chat.id)
    except Exception:
        logger.exception("Could not verify Telegram account before location update")
        await query.edit_message_text(TEXTS["location_failed"])
        return
    if not uid:
        await query.edit_message_text(TEXTS["location_login_required"])
        return
    context.user_data[LOCATION_PENDING_KEY] = {"slot": slot, "uid": uid}
    await query.edit_message_text(TEXTS["location_share_prompt"].format(label=TEXTS[f"location_{slot}"]))
    if query.message:
        await query.message.reply_text(TEXTS["location_share_hint"], reply_markup=saved_location_keyboard())


async def receive_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message, chat = update.effective_message, update.effective_chat
    pending = context.user_data.get(LOCATION_PENDING_KEY)
    if message is None or chat is None or not isinstance(pending, dict):
        return
    if not _private(update):
        context.user_data.pop(LOCATION_PENDING_KEY, None)
        await message.reply_text(TEXTS["location_private_only"], reply_markup=remove_reply_keyboard())
        return
    if message.location is None:
        await message.reply_text(TEXTS["location_share_hint"])
        return
    try:
        uid = await _linked_uid(chat.id)
        if not uid or uid != pending.get("uid"):
            context.user_data.pop(LOCATION_PENDING_KEY, None)
            await message.reply_text(TEXTS["location_login_required"], reply_markup=remove_reply_keyboard())
            return
        await asyncio.to_thread(
            save_location, uid, pending["slot"], message.location.latitude, message.location.longitude
        )
    except Exception:
        logger.exception("Could not save Telegram alert location")
        await message.reply_text(TEXTS["location_failed"], reply_markup=remove_reply_keyboard())
        context.user_data.pop(LOCATION_PENDING_KEY, None)
        return
    context.user_data.pop(LOCATION_PENDING_KEY, None)
    await message.reply_text(
        TEXTS["location_saved_success"].format(label=TEXTS[f"location_{pending['slot']}"]),
        reply_markup=remove_reply_keyboard(),
    )


async def remove_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["location_private_only"])
        return
    slot = (query.data or "").rsplit(":", 1)[-1]
    if slot not in LOCATION_SLOTS:
        await query.edit_message_text(TEXTS["location_failed"])
        return
    try:
        uid = await _linked_uid(chat.id)
        if not uid:
            await query.edit_message_text(TEXTS["location_login_required"])
            return
        deleted = await asyncio.to_thread(delete_location, uid, slot)
        locations = await asyncio.to_thread(list_locations, uid)
    except Exception:
        logger.exception("Could not remove Telegram alert location")
        await query.edit_message_text(TEXTS["location_failed"])
        return
    label = TEXTS[f"location_{slot}"]
    await query.edit_message_text(
        TEXTS["location_removed"].format(label=label) if deleted else TEXTS["location_empty"],
        reply_markup=location_menu_keyboard(locations),
    )


async def location_back(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private(update):
        await query.edit_message_text(TEXTS["location_private_only"])
        return
    try:
        uid = await _linked_uid(chat.id)
        if not uid:
            await query.edit_message_text(TEXTS["location_login_required"])
            return
        locations = await asyncio.to_thread(list_locations, uid)
    except Exception:
        logger.exception("Could not return to saved Telegram location menu")
        await query.edit_message_text(TEXTS["location_failed"])
        return
    await query.edit_message_text(TEXTS["location_menu"], reply_markup=location_menu_keyboard(locations))


async def cancel_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop(LOCATION_PENDING_KEY, None)
    message = update.effective_message
    if message:
        await message.reply_text(TEXTS["location_cancelled"], reply_markup=remove_reply_keyboard())


def register_location_handlers(application) -> None:
    application.add_handler(CommandHandler("locatii", locations_start))
    application.add_handler(MessageHandler(filters.Regex(text_pattern("menu_locations")), locations_start))
    application.add_handler(CallbackQueryHandler(choose_location_slot, pattern=r"^location:slot:(?:home|work|person)$"))
    application.add_handler(CallbackQueryHandler(request_location, pattern=r"^location:set:(?:home|work|person)$"))
    application.add_handler(CallbackQueryHandler(remove_location, pattern=r"^location:remove:(?:home|work|person)$"))
    application.add_handler(CallbackQueryHandler(location_back, pattern=r"^location:back$"))
    application.add_handler(MessageHandler(filters.Regex(text_pattern("menu_cancel")), cancel_location))
