"""Firebase Functions entry point (deployment is configured in Phase 9)."""

from functions.credibility import onVoteCreated
from functions.link_account import linkTelegramAccount

__all__ = ["linkTelegramAccount", "onVoteCreated"]
