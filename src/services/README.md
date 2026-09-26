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
