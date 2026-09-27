"""HTTPS function that consumes a web sign-in token and links Telegram."""

from __future__ import annotations

import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from firebase_admin import auth
from firebase_functions import https_fn, options

from bot.texts import localized_text
from config import FIREBASE_AUTH_ORIGIN
from services.auth_service import AuthLinkError, consume_auth_link
from services.firestore_client import get_db
from functions.secrets import BOT_TOKEN_SECRET

logger = logging.getLogger(__name__)
_cors_origins = [FIREBASE_AUTH_ORIGIN] if FIREBASE_AUTH_ORIGIN else []


def _send_confirmation(chat_id: int) -> None:
    preference = get_db().collection("telegramBotPreferences").document(str(chat_id)).get().to_dict() or {}
    language = preference.get("language") if preference.get("language") in {"ro", "en", "ru"} else "ro"
    payload = {"chat_id": chat_id, "text": localized_text(language, "link_success")}
    request = Request(
        f"https://api.telegram.org/bot{BOT_TOKEN_SECRET.value}/sendMessage",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        result = json.loads(response.read())
    if not result.get("ok"):
        raise RuntimeError("Telegram sendMessage failed")


@https_fn.on_request(
    region="europe-west1",
    cors=options.CorsOptions(cors_origins=_cors_origins, cors_methods=["POST"]),
    secrets=[BOT_TOKEN_SECRET],
)
def linkTelegramAccount(req: https_fn.Request) -> https_fn.Response:
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    body = req.get_json(silent=True)
    if not isinstance(body, dict):
        return https_fn.Response("Invalid JSON", status=400)

    token = body.get("token")
    id_token = body.get("idToken")
    if not isinstance(token, str) or not isinstance(id_token, str):
        return https_fn.Response("Missing token or idToken", status=400)

    try:
        get_db()
    except Exception:
        logger.exception("Firebase Admin could not initialize")
        return https_fn.Response("Firebase Admin is not configured", status=503)

    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        uid = decoded.get("uid")
        if not isinstance(uid, str) or not uid:
            return https_fn.Response("Invalid Firebase ID token", status=401)
    except (
        auth.InvalidIdTokenError,
        auth.ExpiredIdTokenError,
        auth.RevokedIdTokenError,
        auth.UserNotFoundError,
        auth.UserDisabledError,
        ValueError,
    ):
        return https_fn.Response("Invalid Firebase ID token", status=401)
    except auth.CertificateFetchError:
        logger.exception("Firebase Auth certificate verification is unavailable")
        return https_fn.Response("Firebase Auth verification is unavailable", status=503)

    try:
        chat_id = consume_auth_link(token, uid)
    except AuthLinkError:
        return https_fn.Response("Invalid or expired sign-in link", status=410)
    except Exception:
        logger.exception("Could not consume Telegram account-link token")
        return https_fn.Response("Could not link Telegram account", status=500)

    notification_sent = True
    try:
        _send_confirmation(chat_id)
    except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError):
        notification_sent = False
        logger.exception("Account was linked, but Telegram confirmation DM failed")

    return https_fn.Response(
        json.dumps({"ok": True, "notificationSent": notification_sent}, ensure_ascii=False),
        status=200,
        mimetype="application/json",
    )
