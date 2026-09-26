# Stratul de date

UI-ul folosește doar interfața `EventsService` din `eventsService.ts`. Acum rulează implementarea demonstrativă (`mockEventsService`), cu date generate relativ la ora curentă.

## Conectarea la Firebase (pași recomandați)

1. `npm install firebase`
2. Completează variabilele `VITE_FIREBASE_*` în `.env.local` și în Vercel (Settings → Environment Variables).
3. Creează `firebaseEventsService.ts` care implementează `EventsService`:
   - `list()` → citește colecția `events` (filtrare după status/timp pe server sau cu reguli).
   - `create()` → `addDoc(collection(db, 'events'), …)`; `location` ca `GeoPoint`, `path` ca listă de `GeoPoint`.
   - `vote()` → document `events/{id}/votes/{deviceId}` (un vot pe dispozitiv) + contor actualizat de o Cloud Function.
   - `remove()` → permis doar autorului (Firestore Security Rules: `request.auth.uid == resource.data.authorId`).
4. În `eventsService.ts` înlocuiește `export const eventsService = mockEventsService` cu implementarea Firebase.

## Structura documentelor

- `events/{id}` — vezi tipul `UrbanEvent` din `src/types/index.ts`.
- `users/{uid}` — `{ name, email }`.
- `users/{uid}/locations/{id}` — vezi tipul `SavedLocation`.

Pragurile (confirmări, expirare, rază de vot, rază de deduplicare) sunt în `src/config/constants.ts`. Aceleași valori trebuie aplicate și pe server.

## Străzile raportărilor

`streetMatch.ts` găsește strada reală a pinului unei raportări (OpenStreetMap: Overpass pentru geometrie, Nominatim pentru sector și număr). Pinul se lipește de stradă dacă e la cel mult 60 m, iar segmentul afectat (±120 m) urmează strada. Între 60 și 150 m se păstrează doar numele străzii. Dacă serviciile nu răspund, se folosește numele din `data/streets.ts`, fără traseu. Pentru producție, serviciile publice OSM trebuie înlocuite cu o instanță proprie (limite de trafic).

## Flux oficial: apă deconectată (Apă-Canal Chișinău)

`.github/workflows/acc-outages.yml` rulează o dată pe oră `scripts/acc_outages/sync_acc.py`, care citește https://acc.md/disconnections și scrie în `events` documente cu `category: 'utilitati'`, `subtype: 'apa'`, `title: 'Apă deconectată'`, `sourceType: 'official'`, `feed: 'live'`, `source: 'Apă-Canal Chișinău'`.

- **Surse:** „Sistări planificate” (text liber: data, intervalul și adresele sunt extrase din anunț), „Sistări curente” și rândurile cu deconectare din „Avarieri apeduct” (tabel, id `acc-<nr. fișă>`). Scurgerile fără deconectare și „Avarieri canalizare” nu se importă.
- **Gravitate:** `partial` când anunțul spune „presiune joasă”, altfel `total`.
- **Locație:** Nominatim, prima adresă din anunț; se refolosește din documentul existent cât timp adresa nu se schimbă (`geoKey`). Anunțurile fără adresă găsită sunt omise (avertisment în log).
- **Închidere:** un anunț care dispare de pe site primește `resolvedAt` (apa a fost reconectată). Voturile (`confirmations`, `denials`) nu sunt suprascrise.
- **Ștergere:** evenimentele fluxului rezolvate de peste 24 h se șterg (împreună cu `votes`), la fel și anunțurile încheiate de peste 24 h, ca aplicația să nu citească istoricul la fiecare deschidere.
- **Siguranță:** dacă structura paginii se schimbă, scriptul se oprește fără să atingă Firestore.

Configurare: în GitHub → Settings → Secrets and variables → Actions, adaugă `FIREBASE_SERVICE_ACCOUNT` cu JSON-ul unui cont de serviciu din Firebase (Project settings → Service accounts → Generate new private key). Pornire manuală: Actions → „Flux ACC — apă deconectată” → Run workflow (opțiunea „Doar citire” nu scrie nimic).

Local, fără Firestore: `pip install -r scripts/acc_outages/requirements.txt && python scripts/acc_outages/sync_acc.py --dry-run --out acc.json`

## Flux oficial: energie electrică deconectată (Premier Energy Distribution)

Același workflow rulează, ca job separat, `scripts/acc_outages/sync_premier.py`. Sursa: https://www.premierenergydistribution.md/ro/toate-lucrarile-programate (un calendar cu câte o pagină pe zi). Documentele au `subtype: 'electricitate'`, `title: 'Energie electrică deconectată'`, `source: 'Premier Energy Distribution'`, `planned: true`, id `ped-<zi>-<hash>`.

