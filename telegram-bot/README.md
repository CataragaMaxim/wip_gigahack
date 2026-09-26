# Telegram bot — Chișinău utilities

The Telegram bot is maintained as an isolated Python subsystem inside the main CataragaMaxim repository. It shares the Firebase project and event schema with the web app, while keeping its Python dependencies separate from Vite and Android.

## Local setup

Copy `telegram-bot/.env.example` to `telegram-bot/.env` (ignored by Git), then fill in local credentials:

```dotenv
BOT_TOKEN=your_telegram_bot_token
FIREBASE_SERVICE_ACCOUNT=path/to/service-account.json
FIREBASE_PROJECT_ID=work-in-progress-d4ff1
FIREBASE_DATABASE_URL=
```

Do not commit the `.env` file or a service-account JSON key. For local Firestore access, either point `FIREBASE_SERVICE_ACCOUNT` at a key stored outside the repository or use Google Application Default Credentials.

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

Message `/start` to the bot; its entire reply should be `pong`.

## Phase 2 — Firestore and geospatial helpers

`services/firestore_client.py` lazily initializes Firebase Admin once and exposes `get_db()` and `db`. Locally it uses Application Default Credentials; optionally set `FIREBASE_SERVICE_ACCOUNT` to a service-account JSON file path in the ignored `telegram-bot/.env`.

For local user credentials, configure ADC with the Google Cloud CLI using `gcloud auth application-default login` ([Google's setup guide](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)). The signed-in account also needs access to the configured Firebase project.

Run the sample event read from this directory:

```powershell
python scripts\read_event.py          # read the first event
python scripts\read_event.py EVENT_ID
```

The reader formats Firestore GeoPoint values through `.latitude` and `.longitude`. `services/geo.py` provides geohash encoding, neighboring query cells, and haversine distance in meters.

## Phase 3 — Account linking

The bot-side `/login` and `/logout` handlers live in `bot/handlers/auth.py`. `/login` issues a random one-time token with a 10-minute expiry, stores only its SHA-256 digest in `authLinkTokens`, and presents a URL button to the separately hosted sign-in page. Set `FIREBASE_AUTH_PAGE_URL` in the ignored root `.env` to that page's URL. The linked web origin must also be set as `FIREBASE_AUTH_ORIGIN` for the Cloud Function's CORS policy.

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

For the bot, copy `telegram-bot/.env.example` to `telegram-bot/.env`, fill `BOT_TOKEN` privately, and configure Firestore credentials only if testing `/login` or `/raporteaza`. Then create the Python environment and start polling:

```powershell
py -3.12 -m venv telegram-bot\venv
telegram-bot\venv\Scripts\python.exe -m pip install -r telegram-bot\requirements.txt
telegram-bot\venv\Scripts\python.exe telegram-bot\dev_run.py
```

Send `/start` to the test bot; the expected reply is exactly `pong`. `/login` and `/raporteaza` need Firestore access. A complete account-link test additionally needs the current web page deployed and `linkTelegramAccount` deployed with the `BOT_TOKEN` secret. Until then, a local build and `/start` check prove the web bundle and polling bot independently, not the full cloud handshake.

The bot writes citizen events with a Firestore `GeoPoint` in `location`, Firestore timestamps, `sourceType: 'citizen'`, a web-supported subtype, and `authorId` set to the linked Firebase UID. The web converter reads those fields and the web app includes unconfirmed reports on the public map, so the document shape is compatible. Verify a real report in a development Firebase project or with a test account before using production data.

## Phase 4 — Citizen reports

`/raporteaza` starts a private-chat conversation for a linked account: choose apă/gaz/electricitate, choose an active or upcoming event, select a future date for upcoming events, then share the event location with Telegram's location button. Upcoming reports use 09:00 Chișinău local time. `/cancel` or the cancel button stops the flow.

`services/events_service.py` validates the subtype and coordinates, then writes a `citizen` event to `events` using a Firestore `GeoPoint`, a precision-10 geohash, zero initial confirmations/denials, `authorId`, and the web app's event fields. Reports require `telegramUsers/{chatId}.uid`, which is created by the sign-in flow. Run `/raporteaza` with a linked test account and verify the event document in a development Firebase project before using production data.
