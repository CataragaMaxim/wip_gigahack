"""Inline keyboards used by Telegram bot handlers."""

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from bot.texts import TEXTS


def auth_login_keyboard(url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(TEXTS["login_button"], url=url)]]
    )


REPORT_SUBTYPES = (
    (TEXTS["report_subtype_apa"], "apa"),
    (TEXTS["report_subtype_gaz"], "gaz"),
    (TEXTS["report_subtype_electricitate"], "electricitate"),
)


def report_subtype_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(label, callback_data=f"report:subtype:{value}")] for label, value in REPORT_SUBTYPES]
    )


def report_timing_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[
            InlineKeyboardButton(TEXTS["report_live"], callback_data="report:timing:live"),
            InlineKeyboardButton(TEXTS["report_upcoming"], callback_data="report:timing:upcoming"),
        ]]
    )


def report_location_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(TEXTS["report_location_button"], request_location=True)], [TEXTS["report_cancel_button"]]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def remove_reply_keyboard():
    from telegram import ReplyKeyboardRemove

    return ReplyKeyboardRemove()
