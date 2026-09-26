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
