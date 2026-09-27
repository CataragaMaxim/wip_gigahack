# Work In Progress — Chișinău

**Platformă urbană pentru transparența deconectărilor de utilități.**

O hartă în timp real care combină **anunțurile oficiale ale furnizorilor** (Apă-Canal Chișinău, Premier Energy, Energocom, Chișinău-Gaz) cu **raportările cetățenilor confirmate de vecini**, pentru a răspunde la o întrebare simplă: *«Am apă/curent/gaz la adresa mea?»* — și, dacă nu, *de ce, până când și pe ce străzi.*

> **MVP dezvoltat în cadrul Deeptech GigaHack — Open Challenge.** Construit de la zero în timpul hackathonului. Datele demonstrative sunt marcate ca atare; infrastructura de ingestie (scrapere) este reală și funcțională.

---

## Cuprins

- [Problema](#problema)
- [Soluția](#soluția)
- [Cum funcționează](#cum-funcționează)
- [Funcționalități](#funcționalități)
- [Arhitectură](#arhitectură)
- [Pornire rapidă](#pornire-rapidă)
- [Structura proiectului](#structura-proiectului)
- [Reguli de produs](#reguli-de-produs)
- [Botul Telegram](#botul-telegram)
- [Fluxuri oficiale de date](#fluxuri-oficiale-de-date)
- [Confidențialitate și consimțământ](#confidențialitate-și-consimțământ)
- [Internaționalizare](#internaționalizare)
- [Accesibilitate](#accesibilitate)
- [Scalabilitate](#scalabilitate)
- [Limitări cunoscute](#limitări-cunoscute)
- [Echipă](#echipă)

---

## Problema

În Chișinău, deconectările de utilități (apă, gaz, electricitate) sunt o realitate frecventă. Informația există, dar este **fragmentată**:

- Fiecare furnizor publică anunțuri pe propriul site, în formate diferite, fără hartă, fără notificări, fără posibilitatea de a căuta „ce se întâmplă la adresa mea”.
- Anunțurile sunt textuale („str. X nr. 1, 2, 5, 7” sau „sectorul Botanica”), greu de corelat cu o adresă concretă.
- Nu există un loc unde să vezi **simultan** toate cele trei utilități.
- Când un furnizor nu anunță nimic (avarie neplanificată), vecinii nu au cum să semnaleze rapid și credibil problema.
- Turiștii, medicii, școlile, afacerile mici pierd timp căutând prin 4 site-uri diferite.

**Impactul:** întârzieri, pierderi economice, lipirea de informație incertă, lipsa unui instrument de planificare („pot să programez ceva mâine la această adresă?”).

---

## Soluția

**Work In Progress** este o singură hartă care răspunde la toate cele trei întrebări:

1. **Ce se întâmplă acum** în jurul meu?
2. **Ce se va întâmpla** în următoarele 48 de ore (și în calendarul lunii)?
3. **Ce raportează vecinii** dincolo de anunțurile oficiale?

Trei piloni:

- **Date oficiale agregate** — scrapere Python care rulează automat pe GitHub Actions, geocodează fiecare adresă din anunț și publică în Firestore.
- **Raportări comunitare validate** — orice utilizator autentificat poate raporta o avarie; raportarea devine publică imediat ca „Neconfirmat” și trece în „Confirmat” după 3 confirmări de la vecini aflați la ≤ 100 m.
- **Design care pune informația în față** — culoarea arată gravitatea, iconița arată tipul, dungile arată sursa (oficial vs. cetățean), iar zona afectată este vizualizată ca cercuri de 25–55 m pe fiecare adresă.

---

## Cum funcționează

### Pentru un utilizator

1. Deschide harta → vede imediat ce se întâmplă în Chișinău (sau în raza aleasă: 1 / 2 / 5 km / tot orașul).
2. Caută o stradă → harta se centrează pe ea.
3. Salvează „Acasă” și „Serviciu” → alertele care le ating apar primele în listă și ca notificări.
4. Apasă pe un eveniment → vede sursa, începutul/sfârșitul oficial, străzile afectate, câte persoane au confirmat.
5. Dacă e aproape (≤ 100 m), poate răspunde „Da, și la mine” / „Nu, la mine funcționează”.
6. Poate raporta propria avarie în 5 pași, cu pin pe hartă și deduplicare automată.
7. Poate consulta calendarul deconectărilor planificate pentru orice zi din lună.

### Pentru un furnizor

- Anunțurile sunt preluate automat, geocodezate pe adrese și expuse pe hartă.
- Nu e nevoie de integrare tehnică din partea furnizorului — scraperele se adaptează la formatul public existent.

---

## Funcționalități

### Hartă și vizualizare

- **Hartă reală** (Leaflet + OpenStreetMap/CARTO) cu temă deschisă și întunecată.
- **5 moduri de codificare vizuală**: culoare = gravitate (roșu total / galben parțial / gri închis), iconiță = tip (apă / gaz / electricitate), dungi oblice = raportare cetățenească, linie punctată = raportare neconfirmată, contur = status.
- **Clustere inteligente** — la zoom depărtat, markerele suprapuse devin un grup cu numărul de evenimente și inel `conic-gradient` care arată proporția total/parțial.
- **Zona afectată** — câte un cerc mic (25–55 m) pentru fiecare adresă din anunț, ca să nu se suprapună cercuri mari.
- **Raza afișată** (Setări) — vezi doar ce e în jurul tău sau al fiecărei adrese salvate.

### Evenimente

- **Pagina evenimentului** — sursă, început/sfârșit oficial, countdown („Se reia în aproximativ 3 h”), străzi afectate, confirmatori, expirare automată.
- **Votare** — „Da, și la mine” / „Nu, la mine funcționează”, un vot per dispozitiv, doar dacă ești la ≤ 100 m.
- **Urmărire** — primești notificări pentru un eveniment anume.
- **Distribuire** — link direct (`?e=id`) prin Web Share API sau clipboard.
- **Calendar** — deconectările planificate pentru orice zi din lună, cu navigare și agendă zilnică.

### Raportare

- **Flux în 5 pași**: tip → locație (pin pe hartă) → verificare duplicate → detalii (severitate + descriere) → trimitere.
- **Potrivire pe stradă reală** (OpenStreetMap/Overpass) — pinul se lipește de axul străzii, cu segment de ±120 m.
- **Deduplicare automată** — dacă există o raportare similară la ≤ 300 m, utilizatorul e invitat să o confirme în loc să creeze una nouă.
- **Expirare automată** — raportările neconfirmate expiră în 6 h; cele confirmate, în 24 h fără activitate.
- **Credibilitate** — fiecare „Da” +1, fiecare „Nu” −0.5. Sub 40 → blocat 7 zile.

### Cont și adrese

- Autentificare cu **email**, **Google** sau **telefon** (SMS).
- **Adrese salvate** — „Acasă” + până la 5 adrese cu nume date de tine.
- **Alerte personalizate** — evenimentele care ating o adresă salvată apar primele.
- **Istoric** — ce ai raportat, confirmat sau negat.
- **Ștergere cont** completă (GDPR — dreptul la ștergere).

### Stări și robustețe

- Încărcare (skeleton), gol, offline („Afișăm datele salvate”), GPS refuzat (adresă manuală), eroare („Reîncearcă”).
- **Responsive** — panou lateral pe desktop, bottom sheet cu 3 poziții pe mobil (mini / mid / tall), cu tragere nativă.
- **Temă** — deschisă / întunecată / sistem.

---

## Arhitectură

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React 18 + TypeScript + Vite)                        │
│  ├─ Hartă Leaflet + OpenStreetMap / CARTO                       │
│  ├─ UI responsive (panou desktop / bottom sheet mobil)          │
│  ├─ i18n (RO / RU / EN), accesibilitate WCAG AA                 │
│  └─ Firebase Auth + Firestore (onSnapshot în timp real)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Firebase)                                             │
│  ├─ Firestore: events, users, votes, blockedDevices             │
│  ├─ Authentication: email, Google, telefon                      │
│  ├─ Cloud Functions (Python 3.12) — bot Telegram                │
│  └─ Security Rules (firestore.rules)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  INGESTIE DATE OFICIALE (GitHub Actions)                        │
│  ├─ sync_acc.py     → apă (Apă-Canal Chișinău)                  │
│  ├─ sync_premier.py → electricitate (Premier Energy)            │
│  └─ sync_gas.py     → gaz (Energocom, Chișinău-Gaz)             │
│  ├─ Geocodare: Nominatim (OSM)                                  │
│  └─ Cache geocodare între rulări                                │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxul de date

1. **Scraperele** citesc site-urile furnizorilor → geocodează fiecare adresă → scriu în Firestore cu `areas: [{lat, lng, radiusM, label}]`.
2. **Firestore `onSnapshot`** livrează în timp real lista de evenimente către fiecare client conectat.
3. **Clientul** îmbogățește fiecare eveniment cu status (calculat), distanță, locații afectate și îl afișează pe hartă.
4. **Raportările cetățenilor** intră în același pipeline prin `eventsService.create()` → apar instant pe toate hărțile deschise.
5. **Voturile** sunt scrise în `events/{id}/votes/{deviceId}` → contorul se actualizează → Cloud Function recalculează credibilitatea autorului.

---

## Pornire rapidă

**Cerințe:** Node.js 18+.

```bash
git clone <repo>
cd work-in-progress
npm install
cp .env.example .env.local   # opțional
npm run dev                  # http://localhost:5173
```

| Comandă | Ce face |
| --- | --- |
| `npm run dev` | Server de dezvoltare |
| `npm run build` | Verificare TypeScript + build de producție în `dist/` |
| `npm run preview` | Servește local build-ul de producție |
| `npm run typecheck` | Doar verificarea TypeScript |
| `npm run check:i18n` | Verifică că toate textele au traduceri în RU și EN |

### Publicare pe Vercel

1. Urcă proiectul pe GitHub.
2. Pe [vercel.com](https://vercel.com): **Add New → Project → Import** repository-ul.
3. Vercel detectează automat Vite (`vercel.json` inclus). Build: `npm run build`, output: `dist`.
4. Opțional, în **Settings → Environment Variables**, adaugă variabilele din `.env.example`.
5. **Deploy**. Fiecare push pe `main` publică automat o versiune nouă.

### Urcare pe GitHub

```bash
git remote add origin https://github.com/<organizatia>/work-in-progress.git
git push -u origin main
```

Workflow-ul din `.github/workflows/ci.yml` verifică tipurile, build-ul și traducerile la fiecare push și pull request.

### Variabile de mediu

| Variabilă | Implicit | Rol |
| --- | --- | --- |
| `VITE_USE_DEMO_LOCATION` | `false` | `true` = locație demonstrativă în Botanica în loc de GPS. |
| `VITE_TILES_LIGHT` / `VITE_TILES_DARK` | CARTO Positron / Dark Matter | Stilul hărții. |
| `VITE_FIREBASE_*` | — | Configurația Firebase (obligatorie pentru producție). |
| `VITE_FIRESTORE_EMULATOR` | — | Doar în dev: `127.0.0.1:8085` folosește emulatorul local. |

---

## Structura proiectului

```
src/
├── App.tsx                  # Layout + rute (/ și /telegram-auth)
├── main.tsx                 # Punct de intrare
├── config/
│   ├── constants.ts         # Praguri de produs (confirmări, expirare, raze)
│   ├── categories.ts        # Categorii, subtipuri, culori, iconițe
│   └── legal.ts             # Datele operatorului (⚠️ de completat)
├── data/                    # Date demonstrative (evenimente, străzi)
├── services/
│   ├── eventsService.ts     # Interfața + implementarea Firebase
│   ├── firebaseEventsService.ts
│   ├── authService.ts       # Email / Google / telefon
│   ├── userService.ts       # Profil, adrese, istoric, credibilitate
│   ├── geocoding.ts         # Nominatim (OSM)
│   └── streetMatch.ts       # Potrivire pe stradă reală (Overpass)
├── state/AppContext.tsx     # Starea globală + acțiunile
├── lib/                     # geo, status, format, storage, consent, icons
├── hooks/useMediaQuery.ts
├── components/
│   ├── layout/              # TopBar, Panel, BottomSheet, SearchBox, Splash
│   ├── map/                 # MapView, clustere, markere, overlay, controale
│   ├── events/              # Listă, detaliu, badge-uri, proximity prompt
│   ├── report/              # Fluxul de raportare în 5 pași
│   ├── auth/                # Autentificare + TelegramLinkPage
│   ├── settings/            # Profil, adrese, temă, rază, cont
│   ├── calendar/            # Calendarul deconectărilor
│   ├── legal/               # Banner cookie-uri + politici
│   ├── location/            # Adresă manuală
│   ├── help/                # Onboarding
│   └── ui/                  # Dialog, AddressInput, StreetInput
├── i18n/                    # RO / RU / EN
├── legal/                   # Politici complete în 3 limbi
└── styles/
    ├── tokens.css           # Design tokens (light + dark)
    └── app.css              # Stiluri componente

telegram-bot/                # Cloud Function Python (bot)
scripts/acc_outages/         # Scrapere Python (apă, energie, gaz)
```

---

## Reguli de produs

Toate pragurile sunt centralizate în `src/config/constants.ts` — ajustabile fără a atinge componentele:

| Constantă | Valoare | Semnificație |
| --- | --- | --- |
| `CONFIRM_THRESHOLD` | 3 | Confirmări necesare ca o raportare să devină publică |
| `CONTEST_MIN_DENIALS` | 3 | Negări minime pentru statusul „Contestat” |
| `VOTE_RADIUS_M` | 100 | Raza în care poți confirma |
| `PROMPT_RADIUS_M` | 50 | Raza la care apare întrebarea „Ai și tu problema asta?” |
| `PROMPT_ACCURACY_MAX_M` | 100 | Raza întrebării crește cu precizia GPS, plafonat |
| `DEDUP_RADIUS_M` | 300 | Raza de căutare a raportărilor similare |
| `REPORT_EXPIRY_H` | 6 | Expirarea raportărilor neconfirmate |
| `CONFIRMED_EXPIRY_H` | 24 | Expirarea raportărilor confirmate fără activitate |
| `MAP_AHEAD_H` | 48 | Fereastra hărții: acum + 48 h |
| `CRED_START` | 50 | Credibilitate la început |
| `CRED_YES` | 1 | Puncte pentru fiecare „Da” |
| `CRED_NO` | 0.5 | Puncte scăzute pentru fiecare „Nu” |
| `CRED_MIN` | 40 | Sub această valoare nu mai poți raporta |
| `REPORT_BLOCK_DAYS` | 7 | Durata blocării |
| `IMPACT_RADIUS_M` | 50 | Distanța la care o adresă salvată e „afectată” |
| `MAX_EXTRA_ADDRESSES` | 5 | Adrese suplimentare pe lângă „Acasă” |
| `DESCRIPTION_MAX` | 280 | Limita descrierii |
| `LOCATE_ZOOM` | 15 | Zoomul la „Locația mea” |
| `RADIUS_OPTIONS` | all / 1 / 2 / 5 km | Opțiunile de rază din Setări |

---

## Botul Telegram

Botul `WIPNotifier` (Cloud Function Python) oferă:

- **`/start`** — mesaj de bun venit + instrucțiuni.
- **`/login`** — generează un link personal `/telegram-auth?token=...` valabil 10 minute.
- **`/report`** — raportare directă din chat, fără browser.
- **Notificări** — după asociere, botul trimite alerte când apare un eveniment nou care afectează adresele salvate.

### Fluxul de asociere

```
1. Utilizator: /login în Telegram
2. Bot: token random + link https://<app>/telegram-auth?token=abc123 (TTL 10 min)
3. Utilizator: deschide link-ul → autentificare Firebase (Google sau email)
4. Pagina: POST la linkTelegramAccount cu { token, idToken }
5. Cloud Function: validează token + idToken → scrie users/{uid}.telegramChatId
6. Bot: trimite „Cont conectat ✓” în chat
7. De acum, botul trimite notificări pentru adresele salvate
```

Instrucțiunile complete sunt în [`telegram-bot/README.md`](telegram-bot/README.md).

---

## Fluxuri oficiale de date

Trei scrapere Python rulate automat de GitHub Actions:

| Furnizor | Frecvență | Subtip | Fișier |
| --- | --- | --- | --- |
| Apă-Canal Chișinău | orar | `apa` | `scripts/acc_outages/sync_acc.py` |
| Premier Energy Distribution | orar | `electricitate` | `scripts/acc_outages/sync_premier.py` |
| Energocom + Chișinău-Gaz | la 2 ore | `gaz` | `scripts/acc_outages/sync_gas.py` |

**Ce fac toate:**

- Citesc sursa oficială (HTML sau RSS).
- Extrag adresele, intervalele, motivul.
- Geocodează fiecare adresă (Nominatim).
- Grupează adresele vecine în zone de 25–55 m.
- Scriu în Firestore cu `sourceType: 'official'`, `feed: 'live'`.
- La dispariția anunțului → `resolvedAt` (reconectat).
- Șterg evenimentele rezolvate de > 24 h.

**Configurare:** în GitHub → Settings → Secrets → Actions, adaugă `FIREBASE_SERVICE_ACCOUNT` cu JSON-ul contului de serviciu Firebase.

**Rulare locală fără Firestore:**

```bash
pip install -r scripts/acc_outages/requirements.txt
python scripts/acc_outages/sync_acc.py --dry-run --out acc.json
```

---

## Confidențialitate și consimțământ

Proiectat cu **privacy by design**:

- **GPS-ul nu părăsește dispozitivul** — se trimite doar locul unei raportări create de tine.
- **Consimțământ granular** — preferințele (temă, limbă, rază, adresă manuală) se salvează doar cu acord; cele necesare (device ID, voturi, raportări) sunt mereu active.
- **Banner la prima deschidere** cu opțiuni egale („Doar necesare” / „Acceptă toate” / „Alege ce accepți”).
- **Politici complete** în RO / RU / EN (`src/legal/policies.ts`), care descriu exact ce face codul.
- **Servicii externe transparente**: Google (Firebase, Fonts), Vercel (hosting), CARTO (hărți), OpenStreetMap (Nominatim, Overpass).
- **Dreptul la ștergere** — „Șterge contul” din Setări șterge profilul, adresele, istoricul **și** contul Firebase Authentication.

⚠️ **Înainte de lansare publică:** completează datele operatorului în `src/config/legal.ts` (denumire juridică, IDNO, adresă, email protecția datelor).

---

## Internaționalizare

- **3 limbi**: Română (sursă), Rusă, Engleză.
- **Sistem `t('text românesc')`** — cheia este textul românesc, traducerile sunt în `src/i18n/ru.ts` și `src/i18n/en.ts`.
- **Plurale corecte** per limbă (`tp(n, 'eveniment', 'evenimente')`): RO 3 forme, RU 3 forme, EN 2 forme.
- **Verificare automată** — `npm run check:i18n` eșuează dacă lipsește o traducere; rulează și în CI.
- **Tranziție lină** la schimbarea limbii (View Transitions API cu fallback).
- **Textul oficial** preluat de la furnizori rămâne în limba sursei (română).

---

## Accesibilitate

- **Contrast WCAG AA** verificat în ambele teme.
- **Navigare completă cu tastatura** — focus vizibil, `skip-link`, ARIA labels.
- **`prefers-reduced-motion`** respectat (fără animații).
- **ARIA corect** — `combobox` / `listbox` pentru autocomplete, `dialog` / `alertdialog` pentru modale, `live regions` pentru status.
- **Bottom sheet cu tastatură** — Escape, Enter/Space pe grip.
- **`inert`** pe conținutul ascuns al sheet-ului în `mini`.

---

## Scalabilitate

Arhitectura este pregătită pentru creștere:

- **Strat de servicii abstract** (`EventsService`) — poți schimba backend-ul fără a atinge UI-ul.
- **Ingestie modulară** — fiecare furnizor are scraperul propriu; adăugarea unui furnizor nou = un script nou + un workflow.
- **Schema `events` extensibilă** — câmpul `areas[]` permite oricâte adrese per anunț; `path[]` permite geometrie de traseu.
- **i18n pregătit** pentru orice limbă nouă — adaugi un fișier și înregistrezi limba.
- **Role și credibilitate** — modelul `UserRole` (User → Trusted → Government → Manager → Admin) permite delegarea moderării.
- **Cloud Functions** — pregătite pentru procesare pe server (credibilitate, deduplicare server-side, notificări).
- **Firestore indexes** — deja definite pentru query-urile frecvente (`authorId+createdAt`, `category+createdAt`).
- **API-ready** — structura de date este compatibilă cu un API REST/GraphQL viitor.

### Extensii naturale

- **Notificări push** (Web Push + FCM) pentru adresele salvate.
- **Aplicație mobilă** nativă (React Native cu același backend).
- **Dashboard pentru furnizori** — să vadă în timp real ce raportează cetățenii în zona lor.
- **Integrare cu primăria** — API pentru instituții publice.
- **Zone extinse** — telecomunicații, drumuri, transport public (schema `CategoryKey` este deja extensibilă).
- **Predicții** — pe baza istoricului, estimarea probabilității unei avarii în zona ta.

---

## Limitări cunoscute

- **Datele demonstrative** sunt generate local și marcate ca atare. Scraperele sunt reale, dar volumul depinde de activitatea furnizorilor.
- **Traseele străzilor** din `data/streets.ts` sunt aproximative (fallback offline pentru `streetMatch`). În producție se folosește Overpass (geometrie OSM reală).
- **Upload-ul de fotografii** și **emailul de resetare** sunt simulate.
- **Tile-urile CARTO** au termeni de utilizare și limite de trafic — pentru producție, se recomandă o instanță proprie sau un contract.
- **Overpass/Nominatim** sunt servicii publice cu rate limits — în producție, se recomandă o instanță proprie.
- **Datele operatorului** din `src/config/legal.ts` trebuie completate înainte de lansare publică.

---

## Design

Tokenii de design, culorile categoriilor și contrastele verificate sunt în [`docs/DESIGN.md`](docs/DESIGN.md).

---

## Echipă

**Work In Progress — Chișinău** a fost construit de la zero în cadrul **Deeptech GigaHack — Open Challenge**.

Echipa a acoperit:

- **Frontend React + TypeScript** — hartă Leaflet, bottom sheet mobil, flux de raportare, i18n.
- **Backend Firebase** — Firestore, Authentication, Cloud Functions.
- **Bot Telegram** — Python, asociere cont, notificări.
- **Scrapere Python** — 3 furnizori oficiali, geocodare, zone pe adrese.
- **Design system** — tokens, contrast WCAG AA, accesibilitate.
- **Politici legale** — GDPR, cookie-uri, confidențialitate în 3 limbi.

---

## Licență

Copyright (c) 2026 "Work In Progress". All rights reserved.

This source code and its associated intellectual property are proprietary. 
No part of this project may be copied, reproduced, distributed, modified, 
or used to create derivative works without the express written permission 
of the copyright holder.

---

**Work In Progress — Chișinău** · *„Am apă/curent/gaz la adresa mea?” — răspuns într-o secundă.*