"""Shared Firebase secret parameters for Functions in this codebase."""

from firebase_functions.params import SecretParam

BOT_TOKEN_SECRET = SecretParam("BOT_TOKEN")
TELEGRAM_WEBHOOK_SECRET = SecretParam("TELEGRAM_WEBHOOK_SECRET")
