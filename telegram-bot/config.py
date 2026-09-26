"""Local and deployment configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path


def _load_local_env() -> None:
    """Load bot-local .env first, then the repo-root .env for compatibility."""
    env_files = (Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parents[1] / ".env")
    for env_file in env_files:
        if not env_file.is_file():
            continue

        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            key, separator, value = line.partition("=")
            if not separator:
                continue
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            if key:
                os.environ.setdefault(key, value)


_load_local_env()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "work-in-progress-d4ff1")
FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "")
DEFAULT_TELEGRAM_AUTH_ORIGIN = "https://wip-deploy-test.vercel.app"
FIREBASE_AUTH_PAGE_URL = (
    os.getenv("FIREBASE_AUTH_PAGE_URL")
    or f"{DEFAULT_TELEGRAM_AUTH_ORIGIN}/telegram-auth"
)
FIREBASE_AUTH_ORIGIN = os.getenv("FIREBASE_AUTH_ORIGIN") or DEFAULT_TELEGRAM_AUTH_ORIGIN
AUTH_LINK_TTL_MINUTES = 10
