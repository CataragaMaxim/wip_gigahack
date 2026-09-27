"""Find nearby citizen reports and record account-keyed Telegram votes."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from telegram import Update
from telegram.constants import ChatType
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from bot.keyboards import remove_reply_keyboard, vote_choice_keyboard, vote_location_keyboard
from bot.handlers.locations import LOCATION_PENDING_KEY, receive_location as receive_saved_location
from bot.texts import TEXTS, text_pattern
from services.firestore_client import get_db
from services.voting_service import VoteError, VoteChoice, cast_vote, find_nearby_reports

logger = logging.getLogger(__name__)
VOTE_LOCATION_PENDING_KEY = "telegram_vote_location_pending"
VOTE_SESSION_KEY = "telegram_vote_session"
VOTE_SESSION_TTL = timedelta(minutes=10)


def _private_chat(update: Update) -> bool:
    return bool(update.effective_chat and update.effective_chat.type == ChatType.PRIVATE)


async def _linked_uid(chat_id: int) -> str | None:
    def read_link() -> str | None:
        snapshot = get_db().collection("telegramUsers").document(str(chat_id)).get()
        value = (snapshot.to_dict() or {}).get("uid")
        return value if isinstance(value, str) and value else None

    return await asyncio.to_thread(read_link)


async def vote_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    chat = update.effective_chat
    if message is None or chat is None:
        return
    if not _private_chat(update):
        await message.reply_text(TEXTS["vote_private_only"])
        return

    context.user_data.pop(LOCATION_PENDING_KEY, None)
    context.user_data.pop("telegram_min_trust_score_pending", None)

    try:
        uid = await _linked_uid(chat.id)
    except Exception:
        logger.exception("Could not check Telegram account link before voting")
        await message.reply_text(TEXTS["vote_search_failed"])
        return
    if not uid:
        await message.reply_text(TEXTS["vote_login_required"])
        return

    context.user_data[VOTE_LOCATION_PENDING_KEY] = True
    context.user_data.pop(VOTE_SESSION_KEY, None)
    await message.reply_text(TEXTS["vote_location_prompt"], reply_markup=vote_location_keyboard())


async def receive_vote_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle location shares only when a private /vote flow is waiting for one."""
    if context.user_data.get(LOCATION_PENDING_KEY):
        await receive_saved_location(update, context)
        return
    message = update.effective_message
    chat = update.effective_chat
    if message is None or chat is None or not context.user_data.get(VOTE_LOCATION_PENDING_KEY):
        return
    if not _private_chat(update):
        context.user_data.pop(VOTE_LOCATION_PENDING_KEY, None)
        await message.reply_text(TEXTS["vote_private_only"], reply_markup=remove_reply_keyboard())
        return
    if message.location is None:
        await message.reply_text(TEXTS["vote_location_missing"])
        return

    context.user_data.pop(VOTE_LOCATION_PENDING_KEY, None)
    await message.reply_text(TEXTS["vote_searching"], reply_markup=remove_reply_keyboard())
    try:
        uid = await _linked_uid(chat.id)
        if not uid:
            await message.reply_text(TEXTS["vote_login_required"])
            return
        latitude = message.location.latitude
        longitude = message.location.longitude
        candidates = await asyncio.to_thread(
            find_nearby_reports,
            voter_uid=uid,
            latitude=latitude,
            longitude=longitude,
        )
    except Exception:
        logger.exception("Could not search nearby citizen reports for Telegram voting")
        await message.reply_text(TEXTS["vote_search_failed"])
        return

    if not candidates:
        context.user_data.pop(VOTE_SESSION_KEY, None)
        await message.reply_text(TEXTS["vote_no_nearby"])
        return

    context.user_data[VOTE_SESSION_KEY] = {
        "uid": uid,
        "latitude": latitude,
        "longitude": longitude,
        "expires_at": (datetime.now(timezone.utc) + VOTE_SESSION_TTL).isoformat(),
        "event_ids": [candidate.event_id for candidate in candidates],
    }
    status_labels = {
        "reported": TEXTS["vote_status_reported"],
        "confirmed": TEXTS["vote_status_confirmed"],
        "contested": TEXTS["vote_status_contested"],
    }
    for candidate in candidates:
        await message.reply_text(
            TEXTS["vote_event_card"].format(
                title=TEXTS[f"event_title_{candidate.subtype}"] if candidate.subtype in {"apa", "gaz", "electricitate"} else candidate.title,
                distance=round(candidate.distance_m),
                yes=candidate.confirmations,
                no=candidate.denials,
                status=status_labels.get(candidate.status, candidate.status),
            ),
            reply_markup=vote_choice_keyboard(candidate.event_id),
        )


