"""
Flux oficial: sistările de gaze naturale → colecția Firestore `events` (subtip `gaz`, `planned: true`).

Surse:
  • Energocom — https://energocom.md/category/furnizare-ro/deconectari/ (fluxul RSS al categoriei).
    Furnizor național: localitățile se geocodează în toată țara. Fiecare anunț = un eveniment,
    cu zone pe adrese (străzile „str. X nr. 1, 2”) sau, fără străzi, pe localitate.
  • Chișinău-Gaz — https://chisinaugaz.md/ro/disconnection (tabel: sector, stradă, blocuri, dată, motiv).
    Rândurile cu aceeași dată, sector și motiv formează un eveniment. Tabelul nu are ore → toată ziua.

Geocodarea, zonele (max. 55 m) și scrierea în Firestore sunt comune cu sync_acc.py.
Rulează la 2 ore (.github/workflows/gas-outages.yml).

Local, fără Firestore:
  python scripts/acc_outages/sync_gas.py --dry-run --out gas.json
"""
from __future__ import annotations

import html
import http.cookiejar
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

from sync_acc import (
    BROWSER_UA, RETENTION, TZ, Outage, ascii_fold, clean, cli_args, fix_diacritics, https_handler, parse_interval,
    point_targets, publish, stable_id, summary,
)

TITLE = 'Gaz deconectat'
EC_SOURCE = 'Energocom'
EC_FEED = 'https://energocom.md/category/furnizare-ro/deconectari/feed/'
CG_SOURCE = 'Chișinău-Gaz'
CG_PAGE = 'https://chisinaugaz.md/ro/disconnection'
CG_TABLE = 'https://chisinaugaz.md/ro/disconnections'
CG_MAX_PAGES = 15

# Mutări de dată cerute pentru demonstrație: anunțurile programate în aceste zile apar în ziua din dreapta,
# la aceleași ore. Descrierea evenimentului spune clar data originală. Goliți dicționarul ca să reveniți la datele reale.
DATE_OVERRIDES: dict[date, date] = {
    date(2026, 9, 24): date(2026, 9, 27),
    date(2026, 9, 25): date(2026, 9, 27),
}
MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august',
             'septembrie', 'octombrie', 'noiembrie', 'decembrie']

LOCALITY_RE = re.compile(
    r'\b(municipiul|mun\.|orașul|or\.|satul|satele|s\.|comuna|com\.)\s+'
    r'([A-ZĂÂÎȘȚ][\wăâîșț-]+(?:[ -][A-ZĂÂÎȘȚ][\wăâîșț-]+)*(?:\s+și\s+[A-ZĂÂÎȘȚ][\wăâîșț-]+(?:[ -][A-ZĂÂÎȘȚ][\wăâîșț-]+)*)?)'
)
RAION_RE = re.compile(r'\braionul\s+([A-ZĂÂÎȘȚ][\wăâîșț-]+)')
# „str. Medicilor nr. 1/1, 1/2 și 3/2” — numerele se opresc la primul „.” / „;” (sfârșit de propoziție sau de listă).
STREET_RE = re.compile(r'\bstr\.\s+([^;:.\n]+?)\s+nr\.\s+([\w/\-–, ]+?(?:\s+și\s+[\w/\-–]+)*)(?=\s*[.;\n]|\s*$)')
# „21–26 septembrie 2026” → „21 septembrie – 26 septembrie 2026” (ca `parse_interval` să vadă ambele zile).
DAY_RANGE_RE = re.compile(r'\b(\d{1,2})\s*[–-]\s*(\d{1,2})\s+(' + '|'.join(MONTHS_RO) + r')\b', re.I)


def opener() -> urllib.request.OpenerDirector:
    """Cu cookie-uri (Chișinău-Gaz cere sesiunea în care a fost emis tokenul CSRF)."""
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), https_handler())
    op.addheaders = [('User-Agent', BROWSER_UA), ('Accept-Language', 'ro')]
    return op


def fetch(op: urllib.request.OpenerDirector, url: str, data: dict | None = None, headers: dict | None = None) -> str:
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers or {})
    with op.open(req, timeout=60) as res:
        return res.read().decode('utf-8', errors='replace')


def text_of(fragment: str) -> str:
    t = re.sub(r'<(br|/p|/li|/tr|/h\d)[^>]*>', '\n', fragment)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t).replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    return fix_diacritics(re.sub(r'\n\s*\n+', '\n', t)).strip()


def apply_override(start: datetime, end: datetime) -> tuple[datetime, datetime, str]:
    """Mută intervalul conform DATE_OVERRIDES; întoarce și nota pentru descriere (goală dacă nu s-a mutat)."""
    target = DATE_OVERRIDES.get(start.date())
    if not target:
        return start, end, ''
    shift = timedelta(days=(target - start.date()).days)
    orig = f'{start.day} {MONTHS_RO[start.month - 1]} {start.year}'
    return start + shift, end + shift, f'Data mutată pentru demonstrație: anunțul original este pentru {orig}.'