- **Ce se importă:** paginile „Lucrări programate” de azi până la 31 de zile înainte, doar secțiunile „Chișinău, …” (sectoare și localitățile municipiului). Fiecare rând (adrese + interval + motiv) = un eveniment. „Întreruperile de manevră” (noaptea, max. 30 min, sectoare întregi) nu se importă.
- **Gravitate:** `partial` când rândul spune „parțial”, altfel `total`.
- **Adrese:** în listă apar primele 12 străzi, restul în descriere. Pinul (și distanța folosită de rază) = prima adresă din rând.
- **Site lent:** paginile răspund în 20–60 s; cererile au timeout de 120 s și 3 încercări. Dacă pagina unei zile nu se descarcă, evenimentele acelei zile rămân neatinse.
- Zilele trecute nu se mai importă: evenimentele lor sunt rezolvate, apoi șterse după 24 h (ca la ACC).

Local, fără Firestore: `python scripts/acc_outages/sync_premier.py --dry-run --out premier.json`



## Zone pe adrese (fluxurile oficiale)

Scraperele geocodează fiecare adresă dintr-un anunț (câte un număr de casă; intervalele „1-17” → capetele) și salvează `areas: [{lat, lng, radiusM, label}]`. Casă găsită exact → 25 m; doar strada → 55 m. Adresele vecine se unesc într-o zonă comună doar dacă aceasta rămâne ≤ 55 m; altfel formează o zonă nouă. Zonele care nu pot fi unite, dar se acoperă mult, se micșorează până se ating. Aplicația afișează câte un eveniment pe zonă (id `anunț~n`); calendarul păstrează un rând pe anunț. Geocodarea se păstrează între rulări (`GEOCACHE_PATH`, în Actions prin `actions/cache`).

## Limbi (română, rusă, engleză)

Textul din cod e în română; `t('…')` din `src/i18n` îl întoarce în limba aleasă (RO | RU | EN în bara de sus sau în Setări). Traducerile sunt în `src/i18n/ru.ts` și `src/i18n/en.ts`, cheiate după textul românesc; pluralele în `RU_PLURALS` și `EN_PLURALS`. **Orice text nou din interfață trebuie adăugat în ambele fișiere** — `npm run check:i18n` (rulat și în CI) eșuează altfel. Datele salvate în Firestore rămân în română (ex. titlurile raportărilor); se traduc doar la afișare. Textul oficial preluat de la furnizori (descrieri, străzi) rămâne în limba sursei.


## Flux oficial: gaz (Energocom, Chișinău-Gaz)

`.github/workflows/gas-outages.yml` rulează **la 2 ore** `scripts/acc_outages/sync_gas.py` (subtip `gaz`, titlu „Gaz deconectat”, `planned: true`).

- **Energocom** (`source: 'Energocom'`, id `ecom-…`): fluxul RSS al categoriei „Deconectări”. Furnizor național, deci localitățile se geocodează în toată țara (cu raionul, când anunțul îl dă). Străzile „str. X nr. 1, 2” devin zone pe adrese; o localitate fără străzi = o zonă de 55 m în centrul ei. Anunțurile „Reluarea livrării…” se ignoră; o localitate omonimă găsită la peste 60 km de restul anunțului se elimină.
- **Chișinău-Gaz** (`source: 'Chișinău-Gaz'`, id `cgaz-<zi>-…`): tabelul de pe pagina „Deconectări” (cerere POST cu token CSRF, toate paginile). Rândurile cu aceeași zi, sector și motiv = un eveniment. Tabelul nu are ore: evenimentul acoperă toată ziua.
- **Mutări de dată pentru demonstrație:** `DATE_OVERRIDES` din `sync_gas.py` mută anunțurile din 24 și 25 septembrie 2026 pe 27 septembrie (aceleași ore); descrierea spune data originală. Goliți dicționarul ca să reveniți la datele reale.


## Grupuri pe hartă

La zoom depărtat, markerele care se suprapun (mai aproape de ~44 px pe ecran) devin un grup mai mare, în culoarea tipului dominant, cu inel pe tipuri și numărul de evenimente în colțul din dreapta sus (`src/components/map/clusters.ts`). Clic = zoom până se separă; evenimentele în același loc (≤ 10 m) rămân grupate și clicul le arată în listă („N evenimente în același loc · Arată toate”).


## Cookie-uri, consimțământ și confidențialitate

- La prima deschidere apare bannerul de cookie-uri (`src/components/legal/ConsentBanner.tsx`). „Necesare” sunt mereu active; „Preferințe” (limba, tema, raza, adresa introdusă, ghidul văzut, întrebările închise) se salvează pe dispozitiv **doar cu acord** — regula e aplicată în `src/lib/storage.ts` (`PREFERENCE_KEYS`). Orice cheie nouă din localStorage trebuie clasificată acolo și descrisă în politica de cookie-uri.
- Politicile (confidențialitate + cookie-uri, RO/RU/EN) sunt în `src/legal/policies.ts` și descriu exact datele și serviciile folosite de cod. **La orice schimbare a datelor colectate sau a serviciilor externe, actualizați-le.**
- ⚠️ Datele operatorului (denumire juridică, IDNO, adresă, email pentru protecția datelor) sunt în `src/config/legal.ts` și trebuie completate înainte de lansarea publică.
- „Șterge contul” șterge profilul, adresele, istoricul **și** contul din Firebase Authentication (dreptul la ștergere).
