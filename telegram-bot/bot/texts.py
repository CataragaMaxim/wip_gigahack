"""User-facing Telegram copy in Romanian, English, and Russian."""

from collections.abc import Mapping
import re

from bot.i18n import current_language


RO_TEXTS = {
    "report_private_only": "Te rog folosește /raporteaza într-o conversație privată cu botul.",
    "report_subtype_apa": "💧 Apă",
    "report_subtype_gaz": "🔥 Gaz",
    "report_subtype_electricitate": "⚡ Electricitate",
    "report_calendar_months": (
        "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
        "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
    ),
    "report_calendar_weekdays": ("Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"),
    "report_calendar_empty_cell": "·",
    "report_calendar_cancel": "Anulează",
    "login_private_only": "Te rog folosește /login într-o conversație privată cu botul.",
    "login_page_unconfigured": "Pagina de autentificare nu este configurată încă. Încearcă din nou mai târziu.",
    "login_created": "Deschide butonul de mai jos pentru a conecta contul. Linkul expiră în 10 minute.",
    "login_failed": "Nu am putut crea linkul acum. Încearcă din nou mai târziu.",
    "login_button": "🔐 Autentificare",
    "logout_private_only": "Te rog folosește /logout într-o conversație privată cu botul.",
    "logout_not_linked": "Nu există un cont conectat la acest chat.",
    "logout_done": "Contul Telegram a fost deconectat.",
    "logout_failed": "Nu am putut deconecta contul acum. Încearcă din nou mai târziu.",
    "link_success": "✅ Contul tău a fost conectat cu succes.",
    "report_login_required": "Pentru a trimite o raportare, conectează mai întâi contul cu /login.",
    "report_choose_subtype": "Ce problemă vrei să raportezi?",
    "report_choose_timing": "Problema este activă acum sau urmează să înceapă?",
    "report_live": "🔴 Se întâmplă acum",
    "report_live_selected": "Ai ales să raportezi o problemă activă acum.",
    "report_upcoming": "📅 Urmează",
    "report_choose_date": "Alege data începerii. Evenimentul va fi setat să înceapă la 09:00, ora Chișinăului.",
    "report_date_selected": "Data aleasă: {date}.",
    "report_choose_location": "Trimite locația problemei folosind butonul de mai jos. Raportarea va fi creată după primirea locației.",
    "report_location_button": "📍 Trimite locația",
    "report_cancel_button": "❌ Anulează",
    "report_cancelled": "Raportarea a fost anulată.",
    "report_invalid_location": "Nu am primit o locație. Apasă butonul „Trimite locația” sau /cancel pentru a opri raportarea.",
    "report_invalid_date": "Alege o dată viitoare din calendar.",
    "report_created": "✅ Raportarea a fost trimisă. Va deveni vizibilă public după confirmarea vecinilor.",
    "report_duplicate": "Există deja „{title}” la aproximativ {distance} m. Verifică raportarea existentă înainte să trimiți una nouă.",
    "report_create_failed": "Nu am putut salva raportarea acum. Încearcă din nou mai târziu.",
    "report_invalid_choice": "Alegerea nu este validă. Te rog selectează una dintre opțiuni.",
    "vote_private_only": "Te rog folosește /vote într-o conversație privată cu botul.",
    "vote_login_required": "Pentru a vota, conectează mai întâi contul cu /login.",
    "vote_location_prompt": "Trimite locația ta actuală. O folosim doar pentru a găsi raportări la cel mult 1 km.",
    "vote_location_button": "📍 Trimite locația mea",
    "vote_location_missing": "Nu am primit o locație. Trimite-o cu butonul de mai jos sau apasă /cancel.",
    "vote_search_failed": "Nu am putut căuta raportări acum. Încearcă din nou mai târziu.",
    "vote_no_nearby": "Nu am găsit raportări active ale vecinilor la cel mult 1 km de locația ta.",
    "vote_event_card": "{title}\n{distance} m · Da: {yes} · Nu: {no}\nStare: {status}",
    "vote_yes_button": "✅ Da, și la mine",
    "vote_no_button": "❌ Nu, la mine funcționează",
    "vote_recorded": "Vot înregistrat. Da: {yes} · Nu: {no}. Stare: {status}.",
    "vote_already_voted": "Ai votat deja pentru această raportare.",
    "vote_own_event": "Nu poți vota propria raportare.",
    "vote_outside_radius": "Poți vota doar dacă raportarea este la cel mult 1 km de locația trimisă. Pornește /vote din nou cu locația actuală.",
    "vote_closed": "Această raportare este deja închisă și nu mai acceptă voturi.",
    "vote_invalid_event": "Această raportare nu poate primi voturi din bot.",
    "vote_session_expired": "Sesiunea de vot a expirat. Pornește din nou cu /vote și trimite locația actuală.",
    "vote_cancelled": "Sesiunea de vot a fost anulată.",
    "vote_record_failed": "Nu am putut înregistra votul acum. Încearcă din nou mai târziu.",
    "vote_status_reported": "Neconfirmat",
    "vote_status_confirmed": "Confirmat",
    "vote_status_contested": "Contestat",
    "location_private_only": "Te rog folosește /locatii într-o conversație privată cu botul.",
    "location_login_required": "Pentru a salva locații, conectează mai întâi contul cu /login.",
    "location_failed": "Nu am putut gestiona locațiile acum. Încearcă din nou mai târziu.",
    "location_menu": "Alege locația pe care vrei să o setezi sau să o gestionezi. Alertele folosesc o rază fixă de 250 m pentru toate cele trei utilități.",
    "location_slot": "{label}: {status}",
    "location_saved": "salvată",
    "location_empty": "nu este salvată",
    "location_share_prompt": "Trimite locația pentru „{label}”.",
    "location_share_hint": "Folosește butonul Telegram de mai jos ca să trimiți locația.",
    "location_saved_success": "✅ Locația „{label}” a fost salvată. Alertele pentru apă, gaz și electricitate vor acoperi 250 m.",
    "location_removed": "Locația „{label}” a fost ștearsă.",
    "location_cancelled": "Operațiunea pentru locație a fost anulată.",
    "start_welcome": "Bun venit la WIP Chișinău. Conectează contul cu /login, apoi folosește meniul pentru raportări, voturi, locații și setări.",
    "help_text": "Comenzi disponibile:\n/login — conectează contul\n/logout — deconectează contul\n/raporteaza — raportează o problemă\n/vote — confirmă sau contestă un raport\n/locatii — gestionează locațiile pentru alerte\n/setari — preferințe notificări\n/language sau /limba — schimbă limba botului",
    "settings_private_only": "Te rog gestionează setările într-o conversație privată cu botul.",
    "settings_login_required": "Pentru a schimba setările, conectează mai întâi contul cu /login.",
    "settings_failed": "Nu am putut actualiza setările acum. Încearcă din nou mai târziu.",
    "settings_intro": "Alertele sunt trimise pentru locațiile salvate, la 250 m. Setarea notificărilor se aplică și pe web. Pragul minim filtrează după trustScore-ul evenimentului.",
    "settings_status_on": "🔔 Notificările sunt active.",
    "settings_status_off": "🔕 Notificările sunt oprite.",
    "settings_threshold_prompt": "Trimite un număr întreg între 0 și 100 pentru pragul minim al trustScore-ului evenimentului.",
    "settings_threshold_invalid": "Pragul trebuie să fie un număr întreg între 0 și 100. Încearcă din nou sau apasă /cancel.",
    "settings_threshold_saved": "✅ Pragul minim pentru trustScore-ul evenimentelor este acum {score}.",
    "settings_threshold_cleared": "Pragul minim a fost șters. Evenimentele fără trustScore nu vor fi filtrate după scor.",
    "settings_threshold_unscored": "Evenimentele fără trustScore nu primesc alerte când este activ un prag minim.",
    "settings_threshold_cancelled": "Modificarea pragului a fost anulată.",
    "language_private_only": "Alege limba într-o conversație privată cu botul.",
    "language_prompt": "Alege limba botului:",
    "language_saved": "Limba botului a fost schimbată. Închide și redeschide meniul de comenzi pentru descrierile actualizate.",
    "language_save_failed": "Nu am putut salva limba. Încearcă din nou.",
    "language_saved_menu_failed": "Limba botului s-a schimbat, dar lista comenzilor nu s-a actualizat. Închide și redeschide meniul; dacă rămâne vechi, încearcă din nou /language.",
    "menu_report": "📝 Raportează",
    "menu_vote": "🗳 Votează",
    "menu_locations": "📍 Locații",
    "menu_settings": "⚙️ Setări",
    "menu_language": "🌐 Limbă / Language / Язык",
    "menu_placeholder": "Alege o acțiune",
    "menu_cancel": "❌ Anulează",
    "report_subtype_gaz": "🔥 Gaz",
    "report_subtype_electricitate": "⚡ Electricitate",
    "location_home": "🏠 Acasă",
    "location_work": "🏢 Serviciu",
    "location_person": "👤 Persoană",
    "location_set_update": "📍 Setează / actualizează",
    "location_delete": "🗑 Șterge",
    "location_back": "↩️ Înapoi",
    "settings_disable_notifications": "🔕 Oprește notificările",
    "settings_enable_notifications": "🔔 Activează notificările",
    "settings_no_threshold": "Fără prag",
    "settings_min_threshold": "Prag minim: {score}",
    "settings_change_threshold": "🎚 {label} · schimbă",
    "settings_clear_threshold": "Șterge pragul minim",
    "notification_official": "Anunț oficial",
    "notification_confirmed": "Raportare confirmată de vecini",
    "notification_new": "Raportare nouă — neconfirmată",
    "notification_near": "În apropiere de {place} ({distance} m).",
    "notification_details": "Deschide aplicația pentru detalii.",
    "start_private_only": "Deschide conversația privată cu botul pentru a folosi meniul.",
    "vote_searching": "Caut raportări în apropiere…",
    "event_title_apa": "Lipsă apă",
    "event_title_gaz": "Lipsă gaz",
    "event_title_electricitate": "Fără energie electrică",
    "report_subtype_apa": "💧 Apă",
}

