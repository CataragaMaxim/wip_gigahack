"""Conversation flow for creating citizen event reports."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from telegram import Update
from telegram.constants import ChatType
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from bot.calendar_kb import calendar_keyboard
from bot.keyboards import (
    remove_reply_keyboard,
    report_location_keyboard,
    report_subtype_keyboard,
    report_timing_keyboard,
)
from bot.states import REPORT_DATE, REPORT_LOCATION, REPORT_SUBTYPE, REPORT_TIMING
from bot.texts import TEXTS
from services.events_service import ALLOWED_SUBTYPES, create_event
from services.firestore_client import get_db

logger = logging.getLogger(__name__)
CHISINAU_TZ = ZoneInfo("Europe/Chisinau")
REPORT_CONTEXT_KEY = "active_event_report"


def _private_report_context(update: Update) -> tuple[object, object] | None:
    message = update.effective_message
    chat = update.effective_chat
    if message is None or chat is None:
        return None
    if chat.type != ChatType.PRIVATE:
        return None
    return message, chat


async def report_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    private = _private_report_context(update)
    if private is None:
        message = update.effective_message
        if message:
            await message.reply_text(TEXTS["report_private_only"])
        return ConversationHandler.END

    message, chat = private
    try:
        user_snapshot = await asyncio.to_thread(
            lambda: get_db().collection("telegramUsers").document(str(chat.id)).get()
        )
        user_data = user_snapshot.to_dict() or {}
        uid = user_data.get("uid")
        if not isinstance(uid, str) or not uid:
            await message.reply_text(TEXTS["report_login_required"])
            return ConversationHandler.END
    except Exception:
        logger.exception("Could not check Telegram account link before report")
        await message.reply_text(TEXTS["report_create_failed"])
        return ConversationHandler.END

    context.user_data[REPORT_CONTEXT_KEY] = {"author_id": uid}
    await message.reply_text(TEXTS["report_choose_subtype"], reply_markup=report_subtype_keyboard())
    return REPORT_SUBTYPE


async def choose_subtype(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query is None:
        return REPORT_SUBTYPE
    await query.answer()
    subtype = (query.data or "").partition("report:subtype:")[2]
    if subtype not in ALLOWED_SUBTYPES:
        await query.edit_message_text(TEXTS["report_invalid_choice"])
        return ConversationHandler.END

    context.user_data[REPORT_CONTEXT_KEY]["subtype"] = subtype
    await query.edit_message_text(TEXTS["report_choose_timing"], reply_markup=report_timing_keyboard())
    return REPORT_TIMING


async def choose_timing(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query is None:
        return REPORT_TIMING
    await query.answer()
    timing = (query.data or "").partition("report:timing:")[2]
    if timing == "live":
        report = context.user_data[REPORT_CONTEXT_KEY]
        report["start_at"] = None
        await query.edit_message_text(TEXTS["report_live_selected"])
        if query.message:
            await query.message.reply_text(
                TEXTS["report_choose_location"], reply_markup=report_location_keyboard()
            )
        return REPORT_LOCATION
    if timing == "upcoming":
        first_selectable = datetime.now(CHISINAU_TZ).date() + timedelta(days=1)
        context.user_data[REPORT_CONTEXT_KEY]["calendar_month"] = (first_selectable.year, first_selectable.month)
        await query.edit_message_text(
            TEXTS["report_choose_date"],
            reply_markup=calendar_keyboard(
                first_selectable.year, first_selectable.month, first_selectable=first_selectable
            ),
        )
        return REPORT_DATE

    await query.edit_message_text(TEXTS["report_invalid_choice"], reply_markup=report_timing_keyboard())
    return REPORT_TIMING


async def calendar_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query is None:
        return REPORT_DATE
    data = query.data or ""
    if data == "report:noop":
        await query.answer()
        return REPORT_DATE

    if data.startswith("report:month:"):
        try:
            _, _, year_text, month_text, offset_text = data.split(":")
            year, month, offset = int(year_text), int(month_text), int(offset_text)
            month_index = year * 12 + month - 1 + offset
            year, month0 = divmod(month_index, 12)
            month = month0 + 1
        except (ValueError, TypeError):
            await query.answer(TEXTS["report_invalid_choice"], show_alert=True)
            return REPORT_DATE

        first_selectable = datetime.now(CHISINAU_TZ).date() + timedelta(days=1)
        if (year, month) < (first_selectable.year, first_selectable.month):
            year, month = first_selectable.year, first_selectable.month
        context.user_data[REPORT_CONTEXT_KEY]["calendar_month"] = (year, month)
        await query.answer()
        await query.edit_message_reply_markup(
            reply_markup=calendar_keyboard(year, month, first_selectable=first_selectable)
        )
        return REPORT_DATE

    if data.startswith("report:date:"):
        try:
            _, _, year_text, month_text, day_text = data.split(":")
            chosen_date = date(int(year_text), int(month_text), int(day_text))
        except (ValueError, TypeError):
            await query.answer(TEXTS["report_invalid_date"], show_alert=True)
            return REPORT_DATE

        first_selectable = datetime.now(CHISINAU_TZ).date() + timedelta(days=1)
        if chosen_date < first_selectable:
            await query.answer(TEXTS["report_invalid_date"], show_alert=True)
            return REPORT_DATE
        context.user_data[REPORT_CONTEXT_KEY]["start_at"] = datetime.combine(
            chosen_date, time(hour=9), tzinfo=CHISINAU_TZ
        )
        await query.answer()
        await query.edit_message_text(
            TEXTS["report_date_selected"].format(date=chosen_date.strftime("%d.%m.%Y"))
        )
        if query.message:
            await query.message.reply_text(
                TEXTS["report_choose_location"], reply_markup=report_location_keyboard()
            )
        return REPORT_LOCATION

    await query.answer(TEXTS["report_invalid_choice"], show_alert=True)
    return REPORT_DATE


async def receive_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    report = context.user_data.get(REPORT_CONTEXT_KEY)
    if message is None or message.location is None or report is None:
        return ConversationHandler.END

    try:
        event_id = await asyncio.to_thread(
            create_event,
            subtype=report["subtype"],
            author_id=report["author_id"],
            latitude=message.location.latitude,
            longitude=message.location.longitude,
            start_at=report.get("start_at"),
        )
    except Exception:
        logger.exception("Could not create citizen event from Telegram report")
        await message.reply_text(TEXTS["report_create_failed"], reply_markup=remove_reply_keyboard())
        context.user_data.pop(REPORT_CONTEXT_KEY, None)
        return ConversationHandler.END

    logger.info("Created citizen event %s from Telegram report", event_id)
    await message.reply_text(TEXTS["report_created"], reply_markup=remove_reply_keyboard())
    context.user_data.pop(REPORT_CONTEXT_KEY, None)
    return ConversationHandler.END


async def invalid_report_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    del context
    message = update.effective_message
    if message:
        await message.reply_text(TEXTS["report_invalid_location"])
    return REPORT_LOCATION


async def cancel_report(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop(REPORT_CONTEXT_KEY, None)
    message = update.effective_message
    if message:
        await message.reply_text(TEXTS["report_cancelled"], reply_markup=remove_reply_keyboard())
    return ConversationHandler.END


async def cancel_report_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text(TEXTS["report_cancelled"])
    context.user_data.pop(REPORT_CONTEXT_KEY, None)
    return ConversationHandler.END


def build_report_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("raporteaza", report_start)],
        states={
            REPORT_SUBTYPE: [CallbackQueryHandler(choose_subtype, pattern=r"^report:subtype:")],
            REPORT_TIMING: [CallbackQueryHandler(choose_timing, pattern=r"^report:timing:")],
            REPORT_DATE: [CallbackQueryHandler(calendar_action, pattern=r"^report:(?:month|date|noop)$|^report:(?:month|date):")],
            REPORT_LOCATION: [
                MessageHandler(filters.LOCATION, receive_location),
                MessageHandler(filters.TEXT & ~filters.COMMAND, invalid_report_message),
            ],
        },
        fallbacks=[
            CommandHandler("cancel", cancel_report),
            MessageHandler(filters.Regex(r"^❌ Anulează$"), cancel_report),
            CallbackQueryHandler(cancel_report_callback, pattern=r"^report:cancel$"),
        ],
        name="citizen_event_report",
        persistent=False,
        allow_reentry=True,
    )
