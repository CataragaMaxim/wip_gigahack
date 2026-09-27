# Work In Progress — Chișinău

Platformă urbană care arată pe hartă avariile la utilități, problemele de telecomunicații, lucrările la drumuri, schimbările din transportul public și evenimentele din oraș. Combină **date oficiale** (furnizori, primărie) cu **raportări ale cetățenilor confirmate de vecini**.

> Prototip realizat în cadrul unui hackathon (MVP). Datele afișate sunt **demonstrative** și sunt generate local. Nu sunt anunțuri reale.

## Funcționalități

- **Hartă reală** (Leaflet + OpenStreetMap/CARTO), cu temă deschisă și întunecată. Străzile afectate sunt colorate după categorie.
- **5 categorii**, fiecare cu culoare, iconiță și etichetă: Utilități (apă, gaz, electricitate), Telecomunicații, Drumuri, Transport public, Lucrări și evenimente urbane.
- **Doar informație verificată pe harta publică**: anunțuri oficiale și raportări confirmate de minimum 3 vecini.
- **Pagina evenimentului**: sursă, început și sfârșit oficial, timp rămas, străzi afectate, cine a confirmat, vot „Da, și la mine” / „Nu, la mine funcționează” (un vot pe dispozitiv, fără cont, doar în apropiere).
- **Raportare în 5 pași**: categorie → locație (pin pe hartă) → verificarea raportărilor similare → detalii → trimitere.
- **Cont** doar pentru raportare: creare cont, autentificare, resetare parolă, cu validare în română.
- **Setări**: adrese salvate (Acasă, Serviciu, persoane dragi), temă, rază afișată, raportările mele (cu ștergere), ștergerea contului.
- **Stări**: încărcare, gol, offline, GPS refuzat, eroare cu reîncercare.
- **Responsive**: panou lateral pe desktop, bottom sheet pe mobil.
- **Accesibilitate**: contrast WCAG AA în ambele teme, navigare cu tastatura, etichete ARIA, respectă „reduce motion”.

## Pornire rapidă

Cerințe: Node.js 18 sau mai nou.

```bash
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

## Publicare pe Vercel

1. Urcă proiectul pe GitHub (vezi mai jos).
2. Pe [vercel.com](https://vercel.com): **Add New → Project → Import** repository-ul.
3. Vercel detectează automat Vite (`vercel.json` e inclus). Build: `npm run build`, output: `dist`.
4. Opțional, în **Settings → Environment Variables**, adaugă variabilele din `.env.example`.
5. **Deploy**. Fiecare push pe `main` publică automat o versiune nouă.

## Urcare pe GitHub

```bash
git remote add origin https://github.com/<organizatia>/work-in-progress.git
git push -u origin main
```

Workflow-ul din `.github/workflows/ci.yml` verifică tipurile și build-ul la fiecare push și pull request.

## Variabile de mediu

| Variabilă | Implicit | Rol |
| --- | --- | --- |
| `VITE_USE_DEMO_LOCATION` | `false` | Pune `true` ca să folosești o locație demonstrativă în Botanica în loc de GPS. Implicit, aplicația cere locația live; dacă e refuzată, utilizatorul introduce adresa manual. |
| `VITE_TILES_LIGHT` / `VITE_TILES_DARK` | CARTO Positron / Dark Matter | Stilul hărții. |
| `VITE_FIREBASE_*` | — | Pregătite pentru conectarea la Firebase (vezi `src/services/README.md`). |

## Telegram bot

Botul Python din `telegram-bot/` folosește același proiect Firebase și schema de evenimente ca aplicația web. Instrucțiunile de configurare locală, autentificare/legare cont, rapoarte și publicarea funcției Firebase sunt în [telegram-bot/README.md](telegram-bot/README.md). Pagina web pentru asocierea contului este disponibilă la `/telegram-auth`. Păstrează `BOT_TOKEN` și cheia contului de serviciu numai în configurația privată de server, niciodată în variabilele `VITE_*`.

## Structura proiectului

```
src/
├── App.tsx                  # Layout-ul aplicației
├── main.tsx                 # Punct de intrare
├── config/
│   ├── constants.ts         # Praguri și setări de produs (confirmări, expirare, raze)
│   └── categories.ts        # Categorii, subtipuri, culori
├── data/                    # Date demonstrative (evenimente, străzi, cont demo)
├── services/                # Stratul de date (EventsService: mock → Firebase)
├── state/AppContext.tsx     # Starea aplicației și acțiunile
├── lib/                     # Utilitare: geografie, formatare, status, iconițe
├── hooks/                   # useMediaQuery
├── components/
│   ├── layout/              # TopBar, SearchBox, Panel (panou / bottom sheet)
│   ├── map/                 # Harta Leaflet, markere, filtre, controale
│   ├── events/              # Listă, pagina evenimentului, insigne
│   ├── report/              # Fluxul de raportare și pinul de pe hartă
│   ├── auth/                # Cont: creare, autentificare, resetare
│   ├── settings/            # Setări și adrese
│   └── ui/                  # Dialog, câmp de adresă
└── styles/
    ├── tokens.css           # Tokeni de design (temă deschisă / întunecată)
    └── app.css              # Stiluri componente
```

## Reguli de produs (ajustabile)

Toate sunt în `src/config/constants.ts`:

| Constantă | Valoare | Semnificație |
| --- | --- | --- |
| `CONFIRM_THRESHOLD` | 3 | Confirmări necesare ca o raportare să devină publică |
| `CONTEST_MIN_DENIALS` | 3 | Negări minime pentru statusul „Contestat” |
| `VOTE_RADIUS_M` | 100 | Raza în care poți confirma |
| `DEDUP_RADIUS_M` | 300 | Raza de căutare a raportărilor similare |
| `REPORT_EXPIRY_H` | 6 | Expirarea raportărilor neconfirmate |
| `CONFIRMED_EXPIRY_H` | 24 | Expirarea raportărilor confirmate fără activitate |
| `DESCRIPTION_MAX` | 280 | Limita descrierii |
| `IMPACT_RADIUS_M` | 50 | Distanța (până la adresa evenimentului) la care o adresă salvată e considerată afectată |

## Limitări cunoscute

- Datele, contul și voturile sunt **locale** (memorie + `localStorage`). Nu există încă backend.
- Traseele străzilor și coordonatele evenimentelor sunt **aproximative**. Pot să nu se suprapună exact peste harta reală.
- Încărcarea fotografiilor și trimiterea emailului de resetare sunt simulate.
- Hărțile CARTO au termeni de utilizare și limite de trafic. Verificați-le înainte de o lansare publică.

## Design

Tokenii, culorile categoriilor și contrastele verificate sunt în [`docs/DESIGN.md`](docs/DESIGN.md).
