# Sistem de design

## Principii

- **Harta e ecranul principal.** Aplicația se deschide direct pe hartă.
- **Gravitatea, dintr-o privire.** Culoarea arată gravitatea: întrerupere totală = roșu, parțial = galben. Raportările vecinilor au aceleași culori, cu dungi oblice; cât sunt neconfirmate, conturul e punctat. Iconița arată tipul (apă, electricitate, gaz).
- **Niciodată doar culoare.** Fiecare status are și insignă text, iar fiecare tip are iconiță și etichetă.
- **Roșul înseamnă „fără serviciu”** (întrerupere totală); erorile folosesc `--crit`, cu iconiță și text.
- **Calm și minimalist.** Text scurt, ierarhie clară, spațiere generoasă.

## Tipografie

Onest (Google Fonts), cu fallback pe fontul sistemului.

| Rol | Mărime / greutate |
| --- | --- |
| Titlu eveniment | 21 / 700 |
| Titlu panou | 17 / 700 |
| Titlu în listă | 15 / 600 |
| Text de bază, butoane | 14 / 400–600 |
| Meta | 13 / 400 |
| Insigne | 12 / 600 |

## Categorii — contrast (WCAG 2.1)

| Categorie | Luminos | Alb pe culoare | Pe hartă | Întunecat | Icon închis pe culoare | Pe suprafață |
| --- | --- | --- | --- | --- | --- | --- |
| Utilități | `#1F5FC9` | 5,93:1 | 4,94:1 | `#7AA7FF` | 7,87:1 | 7,24:1 |
| Telecomunicații | `#6B3FC4` | 6,70:1 | 5,58:1 | `#B69CFF` | 8,22:1 | 7,56:1 |
| Drumuri | `#A94F00` | 5,52:1 | 4,59:1 | `#F59A4A` | 8,59:1 | 7,90:1 |
| Transport public | `#1C7340` | 5,87:1 | 4,89:1 | `#5CC98A` | 9,10:1 | 8,37:1 |
| Lucrări urbane | `#0B6B75` | 6,22:1 | 5,18:1 | `#4CC3CC` | 8,93:1 | 8,22:1 |

Textul secundar: `#555A61` pe alb 6,95:1 (luminos), `#A9B0B9` pe `#171B21` 7,90:1 (întunecat).

## Statusuri

| Aspect | Culoare (luminos / întunecat) | Iconiță pe culoare |
| --- | --- | --- |
| Întrerupere totală | roșu `#C0271D` / `#FF7A6B` | albă 5,9:1 / închisă 7,4:1 |
| Parțial | galben `#FACC15` (contur `#A16207`) / `#FACC15` | închisă 12:1 |
| Raportare a vecinilor | aceleași culori + dungi oblice în culoarea iconiței | — |
| Neconfirmat | contur punctat | — |
| Rezolvat / expirat | gri `#7A7F86` / `#8E959F` | — |

Roșul și galbenul au luminozități foarte diferite, deci se deosebesc și la daltonism. Erorile folosesc `--crit`.

Tokeni: `--s-full`, `--s-partial`, `--s-closed`, fiecare cu `-fg` (iconița), `-line` (contur, text) și `-t` (nuanța deschisă), în `src/styles/tokens.css`.

| Status | Marker | Insignă |
| --- | --- | --- |
| Oficial | plin + scut | „Oficial” (fundal închis) |
| Confirmat | plin + număr de vecini | „Confirmat de X vecini” |
| Neconfirmat | contur punctat (vizibil doar autorului) | „Neconfirmat” |
| Contestat | estompat + „?” | „Contestat” |
| Rezolvat / Expirat | gri, ascuns de pe hartă | „Rezolvat” / „Expirat” |

**Gravitate:** „Întrerupere totală” are fundal plin și linie continuă. „Parțial — posibil afectat” are fundal deschis și linie întreruptă.

## Tokeni semantici

Definiți în `src/styles/tokens.css` pentru ambele teme: `--bg`, `--surface`, `--surface-2`, `--sunk`, `--border`, `--border-strong`, `--text`, `--text-2`, `--text-3`, `--ink`, `--on-ink`, `--c-<categorie>`, `--c-<categorie>-t`, `--crit`, `--resolved`.