EN_TEXTS = {
    "report_private_only": "Please use /raporteaza in a private chat with the bot.", "report_subtype_apa": "💧 Water",
    "report_subtype_gaz": "🔥 Gas", "report_subtype_electricitate": "⚡ Electricity",
    "report_calendar_months": ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
    "report_calendar_weekdays": ("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"), "report_calendar_empty_cell": "·", "report_calendar_cancel": "Cancel",
    "login_private_only": "Please use /login in a private chat with the bot.", "login_page_unconfigured": "The sign-in page is not configured yet. Please try again later.",
    "login_created": "Open the button below to link your account. The link expires in 10 minutes.", "login_failed": "Could not create the link. Please try again later.", "login_button": "🔐 Sign in",
    "logout_private_only": "Please use /logout in a private chat with the bot.", "logout_not_linked": "No account is linked to this chat.", "logout_done": "Your Telegram account has been unlinked.", "logout_failed": "Could not unlink the account. Please try again later.", "link_success": "✅ Your account was linked successfully.",
    "report_login_required": "Please link your account with /login before submitting a report.", "report_choose_subtype": "What problem would you like to report?", "report_choose_timing": "Is the problem happening now or will it start later?", "report_live": "🔴 Happening now", "report_live_selected": "You chose to report a current problem.", "report_upcoming": "📅 Upcoming", "report_choose_date": "Choose the start date. The event will start at 09:00 Chișinău time.", "report_date_selected": "Selected date: {date}.", "report_choose_location": "Share the problem's location using the button below. The report will be created after we receive it.", "report_location_button": "📍 Share location", "report_cancel_button": "❌ Cancel", "report_cancelled": "The report was cancelled.", "report_invalid_location": "No location received. Tap “Share location” or /cancel to stop.", "report_invalid_date": "Choose a future date from the calendar.", "report_created": "✅ Report submitted. It will become public after neighbors confirm it.", "report_duplicate": "A “{title}” report already exists about {distance} m away. Check it before submitting another.", "report_create_failed": "Could not save the report. Please try again later.", "report_invalid_choice": "Invalid choice. Please select one of the options.",
    "vote_private_only": "Please use /vote in a private chat with the bot.", "vote_login_required": "Please link your account with /login before voting.", "vote_location_prompt": "Share your current location. We use it only to find reports within 1 km.", "vote_location_button": "📍 Share my location", "vote_location_missing": "No location received. Share it with the button below or use /cancel.", "vote_search_failed": "Could not search reports. Please try again later.", "vote_no_nearby": "No active neighbor reports were found within 1 km of your location.", "vote_event_card": "{title}\n{distance} m · Yes: {yes} · No: {no}\nStatus: {status}", "vote_yes_button": "✅ Yes, here too", "vote_no_button": "❌ No, everything works here", "vote_recorded": "Vote recorded. Yes: {yes} · No: {no}. Status: {status}.", "vote_already_voted": "You have already voted on this report.", "vote_own_event": "You cannot vote on your own report.", "vote_outside_radius": "You can vote only on reports within 1 km of your shared location. Restart /vote with your current location.", "vote_closed": "This report is closed and no longer accepts votes.", "vote_invalid_event": "This report cannot receive votes through the bot.", "vote_session_expired": "The voting session expired. Restart /vote and share your current location.", "vote_cancelled": "Voting was cancelled.", "vote_record_failed": "Could not record your vote. Please try again later.", "vote_status_reported": "Unconfirmed", "vote_status_confirmed": "Confirmed", "vote_status_contested": "Disputed",
    "location_private_only": "Please use /locatii in a private chat with the bot.", "location_login_required": "Please link your account with /login before saving locations.", "location_failed": "Could not manage locations. Please try again later.", "location_menu": "Choose a location to set or manage. Alerts use a fixed 250 m radius for all three utilities.", "location_slot": "{label}: {status}", "location_saved": "saved", "location_empty": "not saved", "location_share_prompt": "Share the location for “{label}”.", "location_share_hint": "Use the Telegram button below to share a location.", "location_saved_success": "✅ “{label}” was saved. Water, gas, and electricity alerts cover 250 m.", "location_removed": "“{label}” was deleted.", "location_cancelled": "The location action was cancelled.",
    "start_welcome": "Welcome to WIP Chișinău. Link your account with /login, then use the menu to report issues, vote, manage locations, and change settings.", "help_text": "Available commands:\n/login — link account\n/logout — unlink account\n/raporteaza — report an issue\n/vote — confirm or dispute a report\n/locatii — manage alert locations\n/setari — notification settings\n/language — change bot language",
    "settings_private_only": "Please manage settings in a private chat with the bot.", "settings_login_required": "Please link your account with /login before changing settings.", "settings_failed": "Could not update settings. Please try again later.", "settings_intro": "Alerts are sent for saved locations within 250 m. Notification settings also apply on the web. The minimum threshold filters by event trustScore.", "settings_status_on": "🔔 Notifications are on.", "settings_status_off": "🔕 Notifications are off.", "settings_threshold_prompt": "Send a whole number from 0 to 100 for the event trustScore minimum.", "settings_threshold_invalid": "The threshold must be a whole number from 0 to 100. Try again or use /cancel.", "settings_threshold_saved": "✅ The event trustScore minimum is now {score}.", "settings_threshold_cleared": "The minimum threshold was cleared. Events without a trustScore will not be filtered by score.", "settings_threshold_unscored": "Events without a trustScore do not trigger alerts while a minimum is set.", "settings_threshold_cancelled": "Changing the threshold was cancelled.",
    "language_private_only": "Please choose a language in a private chat with the bot.", "language_prompt": "Choose the bot language:", "language_saved": "The bot language has changed. Reopen the commands menu to see the updated descriptions.", "language_save_failed": "Could not save the language. Please try again.", "language_saved_menu_failed": "The bot language changed, but the command list could not be updated. Reopen the menu; if it is still old, try /language again.",
    "menu_report": "📝 Report", "menu_vote": "🗳 Vote", "menu_locations": "📍 Locations", "menu_settings": "⚙️ Settings", "menu_language": "🌐 Language / Limbă / Язык", "menu_placeholder": "Choose an action", "menu_cancel": "❌ Cancel",
    "report_subtype_gaz": "🔥 Gas", "report_subtype_electricitate": "⚡ Electricity", "location_home": "🏠 Home", "location_work": "🏢 Work", "location_person": "👤 Person", "location_set_update": "📍 Set / update", "location_delete": "🗑 Delete", "location_back": "↩️ Back",
    "settings_disable_notifications": "🔕 Turn notifications off", "settings_enable_notifications": "🔔 Turn notifications on", "settings_no_threshold": "No threshold", "settings_min_threshold": "Minimum: {score}", "settings_change_threshold": "🎚 {label} · change", "settings_clear_threshold": "Clear minimum threshold",
    "notification_official": "Official notice", "notification_confirmed": "Report confirmed by neighbors", "notification_new": "New unconfirmed report", "notification_near": "Near {place} ({distance} m).", "notification_details": "Open the app for details.",
    "start_private_only": "Open a private chat with the bot to use the menu.",
    "vote_searching": "Searching for nearby reports…",
    "event_title_apa": "Water outage",
    "event_title_gaz": "Gas outage",
    "event_title_electricitate": "Power outage",
}

