# Telegram bot — Chișinău utilities

The Telegram bot is maintained as an isolated Python subsystem inside the main CataragaMaxim repository. It shares the Firebase project and event schema with the web app, while keeping its Python dependencies separate from Vite and Android.

## Local setup

Copy `telegram-bot/.env.example` to `telegram-bot/.env` (ignored by Git), then fill in local credentials:

```dotenv
APP_FIREBASE_SERVICE_ACCOUNT=path/to/service-account.json
APP_FIREBASE_PROJECT_ID=work-in-progress-d4ff1
APP_FIREBASE_DATABASE_URL=
```

Do not commit the `.env` file, `.env.local` file, or a service-account JSON key. App-specific environment variables use the `APP_` prefix because Firebase reserves variables beginning with `FIREBASE_`. Put `APP_TELEGRAM_BOT_TOKEN` in `telegram-bot/.env.local`; this keeps the local polling token out of the deployed Functions environment. Deployed Functions use the `BOT_TOKEN` Secret Manager secret. For local Firestore access, either point `APP_FIREBASE_SERVICE_ACCOUNT` at a key stored outside the repository or use Google Application Default Credentials.

Create and activate the Python 3.12 environment and install dependencies:

```powershell
py -3.12 -m venv telegram-bot\venv
telegram-bot\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r telegram-bot\requirements.txt
```

Start polling from the repository root:

```powershell
python telegram-bot\dev_run.py
```

Message `/start` to the bot; it should show the Romanian welcome and persistent action menu.

## Phase 2 — Firestore and geospatial helpers

`services/firestore_client.py` lazily initializes Firebase Admin once and exposes `get_db()` and `db`. Locally it uses Application Default Credentials; optionally set `APP_FIREBASE_SERVICE_ACCOUNT` to a service-account JSON file path in the ignored `telegram-bot/.env`.

