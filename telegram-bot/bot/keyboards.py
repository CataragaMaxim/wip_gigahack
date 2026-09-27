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


def report_subtype_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(TEXTS[key], callback_data=f"report:subtype:{value}")]
         for key, value in (("report_subtype_apa", "apa"), ("report_subtype_gaz", "gaz"), ("report_subtype_electricitate", "electricitate"))]
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
        [[KeyboardButton(TEXTS["report_location_button"], request_location=True)], [TEXTS["menu_cancel"]]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[TEXTS["menu_report"], TEXTS["menu_vote"]], [TEXTS["menu_locations"], TEXTS["menu_settings"]], [TEXTS["menu_language"]]],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder=TEXTS["menu_placeholder"],
    )


def settings_keyboard(notifications_enabled: bool, min_trust_score: int | float | None) -> InlineKeyboardMarkup:
    label = TEXTS["settings_disable_notifications"] if notifications_enabled else TEXTS["settings_enable_notifications"]
    threshold_label = TEXTS["settings_no_threshold"] if min_trust_score is None else TEXTS["settings_min_threshold"].format(score=min_trust_score)
    rows = [
        [InlineKeyboardButton(label, callback_data="settings:notifications:toggle")],
        [InlineKeyboardButton(TEXTS["settings_change_threshold"].format(label=threshold_label), callback_data="settings:threshold:change")],
    ]
    if min_trust_score is not None:
        rows.append([InlineKeyboardButton(TEXTS["settings_clear_threshold"], callback_data="settings:threshold:none")])
    return InlineKeyboardMarkup(rows)


def vote_location_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(TEXTS["vote_location_button"], request_location=True)], [TEXTS["menu_cancel"]]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def vote_choice_keyboard(event_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[
            InlineKeyboardButton(TEXTS["vote_yes_button"], callback_data=f"vote:yes:{event_id}"),
            InlineKeyboardButton(TEXTS["vote_no_button"], callback_data=f"vote:no:{event_id}"),
        ]]
    )


def location_menu_keyboard(locations: dict) -> InlineKeyboardMarkup:
    rows = []
    for slot, key in (("home", "location_home"), ("work", "location_work"), ("person", "location_person")):
        label = TEXTS[key]
        state = "✓" if locations.get(slot) is not None else "＋"
        rows.append([InlineKeyboardButton(f"{label} {state}", callback_data=f"location:slot:{slot}")])
    return InlineKeyboardMarkup(rows)


def location_slot_keyboard(slot: str, is_saved: bool) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(TEXTS["location_set_update"], callback_data=f"location:set:{slot}")]]
    if is_saved:
        rows.append([InlineKeyboardButton(TEXTS["location_delete"], callback_data=f"location:remove:{slot}")])
    rows.append([InlineKeyboardButton(TEXTS["location_back"], callback_data="location:back")])
    return InlineKeyboardMarkup(rows)


def saved_location_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(TEXTS["report_location_button"], request_location=True)], [TEXTS["menu_cancel"]]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def remove_reply_keyboard():
    from telegram import ReplyKeyboardRemove

    return ReplyKeyboardRemove()
