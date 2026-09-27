"""Set localized Telegram command menus and show the commands menu button."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from telegram import Bot, MenuButtonCommands

from bot.command_menu import commands_for
from config import BOT_TOKEN



async def configure() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("APP_TELEGRAM_BOT_TOKEN is missing from telegram-bot/.env.local")

    bot = Bot(BOT_TOKEN)
    await bot.initialize()
    try:
        # Romanian is the fallback for Telegram clients without a dedicated locale.
        await bot.set_my_commands(commands_for("ro"))
        for language in ("ro", "en", "ru"):
            await bot.set_my_commands(commands_for(language), language_code=language)
        await bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    finally:
        await bot.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(configure())
    except Exception:
        raise SystemExit("Could not configure the Telegram command menu. Check the bot token and try again.") from None
    print("Telegram command menu configured in Romanian, English, and Russian.")