For local user credentials, configure ADC with the Google Cloud CLI using `gcloud auth application-default login` ([Google's setup guide](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)). The signed-in account also needs access to the configured Firebase project.

Run the sample event read from this directory:

```powershell
python scripts\read_event.py          # read the first event
python scripts\read_event.py EVENT_ID
```

The reader formats Firestore GeoPoint values through `.latitude` and `.longitude`. `services/geo.py` provides geohash encoding, neighboring query cells, and haversine distance in meters.

## Phase 3 — Account linking

The bot-side `/login` and `/logout` handlers live in `bot/handlers/auth.py`. `/login` issues a random one-time token with a 10-minute expiry, stores only its SHA-256 digest in `authLinkTokens`, and presents a URL button to the separately hosted sign-in page. Set `APP_FIREBASE_AUTH_PAGE_URL` in the ignored root `.env` to that page's URL. The linked web origin must also be set as `APP_FIREBASE_AUTH_ORIGIN` for the Cloud Function's CORS policy.

The web app serves the sign-in page at `/telegram-auth`. It reads and removes the one-time `token` from the URL, supports Firebase email/password and Google sign-in, obtains the Firebase ID token, then POSTs `{"token":"…","idToken":"…"}` to `linkTelegramAccount`. The page derives the function URL from the configured Firebase project ID. The function verifies the Firebase ID token, consumes the one-time token atomically, writes `telegramUsers/{chatId}`, and sends a direct Telegram confirmation. It never accepts a client-supplied `uid`; the response includes `notificationSent` so the page can distinguish a successful link from a failed confirmation DM.

The `/login` end-to-end checkpoint requires deploying `linkTelegramAccount`. Its CORS origin defaults to `https://wip-deploy-test.vercel.app`; the hosted domain must also be listed in Firebase Authentication's authorized domains. The root `firebase.json` points Functions at this Python source and pins `python312`; deploy credentials separately with `firebase functions:secrets:set BOT_TOKEN` before deploying.

## Git and deployment boundaries

- `npm run build` continues to build the Vercel web app; Python packages are installed only from `telegram-bot/requirements.txt`.
- `firebase.json` keeps the existing Firestore rules/indexes and adds the Telegram Functions codebase.
- The root `.gitignore` excludes local environment files, Python environments/caches, and service-account JSON files.
- Use polling (`python telegram-bot/dev_run.py`) for local development. The webhook handler is not part of this integration yet; when it is added, stop polling before configuring a webhook for the same token. Use a separate test bot token for local testing alongside production.

## Local smoke checks before pushing

Run these from the repository root in PowerShell. They do not deploy anything:

```powershell
npm run typecheck
npm run build
```

For the web app, copy the root `.env.example` to `.env.local`, fill its `VITE_FIREBASE_*` values from the Firebase Web app config, then start Vite:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:5173/telegram-auth`. With Firebase web configuration present, the sign-in page should render; if the values are missing, it shows a configuration message. This verifies the route and page, but does not consume a Telegram link or call the deployed Function.

For the bot, copy `telegram-bot/.env.example` to `telegram-bot/.env` and set `APP_FIREBASE_PROJECT_ID` explicitly to a development Firebase project (or the Firestore emulator project ID). Create `telegram-bot/.env.local` with `APP_TELEGRAM_BOT_TOKEN=<your token>`. Configure Firestore credentials if local ADC is not already available. The bot refuses to initialize Firestore locally without an explicit project ID so a missing setting cannot silently select the default cloud project. Then create the Python environment and start polling:

```powershell
py -3.12 -m venv telegram-bot\venv
telegram-bot\venv\Scripts\python.exe -m pip install -r telegram-bot\requirements.txt
telegram-bot\venv\Scripts\python.exe telegram-bot\dev_run.py
```

Send `/start` to the test bot; it should show the Romanian welcome and persistent action menu. `/login`, `/raporteaza`, `/vote`, `/locatii`, and `/setari` need Firestore access. On Spark, the normal web account-link handshake cannot complete without the deployed `linkTelegramAccount` Function. For local flow testing, obtain a test Firebase UID and private Telegram chat ID, then run `python telegram-bot/scripts/link_test_user.py <chat-id> <firebase-uid>` and type `LINK` to confirm the selected project. This development-only helper writes the same `telegramUsers/{chatId}.uid` link the bot normally reads; do not use it for real accounts. A full sign-in-token and web handshake still requires the deployed Function.

The bot writes citizen events with a Firestore `GeoPoint` in `location`, Firestore timestamps, `sourceType: 'citizen'`, a web-supported subtype, and `authorId` set to the linked Firebase UID. The web converter reads those fields and the web app includes unconfirmed reports on the public map, so the document shape is compatible. Verify a real report in a development Firebase project or with a test account before using production data.

## Phase 4 — Citizen reports

`/raporteaza` starts a private-chat conversation for a linked account: choose apă/gaz/electricitate, choose an active or upcoming event, select a future date for upcoming events, then share the event location with Telegram's location button. Upcoming reports use 09:00 Chișinău local time. Active utility events within 300 m are checked using geohash queries and exact distance; duplicate posts are stopped with the existing report and distance shown. `/cancel` or the cancel button stops the flow, and the persistent menu can switch to other bot actions during location selection.

`services/events_service.py` validates the subtype and coordinates, then writes a `citizen` event to `events` using a Firestore `GeoPoint`, a precision-10 geohash, zero initial confirmations/denials, `authorId`, and the web app's event fields. Reports require `telegramUsers/{chatId}.uid`, which is created by the sign-in flow. Run `/raporteaza` with a linked test account and verify the event document in a development Firebase project before using production data.

## Phase 5 — Confirm or contest reports

Use `/vote` in a private chat with a linked account, then share the current location. The bot finds up to five active citizen reports within 1 km, excluding the user's own reports and upcoming reports that have not started. Each report offers one yes/no vote. The bot stores the vote at `events/{eventId}/votes/{uid}` and updates the event counters and signed-in user's stats in one Firestore transaction; repeated votes from the same Telegram-linked account are rejected. Web votes go through the authenticated `castWebVote` callable. A signed-in user uses their Firebase UID; a guest silently receives a Firebase Anonymous Auth identity, which remains stable on that browser without creating an app profile. The callable applies the same server-side eligibility checks and updates totals; direct client writes to vote documents and counters are denied by Firestore rules. Enable **Authentication → Sign-in method → Anonymous** in the Firebase project. Status follows the shared thresholds: 3 confirmations confirm a report, and at least 3 denials that outnumber confirmations contest it, with contest taking precedence when both thresholds are reached.

The location is used only for this voting session and is not saved as a profile location; persistent Home/Work/Person locations remain Phase 7. The web needs the `castWebVote` callable to be deployed (or connected to the Functions emulator); the bot needs Firestore access through ADC. Signed-in web and Telegram votes share the Firebase UID and cannot double-count. Guest web voting stays device-keyed, so the same person can still vote once as a guest and once through a Telegram-linked account. Because this environment has no configured Firestore credentials or Firebase CLI, live/emulator voting and rule execution have not been verified here.

## Phase 6 — Proactive Telegram notifications

`services/notification_service.py` owns the eligibility, recipient selection, and delivery logic. It sends a private Telegram alert to linked users whose saved locations are within 250 m, if notifications are enabled and the saved `utilitati` preference is on. It picks the nearest matching address and sends only one alert per Telegram chat and event. Active official notices and new citizen reports are eligible immediately; citizen reports are explicitly labeled unconfirmed until they reach 3 confirmations. Resolved, deleted, contested, expired, future-starting, and unsupported events are skipped. Recipients must have messaged the bot at least once so Telegram permits bot DMs.

Delivery markers live in `events/{eventId}/telegramNotifications/{chatId}` and prevent routine event updates from sending duplicates. A failed Telegram delivery is recorded and does not prevent later recipients from being tried. The Python Firebase Functions SDK used here does not expose a retry option on this Firestore trigger, so a failed recipient is retried only when the event is written again; the local polling worker retries on its next scan. A rare process crash after Telegram accepts the message but before Firestore records success can still produce a duplicate if the event is replayed. A linked account's optional `minTrustScore` filters on the event's `trustScore`. Official notices without an explicit score are treated as 100 because official feeds are trusted by source. Citizen events need a valid 0–100 `trustScore` to pass a configured threshold; the score formula remains undecided. Unconfirmed citizen reports expire from notification eligibility after 6 hours; confirmed reports after 24 hours.

The implementation scans linked Telegram users and each user's saved locations, which fits the current data model but will need a geospatial index if volume grows. Under the Spark plan, run `python telegram-bot/local_notifications.py` in a second terminal alongside `python telegram-bot/dev_run.py`. This worker polls the events collection every 30 seconds by default; set `TELEGRAM_NOTIFICATION_POLL_SECONDS` to change the interval (minimum 5). It uses the same notification service and Firestore delivery markers as the eventual trigger, so the eligibility and per-chat send behavior stay shared. Polling reads all event documents each pass, so use a development Firebase project and a modest interval while testing.

`functions/notifications.py` is the production event-trigger adapter and can remain in place while local development uses the poller. Deploying that adapter requires the Firebase Blaze plan, Cloud Functions APIs, Firestore access, and the `BOT_TOKEN` Functions secret. When ready, configure it with `firebase functions:secrets:set BOT_TOKEN --project work-in-progress-d4ff1`, then deploy with `firebase deploy --only functions --project work-in-progress-d4ff1`. Do not put the bot token or service-account private key in source control or chat.

## Phase 9 — Webhook and deployment readiness

`functions/webhook.py` exposes `telegramWebhook`, protected by Telegram's secret-token request header. It validates update payloads, claims update IDs transactionally, and processes message/callback updates through the same bot handlers. Firestore-backed PTB persistence keeps per-user flow state and the report conversation across stateless function invocations; the bot user-state records expire logically after 24 hours and webhook update markers after 3 days. The webhook is serialized with one instance and one concurrent request so multi-step conversation updates stay ordered.

Before production, configure Firestore TTL policies for collection groups `items` and `telegramWebhookUpdates`, both on field `expiresAt`, so temporary workflow and update-marker records are physically removed. Workflow state may contain the location a user shared for voting; it is used temporarily to complete that flow and should expire. TTL deletion is asynchronous.

The runtime is pinned to Python 3.12 in the root `firebase.json`; direct Python dependencies are exact-pinned in `requirements.txt`. `.github/workflows/ci.yml` now installs the bot dependencies under Python 3.12, compiles the source, and builds the Telegram application without calling Telegram. No credentials are required by CI.

Deployment and webhook setup require Blaze; they are intentionally not run during Spark development. When billing is enabled and the project is confirmed as the intended production project:

1. Set the `BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` values with `firebase functions:secrets:set` for the project. Use a strong random secret of ASCII letters, digits, `_` or `-`; keep it private.
2. Deploy with `firebase deploy --only functions --project work-in-progress-d4ff1` and wait for `telegramWebhook`, `linkTelegramAccount`, and `onEventWritten` to become healthy.
3. Set `TELEGRAM_WEBHOOK_URL` to the deployed HTTPS URL and `TELEGRAM_WEBHOOK_SECRET` in the local shell, then run `python telegram-bot/scripts/configure_telegram_webhook.py` to register it with Telegram.
4. To return that test bot to local polling, run `python telegram-bot/scripts/configure_telegram_webhook.py --delete` before `python telegram-bot/dev_run.py`.

Use a separate test bot token for local polling and webhook experiments; Telegram permits only one webhook/polling mode per token. Do not deploy or register a webhook while the project remains on Spark.

## Phase 7 — Saved alert locations

Use `/locatii` in a private chat with a linked account to manage Acasă, Serviciu, and Persoană. Each slot can be set or replaced by sharing a Telegram location, or deleted from its inline menu. Coordinates are saved as a Firestore `GeoPoint` at `users/{uid}/locations/{acasa|serviciu|persoana}`, with `kind`, `name`, `address`, and `prefs.utilitati` matching the web app's saved-location shape. All three utility alerts use the fixed 250 m radius; locations are not collected until the user explicitly shares one. `/cancel` or the cancel button abandons a pending share.

The Home document ID `acasa` is the same one used by web sign-up and settings, so setting Home from Telegram updates that shared slot. Work and Person use stable IDs and preserve the existing `work`/`person` kinds. Run `/locatii` against a development Firebase project first and confirm the documents appear under the linked UID before using real account data.

## Phase 8 — Settings and UX polish

`/start` shows a persistent action keyboard, localized to Romanian, English, or Russian. Users can switch languages with `/language` or `/limba`, or the 🌐 menu button; the preference is stored per Telegram chat in `telegramBotPreferences/{chatId}` and defaults to Romanian. `/help` lists commands in the selected language. `/setari` lets a linked user toggle `users/{uid}.notificationsEnabled` (shared with the web app) and set or clear `telegramUsers/{chatId}.minTrustScore` from 0 to 100. The minimum compares against the event's `trustScore`, not the recipient's credibility score. Until the trust-score formula is implemented, citizen events without a score are excluded whenever a threshold is configured. Official notices without a score are treated as trusted (100).

The Telegram command-menu button is configured with `python telegram-bot/scripts/configure_bot_commands.py`. Run it from the repository root after setting `APP_TELEGRAM_BOT_TOKEN` in `telegram-bot/.env.local`; it registers command descriptions for Romanian, English, and Russian and selects Telegram's built-in Commands menu button. When a user changes the bot language, the webhook updates that chat's command descriptions immediately; Telegram clients may need the menu closed and reopened to refresh the display. The menu button remains available beside the input field, while the persistent reply keyboard provides the localized action buttons in the chat.
