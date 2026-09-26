"""Polling Telegram application; Firebase services initialize lazily on use."""

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from bot.handlers.auth import login, logout
from bot.handlers.report import build_report_handler
from config import BOT_TOKEN


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Reply with the Phase 1 checkpoint text, with no extra content."""
    del context
    if update.message:
        await update.message.reply_text("pong")


def build_app() -> Application:
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is missing. Add it to telegram-bot/.env.")

    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("login", login))
    application.add_handler(CommandHandler("logout", logout))
    application.add_handler(build_report_handler())
    return application


app = build_app()