# ---------- Energocom ----------

def energocom(now: datetime) -> tuple[list[Outage], list[str]]:
    op = opener()
    xml = fetch(op, EC_FEED)
    root = ET.fromstring(xml)
    ns = {'content': 'http://purl.org/rss/1.0/modules/content/'}
    out: list[Outage] = []
    warnings: list[str] = []
    for item in root.iter('item'):
        title = fix_diacritics(clean(item.findtext('title') or ''))
        link = item.findtext('link') or ''
        if ascii_fold(title).startswith('reluarea'):
            continue  # anunț de reluare, nu de sistare
        body = text_of(item.findtext('content:encoded', namespaces=ns) or item.findtext('description') or '')
        body = body.split('Pentru informații suplimentare')[0].strip()
        posted = None
        try:
            posted = datetime.strptime(item.findtext('pubDate') or '', '%a, %d %b %Y %H:%M:%S %z').astimezone(TZ).replace(tzinfo=None)
        except ValueError:
            pass
        when = DAY_RANGE_RE.sub(lambda m: f'{m.group(1)} {m.group(3)} – {m.group(2)} {m.group(3)}', f'{title}\n{body}')
        start, end = parse_interval(when, (posted or now).year)
        if not start or not end:
            warnings.append(f'Energocom: fără dată: {title[:100]}')
            continue
        start, end, note = apply_override(start, end)
        if end < now - RETENTION:
            continue  # încheiat

        raion = (RAION_RE.search(f'{title} {body}') or [None, ''])[1]
        # Străzile aparțin ultimei localități menționate înaintea lor.
        targets: list[tuple[str, list[str]]] = []
        localities: list[str] = []
        current = ''
        for para in [title, *body.split('\n')]:
            for m in LOCALITY_RE.finditer(para):
                for name in re.split(r'\s+și\s+', m.group(2)):
                    current = name.strip()
                    if current not in localities:
                        localities.append(current)
            for sm in STREET_RE.finditer(para):
                nums = re.sub(r'\s+și\s+', ', ', sm.group(2)).replace('–', '-')
                in_city = ascii_fold(current) == 'chisinau'
                # Căutarea poartă mereu localitatea (și raionul): furnizorul e național.
                targets += [(label if in_city or not current else f'{current}: {label}',
                             [q + (f', raionul {raion}' if raion and current and not in_city else '') for q in qs])
                            for label, qs in point_targets(f'str. {sm.group(1)}', nums, current or 'Chișinău')]
        # Localitățile fără străzi: zona e centrul localității.
        with_streets = {t[0].split(':')[0] for t in targets}
        for loc in localities:
            if loc not in with_streets and ascii_fold(loc) != 'chisinau':
                q = f'{loc}, raionul {raion}' if raion else loc
                targets.append((loc, [q, loc]))
        if not targets:
            warnings.append(f'Energocom: fără localitate: {title[:100]}')
            continue

        planned = 'neprogramat' not in ascii_fold(title)
        consumers = re.search(r'(\d+)\s+(?:de\s+)?(?:consumatori|locuri de consum)', body)
        desc = ' '.join(x for x in [note, body.split('\n')[0]] if x)
        out.append(Outage(
            id=f'ecom-{stable_id(link or title)}',
            title=TITLE,
            severity='total',
            district=', '.join(localities[:3]) + (f' (r. {raion})' if raion else ''),
            streets=[t[0] for t in targets][:12] + ([f'și încă {len(targets) - 12} adrese'] if len(targets) > 12 else []),
            start=start,
            end=end,
            updated=posted,
            description=(desc + (f' Consumatori afectați: {consumers.group(1)}.' if consumers else ''))[:700],
            geo_targets=targets,
            planned=planned,
            subtype='gaz',
            source=EC_SOURCE,
            national=True,
        ))
    return out, warnings


# ---------- Chișinău-Gaz ----------

ROW_START = re.compile(r'<div class="table-line"\s+data-timestamp="(\d+)">')
CELL_RE = re.compile(r'<div class="table-item[^"]*">\s*(.*?)\s*</div>', re.S)
PAGE_LINK = re.compile(r'href="(https://chisinaugaz\.md/ro/disconnections\?[^"]*page=(\d+)[^"]*)"')


def table_rows(page: str) -> list[tuple[str, list[str]]]:
    """(timestamp, [sector, stradă, blocuri, dată, motiv]) pentru fiecare rând al tabelului."""
    parts = ROW_START.split(page)
    # split cu grup: [înainte, ts1, rând1, ts2, rând2, …]
    return [(parts[i], [clean(text_of(c)) for c in CELL_RE.findall(parts[i + 1])]) for i in range(1, len(parts) - 1, 2)]


