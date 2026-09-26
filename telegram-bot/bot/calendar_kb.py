"""Inline date picker for upcoming event reports."""

from __future__ import annotations

import calendar
from datetime import date

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.texts import TEXTS


def calendar_keyboard(year: int, month: int, *, first_selectable: date) -> InlineKeyboardMarkup:
    cal = calendar.Calendar(firstweekday=0)
    rows = [[
        InlineKeyboardButton("‹", callback_data=f"report:month:{year}:{month}:-1"),
        InlineKeyboardButton(f"{TEXTS['report_calendar_months'][month - 1].capitalize()} {year}", callback_data="report:noop"),
        InlineKeyboardButton("›", callback_data=f"report:month:{year}:{month}:1"),
    ]]
    rows.append([InlineKeyboardButton(day, callback_data="report:noop") for day in TEXTS["report_calendar_weekdays"]])

    for week in cal.monthdayscalendar(year, month):
        row = []
        for day in week:
            if day == 0:
                row.append(InlineKeyboardButton(TEXTS["report_calendar_empty_cell"], callback_data="report:noop"))
                continue
            selected_date = date(year, month, day)
            if selected_date < first_selectable:
                row.append(InlineKeyboardButton(TEXTS["report_calendar_empty_cell"], callback_data="report:noop"))
            else:
                row.append(InlineKeyboardButton(str(day), callback_data=f"report:date:{year}:{month}:{day}"))
        rows.append(row)

    rows.append([InlineKeyboardButton(TEXTS["report_calendar_cancel"], callback_data="report:cancel")])
    return InlineKeyboardMarkup(rows)
