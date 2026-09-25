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