RU_TEXTS = {
    "report_private_only": "Пожалуйста, используйте /raporteaza в личном чате с ботом.", "report_subtype_apa": "💧 Вода", "report_subtype_gaz": "🔥 Газ", "report_subtype_electricitate": "⚡ Электричество",
    "report_calendar_months": ("январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"), "report_calendar_weekdays": ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"), "report_calendar_empty_cell": "·", "report_calendar_cancel": "Отмена",
    "login_private_only": "Пожалуйста, используйте /login в личном чате с ботом.", "login_page_unconfigured": "Страница входа ещё не настроена. Попробуйте позже.", "login_created": "Нажмите кнопку ниже, чтобы связать аккаунт. Ссылка действует 10 минут.", "login_failed": "Не удалось создать ссылку. Попробуйте позже.", "login_button": "🔐 Войти",
    "logout_private_only": "Пожалуйста, используйте /logout в личном чате с ботом.", "logout_not_linked": "С этим чатом не связан аккаунт.", "logout_done": "Аккаунт Telegram отключён.", "logout_failed": "Не удалось отключить аккаунт. Попробуйте позже.", "link_success": "✅ Аккаунт успешно связан.",
    "report_login_required": "Перед отправкой сообщения свяжите аккаунт командой /login.", "report_choose_subtype": "О какой проблеме сообщить?", "report_choose_timing": "Проблема происходит сейчас или начнётся позже?", "report_live": "🔴 Происходит сейчас", "report_live_selected": "Вы выбрали сообщение о текущей проблеме.", "report_upcoming": "📅 В будущем", "report_choose_date": "Выберите дату начала. Событие начнётся в 09:00 по времени Кишинёва.", "report_date_selected": "Выбрана дата: {date}.", "report_choose_location": "Отправьте местоположение проблемы кнопкой ниже. Сообщение будет создано после получения геопозиции.", "report_location_button": "📍 Отправить геопозицию", "report_cancel_button": "❌ Отмена", "report_cancelled": "Сообщение отменено.", "report_invalid_location": "Геопозиция не получена. Нажмите «Отправить геопозицию» или /cancel для отмены.", "report_invalid_date": "Выберите будущую дату в календаре.", "report_created": "✅ Сообщение отправлено. Оно станет общедоступным после подтверждения соседями.", "report_duplicate": "Рядом уже есть сообщение «{title}» (примерно {distance} м). Проверьте его перед отправкой нового.", "report_create_failed": "Не удалось сохранить сообщение. Попробуйте позже.", "report_invalid_choice": "Неверный выбор. Пожалуйста, выберите один из вариантов.",
    "vote_private_only": "Пожалуйста, используйте /vote в личном чате с ботом.", "vote_login_required": "Перед голосованием свяжите аккаунт командой /login.", "vote_location_prompt": "Отправьте своё местоположение. Оно используется только для поиска сообщений в радиусе 1 км.", "vote_location_button": "📍 Отправить мою геопозицию", "vote_location_missing": "Геопозиция не получена. Отправьте её кнопкой ниже или нажмите /cancel.", "vote_search_failed": "Не удалось найти сообщения. Попробуйте позже.", "vote_no_nearby": "В радиусе 1 км от вас активных сообщений соседей не найдено.", "vote_event_card": "{title}\n{distance} м · Да: {yes} · Нет: {no}\nСтатус: {status}", "vote_yes_button": "✅ Да, у меня тоже", "vote_no_button": "❌ Нет, у меня всё работает", "vote_recorded": "Голос учтён. Да: {yes} · Нет: {no}. Статус: {status}.", "vote_already_voted": "Вы уже голосовали за это сообщение.", "vote_own_event": "Нельзя голосовать за своё сообщение.", "vote_outside_radius": "Голосовать можно только за сообщения в пределах 1 км от отправленной геопозиции. Запустите /vote снова и отправьте текущее местоположение.", "vote_closed": "Это сообщение закрыто и больше не принимает голоса.", "vote_invalid_event": "За это сообщение нельзя голосовать через бота.", "vote_session_expired": "Сессия голосования истекла. Запустите /vote снова и отправьте текущее местоположение.", "vote_cancelled": "Голосование отменено.", "vote_record_failed": "Не удалось записать голос. Попробуйте позже.", "vote_status_reported": "Не подтверждено", "vote_status_confirmed": "Подтверждено", "vote_status_contested": "Оспорено",
    "location_private_only": "Пожалуйста, используйте /locatii в личном чате с ботом.", "location_login_required": "Чтобы сохранить местоположения, сначала свяжите аккаунт командой /login.", "location_failed": "Не удалось изменить местоположения. Попробуйте позже.", "location_menu": "Выберите местоположение для настройки. Оповещения по всем трём услугам действуют в радиусе 250 м.", "location_slot": "{label}: {status}", "location_saved": "сохранено", "location_empty": "не сохранено", "location_share_prompt": "Отправьте местоположение для «{label}».", "location_share_hint": "Отправьте геопозицию кнопкой Telegram ниже.", "location_saved_success": "✅ Местоположение «{label}» сохранено. Оповещения о воде, газе и электричестве охватывают 250 м.", "location_removed": "Местоположение «{label}» удалено.", "location_cancelled": "Действие с местоположением отменено.",
    "start_welcome": "Добро пожаловать в WIP Chișinău. Свяжите аккаунт командой /login, затем используйте меню для сообщений о проблемах, голосования, управления местоположениями и настройками.", "help_text": "Доступные команды:\n/login — связать аккаунт\n/logout — отключить аккаунт\n/raporteaza — сообщить о проблеме\n/vote — подтвердить или оспорить сообщение\n/locatii — места для оповещений\n/setari — настройки уведомлений\n/language — сменить язык бота",
    "settings_private_only": "Управляйте настройками в личном чате с ботом.", "settings_login_required": "Чтобы изменить настройки, сначала свяжите аккаунт командой /login.", "settings_failed": "Не удалось обновить настройки. Попробуйте позже.", "settings_intro": "Оповещения отправляются для сохранённых мест в радиусе 250 м. Настройки уведомлений действуют и в веб-приложении. Минимальный порог фильтрует события по trustScore.", "settings_status_on": "🔔 Уведомления включены.", "settings_status_off": "🔕 Уведомления выключены.", "settings_threshold_prompt": "Отправьте целое число от 0 до 100 — минимальный trustScore события.", "settings_threshold_invalid": "Укажите целое число от 0 до 100. Попробуйте ещё раз или нажмите /cancel.", "settings_threshold_saved": "✅ Минимальный trustScore событий теперь {score}.", "settings_threshold_cleared": "Минимальный порог удалён. События без trustScore не будут отфильтрованы по оценке.", "settings_threshold_unscored": "Для событий без trustScore не отправляются оповещения, пока задан минимальный порог.", "settings_threshold_cancelled": "Изменение порога отменено.",
    "language_private_only": "Выберите язык в личном чате с ботом.", "language_prompt": "Выберите язык бота:", "language_saved": "Язык бота изменён. Откройте меню команд снова, чтобы увидеть новые описания.", "language_save_failed": "Не удалось сохранить язык. Попробуйте ещё раз.", "language_saved_menu_failed": "Язык бота изменён, но список команд не обновился. Закройте и откройте меню снова; если язык не изменился, повторите /language.",
    "menu_report": "📝 Сообщить", "menu_vote": "🗳 Голосовать", "menu_locations": "📍 Места", "menu_settings": "⚙️ Настройки", "menu_language": "🌐 Язык / Limbă / Language", "menu_placeholder": "Выберите действие", "menu_cancel": "❌ Отмена",
    "location_home": "🏠 Дом", "location_work": "🏢 Работа", "location_person": "👤 Другое", "location_set_update": "📍 Установить / изменить", "location_delete": "🗑 Удалить", "location_back": "↩️ Назад",
    "settings_disable_notifications": "🔕 Выключить уведомления", "settings_enable_notifications": "🔔 Включить уведомления", "settings_no_threshold": "Без порога", "settings_min_threshold": "Минимум: {score}", "settings_change_threshold": "🎚 {label} · изменить", "settings_clear_threshold": "Удалить минимальный порог",
    "notification_official": "Официальное уведомление", "notification_confirmed": "Сообщение подтверждено соседями", "notification_new": "Новое неподтверждённое сообщение", "notification_near": "Рядом с {place} ({distance} м).", "notification_details": "Откройте приложение для подробностей.",
    "start_private_only": "Откройте личный чат с ботом, чтобы использовать меню.",
    "vote_searching": "Ищем сообщения поблизости…",
    "event_title_apa": "Нет воды",
    "event_title_gaz": "Нет газа",
    "event_title_electricitate": "Нет электричества",
}

LOCALES = {"ro": RO_TEXTS, "en": EN_TEXTS, "ru": RU_TEXTS}


class _LocalizedTexts(Mapping):
    def __getitem__(self, key):
        locale = LOCALES.get(current_language(), RO_TEXTS)
        return locale.get(key, RO_TEXTS[key])

    def __iter__(self):
        return iter(RO_TEXTS)

    def __len__(self):
        return len(RO_TEXTS)


TEXTS = _LocalizedTexts()


def text_options(key: str) -> tuple[str, ...]:
    """Return translated variants, useful for matching localized reply-keyboard input."""
    return tuple(dict.fromkeys(locale.get(key, RO_TEXTS[key]) for locale in LOCALES.values()))


def localized_text(language: str, key: str) -> str:
    """Get a translated string outside a Telegram update context (e.g. alerts)."""
    return LOCALES.get(language, RO_TEXTS).get(key, RO_TEXTS[key])


def text_pattern(*keys: str) -> str:
    """Regex matching any translated label for reply-keyboard handlers."""
    variants = (value for key in keys for value in text_options(key))
    return "^(?:" + "|".join(re.escape(value) for value in dict.fromkeys(variants)) + ")$"
