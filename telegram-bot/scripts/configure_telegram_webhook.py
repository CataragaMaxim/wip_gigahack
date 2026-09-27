"""Register or remove the deployed Firebase webhook for the configured bot."""

from __future__ import annotations

import json
import os
import sys
import argparse
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from config import BOT_TOKEN


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delete", action="store_true", help="remove the webhook to enable local polling")
    args = parser.parse_args()
    if not BOT_TOKEN:
        raise RuntimeError("APP_TELEGRAM_BOT_TOKEN is missing from telegram-bot/.env")
    if args.delete:
        method = "deleteWebhook"
        payload = urlencode({"drop_pending_updates": "false"}).encode("utf-8")
    else:
        method = "setWebhook"
        webhook_url = os.getenv("TELEGRAM_WEBHOOK_URL", "").strip()
        secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
        if not webhook_url:
            raise RuntimeError("Set TELEGRAM_WEBHOOK_URL to the deployed telegramWebhook URL")
        if urlsplit(webhook_url).scheme != "https":
            raise ValueError("Telegram webhooks require an HTTPS URL")
        if not 1 <= len(secret) <= 256 or not all(c.isascii() and (c.isalnum() or c in "_-") for c in secret):
            raise ValueError("TELEGRAM_WEBHOOK_SECRET must use 1–256 ASCII letters, digits, '_' or '-'")
        payload = urlencode({
            "url": webhook_url,
            "secret_token": secret,
            "allowed_updates": json.dumps(["message", "callback_query"]),
        }).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            result = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, ValueError):
        raise RuntimeError("Could not update Telegram webhook configuration") from None
    if not result.get("ok"):
        raise RuntimeError("Telegram rejected the webhook configuration")
    print("Webhook removed; polling can be enabled." if args.delete else "Webhook configured for the supplied HTTPS endpoint.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