def chisinau_gaz(now: datetime) -> tuple[list[Outage], list[str], bool]:
    """Întoarce și dacă tabelul a putut fi citit (altfel nu marcăm nimic „rezolvat”)."""
    op = opener()
    page = fetch(op, CG_PAGE)
    token = re.search(r'name="csrf-token" content="([^"]+)"', page)
    if not token:
        return [], ['Chișinău-Gaz: lipsește tokenul CSRF'], False
    headers = {'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': token.group(1), 'Referer': CG_PAGE}
    html_ = fetch(op, CG_TABLE, {'_token': token.group(1), 'sector': '0', 'month': '0'}, headers)
    pages = [html_]
    # Paginile următoare: linkurile „?…&page=N” din subsolul tabelului (fiecare pagină le repetă).
    # Subsolul arată doar câteva numere (1 2 3 4 … 53): construim toate paginile după modelul unui link.
    links = [(html.unescape(u), int(n)) for u, n in PAGE_LINK.findall(html_)]
    if links:
        template, _ = links[0]
        last = max(n for _, n in links)
        for n in range(2, min(last, CG_MAX_PAGES) + 1):
            pages.append(fetch(op, re.sub(r'page=\d+', f'page={n}', template), headers=headers))
    if 'def-table' not in html_:
        return [], ['Chișinău-Gaz: structura tabelului s-a schimbat'], False

    groups: dict[tuple, dict] = {}
    for p in pages:
        for ts, cells in table_rows(p):
            if len(cells) < 5:
                continue
            sector, street, nums, _, reason = cells[:5]
            day = datetime.fromtimestamp(int(ts), TZ).date()
            key = (day, sector, reason)
            g = groups.setdefault(key, {'rows': []})
            g['rows'].append((street, nums))

    out: list[Outage] = []
    for (day, sector, reason), g in groups.items():
        start = datetime(day.year, day.month, day.day, 0, 0)
        end = datetime(day.year, day.month, day.day, 23, 59)
        start, end, note = apply_override(start, end)
        if end < now - RETENTION:
            continue
        place = re.sub(r'^(sec\.|sectorul|s\.|satul|or\.|orașul|com\.|comuna)\s*', '', sector, flags=re.I).strip()
        is_sector = ascii_fold(sector).startswith('sec')
        targets = [t for street, nums in g['rows'] for t in point_targets(street, nums, '' if is_sector else place)]
        labels = [f'{street} {nums}'.strip() for street, nums in g['rows']]
        out.append(Outage(
            id=f'cgaz-{day}-{stable_id(sector, reason, *labels)}',
            title=TITLE,
            severity='total',
            district=place,
            streets=labels[:12] + ([f'și încă {len(labels) - 12} adrese'] if len(labels) > 12 else []),
            start=start,
            end=end,
            updated=None,
            description=' '.join(x for x in [note, reason, 'Ora exactă nu este publicată de Chișinău-Gaz.'] if x)[:700],
            geo_targets=targets,
            planned=True,
            subtype='gaz',
            source=CG_SOURCE,
        ))
    return out, [], True


def main() -> int:
    args = cli_args(__doc__)
    now = datetime.now(TZ).replace(tzinfo=None)
    status = 0

    try:
        ec, warnings = energocom(now)
    except Exception as e:  # noqa: BLE001
        print(f'Energocom nu a putut fi citit: {e}. Sar peste această sursă.', file=sys.stderr)
        ec, warnings = None, []
        status = 1
    for w in warnings:
        print(f'::warning::{w}')
    out = args.out
    if ec is not None:
        summary(f'Energocom: {len(ec)} sistări (după data de azi).')
        args.out = out and re.sub(r'(\.json)?$', '-energocom.json', out, count=1)
        status |= publish(ec, args, EC_SOURCE, geo_budget=int(os.environ.get('GEO_BUDGET', 400)))

    try:
        cg, warnings, ok = chisinau_gaz(now)
    except Exception as e:  # noqa: BLE001
        print(f'Chișinău-Gaz nu a putut fi citit: {e}. Sar peste această sursă.', file=sys.stderr)
        cg, warnings, ok = [], [], False
        status = 1
    for w in warnings:
        print(f'::warning::{w}')
    if ok:
        summary(f'Chișinău-Gaz: {len(cg)} sistări (după data de azi).')
        args.out = out and re.sub(r'(\.json)?$', '-chisinau-gaz.json', out, count=1)
        # Lista goală e o stare validă (nicio sistare programată): anunțurile vechi devin „rezolvate”.
        if cg or not args.dry_run:
            status |= publish_or_clear(cg, args)
    return status


def publish_or_clear(outages: list[Outage], args) -> int:
    """`publish` refuză o listă fără nicio adresă localizată; o listă goală de la sursă e totuși validă."""
    if outages:
        return publish(outages, args, CG_SOURCE, geo_budget=int(os.environ.get('GEO_BUDGET', 400)))
    if args.dry_run:
        return 0
    from sync_acc import sync_firestore
    sync_firestore([], CG_SOURCE)
    return 0


if __name__ == '__main__':
    sys.exit(main())