async def cancel_vote(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    had_vote = bool(context.user_data.get(VOTE_LOCATION_PENDING_KEY) or context.user_data.get(VOTE_SESSION_KEY))
    had_location = bool(context.user_data.get(LOCATION_PENDING_KEY))
    had_threshold = bool(context.user_data.get("telegram_min_trust_score_pending"))
    context.user_data.pop(VOTE_LOCATION_PENDING_KEY, None)
    context.user_data.pop(VOTE_SESSION_KEY, None)
    context.user_data.pop(LOCATION_PENDING_KEY, None)
    context.user_data.pop("telegram_min_trust_score_pending", None)
    message = update.effective_message
    if message:
        response = TEXTS["location_cancelled"] if had_location else (
            TEXTS["settings_threshold_cancelled"] if had_threshold else (
                TEXTS["vote_cancelled"] if had_vote else TEXTS["report_cancelled"]
            )
        )
        await message.reply_text(response, reply_markup=remove_reply_keyboard())


async def cast_telegram_vote(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat = update.effective_chat
    if query is None:
        return
    await query.answer()
    if chat is None or not _private_chat(update):
        await query.edit_message_text(TEXTS["vote_private_only"])
        return

    session = context.user_data.get(VOTE_SESSION_KEY)
    event_id = (query.data or "").rsplit(":", 1)[-1]
    if not isinstance(session, dict) or event_id not in session.get("event_ids", []):
        await query.edit_message_text(TEXTS["vote_session_expired"])
        return
    try:
        expires_at = datetime.fromisoformat(session["expires_at"])
        if expires_at <= datetime.now(timezone.utc):
            raise ValueError("expired vote session")
        uid = await _linked_uid(chat.id)
        if not uid or uid != session.get("uid"):
            await query.edit_message_text(TEXTS["vote_login_required"])
            return
        vote: VoteChoice = "yes" if (query.data or "").startswith("vote:yes:") else "no"
        result = await asyncio.to_thread(
            cast_vote,
            event_id=event_id,
            voter_uid=uid,
            vote=vote,
            latitude=float(session["latitude"]),
            longitude=float(session["longitude"]),
        )
    except VoteError as error:
        message_key = {
            "already_voted": "vote_already_voted",
            "own_event": "vote_own_event",
            "outside_radius": "vote_outside_radius",
            "closed": "vote_closed",
            "not_started": "vote_closed",
            "official_event": "vote_invalid_event",
            "event_missing": "vote_invalid_event",
        }.get(str(error), "vote_record_failed")
        await query.edit_message_text(TEXTS[message_key])
        return
    except Exception as error:
        if isinstance(error, ValueError) and str(error) == "expired vote session":
            await query.edit_message_text(TEXTS["vote_session_expired"])
            return
        logger.exception("Could not record Telegram vote for event %s", event_id)
        await query.edit_message_text(TEXTS["vote_record_failed"])
        return

    status_label = {
        "reported": TEXTS["vote_status_reported"],
        "confirmed": TEXTS["vote_status_confirmed"],
        "contested": TEXTS["vote_status_contested"],
    }.get(result.status, result.status)
    await query.edit_message_text(
        TEXTS["vote_recorded"].format(
            yes=result.confirmations,
            no=result.denials,
            status=status_label,
        )
    )


def register_vote_handlers(application) -> None:
    """Register the non-conversation voting flow after the report conversation."""
    application.add_handler(CommandHandler("vote", vote_start))
    application.add_handler(MessageHandler(filters.Regex(text_pattern("menu_vote")), vote_start))
    application.add_handler(CommandHandler("cancel", cancel_vote))
    application.add_handler(MessageHandler(filters.Regex(text_pattern("menu_cancel")), cancel_vote))
    application.add_handler(MessageHandler(filters.LOCATION, receive_vote_location))
    application.add_handler(
        CallbackQueryHandler(cast_telegram_vote, pattern=r"^vote:(?:yes|no):[A-Za-z0-9_-]+$")
    )
