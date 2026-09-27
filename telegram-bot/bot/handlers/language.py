"""Telegram language selection command and callback."""

from __future__ import annotations

import asyncio
import logging

from telegram import BotCommandScopeChat, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatType
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from bot.i18n import SUPPORTED_LANGUAGES, current_language, save_language, set_current_language
from bot.command_menu import commands_for
from bot.keyboards import main_menu_keyboard
from bot.texts import TEXTS, text_pattern

logger = logging.getLogger(__name__)
LANGUAGE_NAMES = {"ro": "🇷🇴 Română", "en": "🇬🇧 English", "ru": "🇷🇺 Русский"}


def language_keyboard() -> InlineKeyboardMarkup:
    current = current_language()
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(("✓ " if code == current else "") + label, callback_data=f"language:{code}")]
        for code, label in LANGUAGE_NAMES.items()
    ])


async def language_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    message, chat = update.effective_message, update.effective_chat
    if message is None or chat is None:
        return
    if chat.type != ChatType.PRIVATE:
        await message.reply_text(TEXTS["language_private_only"])
        return
    await message.reply_text(TEXTS["language_prompt"], reply_markup=language_keyboard())


async def choose_language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query, chat = update.callback_query, update.effective_chat
    if query is None:
        return
    await query.answer()
    language = (query.data or "").partition(":")[2]
    if chat is None or chat.type != ChatType.PRIVATE or language not in SUPPORTED_LANGUAGES:
        await query.edit_message_text(TEXTS["language_save_failed"])
        return
    try:
        await asyncio.to_thread(save_language, chat.id, language)
    except Exception:
        logger.exception("Could not save Telegram language preference")
        await query.edit_message_text(TEXTS["language_save_failed"])
        return
    set_current_language(language)
    context.user_data.setdefault("telegram_languages_by_chat", {})[str(chat.id)] = language
    try:
        await context.bot.set_my_commands(
            commands_for(language),
            scope=BotCommandScopeChat(chat_id=chat.id),
        )
    except Exception:
        logger.exception("Could not refresh Telegram command descriptions for chat %s", chat.id)
        await query.edit_message_text(TEXTS["language_saved_menu_failed"])
        return
    if query.message:
        try:
            await query.message.delete()
        except Exception:
            logger.warning("Could not remove the old language picker message", exc_info=True)
        await query.message.reply_text(TEXTS["language_saved"], reply_markup=main_menu_keyboard())
    else:
        await query.edit_message_text(TEXTS["language_saved"])


def register_language_handlers(application) -> None:
    application.add_handler(CommandHandler(["language", "limba"], language_start))
    application.add_handler(MessageHandler(filters.Regex(text_pattern("menu_language")), language_start))
    application.add_handler(CallbackQueryHandler(choose_language, pattern=r"^language:(?:ro|en|ru)$"))
