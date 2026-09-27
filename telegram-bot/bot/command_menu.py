"""Localized Telegram command descriptions for the bot menu."""

from telegram import BotCommand


_COMMANDS = {
    "ro": [
        ("start", "Pornește botul și afișează meniul"),
        ("help", "Afișează comenzile disponibile"),
        ("login", "Conectează contul"),
        ("logout", "Deconectează contul"),
        ("raporteaza", "Raportează o problemă"),
        ("vote", "Votează pentru o raportare"),
        ("locatii", "Gestionează locațiile pentru alerte"),
        ("setari", "Setări pentru notificări"),
        ("language", "Schimbă limba botului"),
        ("limba", "Alege limba botului"),
    ],
    "en": [
        ("start", "Start the bot and show the menu"),
        ("help", "Show available commands"),
        ("login", "Link your account"),
        ("logout", "Unlink your account"),
        ("raporteaza", "Report a problem"),
        ("vote", "Vote on a report"),
        ("locatii", "Manage alert locations"),
        ("setari", "Notification settings"),
        ("language", "Change the bot language"),
        ("limba", "Choose the bot language"),
    ],
    "ru": [
        ("start", "Запустить бота и открыть меню"),
        ("help", "Показать список команд"),
        ("login", "Связать аккаунт"),
        ("logout", "Отключить аккаунт"),
        ("raporteaza", "Сообщить о проблеме"),
        ("vote", "Проголосовать за сообщение"),
        ("locatii", "Места для оповещений"),
        ("setari", "Настройки уведомлений"),
        ("language", "Изменить язык бота"),
        ("limba", "Выбрать язык бота"),
    ],
}


def commands_for(language: str) -> list[BotCommand]:
    """Return menu commands with descriptions in the requested language."""
    return [BotCommand(command, description) for command, description in _COMMANDS.get(language, _COMMANDS["ro"])]

