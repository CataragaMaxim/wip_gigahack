"""Polling Telegram application; Firebase services initialize lazily on use."""

from telegram import Update
from telegram.constants import ChatType
from telegram.ext import Application, CommandHandler, ContextTypes, TypeHandler

from bot.handlers.auth import login, logout
from bot.handlers.locations import register_location_handlers
from bot.handlers.language import register_language_handlers
from bot.handlers.report import build_report_handler
from bot.handlers.settings import register_settings_handlers
from bot.handlers.vote import register_vote_handlers
from bot.keyboards import main_menu_keyboard
from bot.i18n import load_update_language
from bot.texts import TEXTS
from config import BOT_TOKEN


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show the persistent action menu."""
    del context
    if update.message:
        if update.effective_chat and update.effective_chat.type != ChatType.PRIVATE:
            await update.message.reply_text(TEXTS["start_private_only"])
            return
        await update.message.reply_text(TEXTS["start_welcome"], reply_markup=main_menu_keyboard())


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    if update.effective_message:
        await update.effective_message.reply_text(TEXTS["help_text"], reply_markup=main_menu_keyboard())


def build_app(*, token: str | None = None, persistence=None) -> Application:
    bot_token = token or BOT_TOKEN
    if not bot_token:
        raise RuntimeError("APP_TELEGRAM_BOT_TOKEN is missing. Add it to telegram-bot/.env.")

    builder = Application.builder().token(bot_token)
    if persistence is not None:
        builder.persistence(persistence)
    application = builder.build()
    application.add_handler(TypeHandler(Update, load_update_language), group=-1)
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("login", login))
    application.add_handler(CommandHandler("logout", logout))
    application.add_handler(build_report_handler(persistent=persistence is not None))
    register_vote_handlers(application)
    register_location_handlers(application)
    register_settings_handlers(application)
    register_language_handlers(application)
    return application
