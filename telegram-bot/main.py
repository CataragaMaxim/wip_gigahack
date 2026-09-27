"""Firebase Functions entry point (deployment is configured in Phase 9)."""

from functions.credibility import onVoteCreated
from functions.link_account import linkTelegramAccount
from functions.cast_vote import castWebVote
from functions.notifications import onEventWritten
from functions.webhook import telegramWebhook

__all__ = [
    "castWebVote",
    "linkTelegramAccount",
    "onEventWritten",
    "onVoteCreated",
    "telegramWebhook",
]