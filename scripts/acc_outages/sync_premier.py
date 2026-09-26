"""
Flux oficial: lucrările programate Premier Energy Distribution → colecția Firestore `events` (calendarul aplicației).

Sursa: https://www.premierenergydistribution.md/ro/toate-lucrarile-programate — un calendar (FullCalendar, în
`drupal-settings-json`) cu câte o pagină pe zi. Din fiecare pagină „Lucrări programate” de azi înainte citim doar
secțiunile „Chișinău, sectorul …”; fiecare rând (adrese + interval + motiv) devine un eveniment `electricitate`,
cu `planned: true`. „Întreruperile de manevră” (noaptea, max. 30 min, sectoare întregi) nu se importă.

Serverul răspunde greu (20–60 s pe pagină): cererile au timeout lung și se reîncearcă. Dacă pagina unei zile nu se
descarcă, evenimentele acelei zile rămân neatinse (nu sunt marcate „rezolvat”).

Geocodarea și scrierea în Firestore sunt comune cu sync_acc.py.

Local, fără Firestore:
  python scripts/acc_outages/sync_premier.py --dry-run --out premier.json
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

from sync_acc import (
    SECTORS, TZ, Outage, ascii_fold, clean, cli_args, fix_diacritics, house_query, html_lines, publish, stable_id,
)

BASE = 'https://www.premierenergydistribution.md'
CALENDAR_URL = f'{BASE}/ro/toate-lucrarile-programate'
SOURCE = 'Premier Energy Distribution'
TITLE = 'Energie electrică deconectată'
# Browserele primesc pagina; unele cereri fără User-Agent de browser sunt ținute la coadă de Cloudflare.
BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
TIMEOUT_S = 120
ATTEMPTS = 3
# Câte zile înainte importăm (calendarul are și luni întregi de istoric).
DAYS_AHEAD = 31
MAX_STREETS_SHOWN = 12

LINE = re.compile(
    r'^(?P<addr>.*?)[\s,]*în intervalul de timp între\s*(?P<t0>\d{1,2}[:.]\d{2})\s*[-–]\s*(?P<t1>\d{1,2}[:.]\d{2})\s*(?:pentru\s+(?P<reason>.*))?$',
    re.I,
)
# „or. Codru: str. …”, „com. Grătiești, Grătiești: str. …” (comună, sat)
LOCALITY = re.compile(r'(?:^|,\s*)((?:or|com|s|sat)\.\s*[^:,]+(?:,\s*[^:,.]+)?):\s*', re.I)
HOUSE_NO = re.compile(r'\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?(?:\s*-\s*\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?)?')
NAME_AND_NO = re.compile(r'^(.*?\D)\s+(' + HOUSE_NO.pattern + r')$')


def fetch(url: str) -> str:
    last: Exception | None = None
    for attempt in range(1, ATTEMPTS + 1):
        req = urllib.request.Request(url, headers={'User-Agent': BROWSER_UA, 'Accept-Language': 'ro'})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
                return res.read().decode('utf-8', errors='replace')
        except Exception as e:  # noqa: BLE001
            last = e
            print(f'  {url}: încercarea {attempt} eșuată ({e})', file=sys.stderr)
            time.sleep(5 * attempt)
    raise RuntimeError(f'{url}: {last}')


def calendar_days(page: str, today: date) -> list[tuple[date, str]]:
    """Zilele cu „Lucrări programate” din calendarul paginii, de azi până la DAYS_AHEAD."""
    m = re.search(r'data-drupal-selector="drupal-settings-json">(.*?)</script>', page, re.S)
    if not m:
        raise ValueError('lipsește drupal-settings-json')
    settings = json.loads(m.group(1))
    cals = list(settings.get('fullcalendar', {}).values())
    if not cals:
        raise ValueError('lipsește calendarul (fullcalendar)')
    days = []
    for e in cals[0]['fullcalendar']['_events']:
        if not ascii_fold(e.get('title', '')).startswith('lucrari programate'):
            continue
        d = date.fromisoformat(e['start'][:10])
        if today <= d <= today + timedelta(days=DAYS_AHEAD):
            days.append((d, BASE + e['url']))
    return sorted(set(days))


def parse_addresses(addr: str, heading_locality: str) -> tuple[list[tuple[str, str, list[str]]], bool]:
    """
    „str. Eugen Coca 59, Ion Neculce 10, 12/1, or. Codru: str. Aleea Verde” →
    [(localitate, stradă, [numere]), …] și dacă anunțul e „parțial”.
    """
    partial = 'partial' in ascii_fold(addr)
    addr = re.sub(r'\([^)]*\)', ' ', addr)
    addr = re.sub(r'\s*parțial\s*|\s*partial\s*', ' ', addr, flags=re.I)
    parts = LOCALITY.split(addr)
    # split cu grup: [text, loc1, text1, loc2, text2, …]
    segments = [(heading_locality, parts[0])] + [(locality_name(parts[i]), parts[i + 1]) for i in range(1, len(parts) - 1, 2)]
    streets: list[tuple[str, str, list[str]]] = []
    for locality, text in segments:
        text = re.sub(r'^\s*str\.\s*', '', clean(text))
        for tok in (t.strip(' .;') for t in text.split(',')):
            if not tok:
                continue
            if HOUSE_NO.fullmatch(tok) and streets:
                streets[-1][2].append(tok)
                continue
            m = NAME_AND_NO.match(tok)
            name, nums = (m.group(1).strip(), [m.group(2)]) if m else (tok, [])
            streets.append((locality, name, nums))
    return streets, partial


def locality_name(raw: str) -> str:
    """„com. Grătiești, Grătiești” → „Grătiești”, „or. Codru” → „Codru”."""
    return clean(re.sub(r'^\w+\.\s*', '', raw.split(',')[-1].strip()))


def street_label(locality: str, name: str, nums: list[str]) -> str:
    prefix = '' if re.search(r'\b(sos|str-la|s-la|st-la|bd|calea|al)\b', ascii_fold(name)) else 'Str. '
    s = f'{prefix}{name}' + (f' {", ".join(nums)}' if nums else '')
    return f'{locality}: {s}' if locality else s


def parse_day(page: str, day: date) -> tuple[list[Outage], list[str]]:
    out: list[Outage] = []
    warnings: list[str] = []
    posted = None
    pm = re.search(r'Postat de.*?la\s*<span>\s*\w+,\s*(\d{2})/(\d{2})/(\d{4})\s*-\s*(\d{1,2}):(\d{2})', page, re.S)
    if pm:
        mo, d, y, hh, mi = map(int, pm.groups())
        posted = datetime(y, mo, d, hh, mi)

    body = page[page.find('<ol>', page.find('node__meta')):]
    body = body[:body.find('</ol>')]
    for li in re.findall(r'<li>(.*?)</li>', body, re.S):
        lines = html_lines(li)
        if not lines:
            continue
        heading = lines[0].rstrip(':')
        h = [p.strip() for p in heading.split(',')]
        if not ascii_fold(h[0]).startswith(('chisinau', 'mun. chisinau')):
            continue
        sector = next((clean(re.sub(r'(?i)^sectorul\s+', '', p)) for p in h if ascii_fold(p).startswith('sectorul')), '')
        extra = next((p for p in h[1:] if not ascii_fold(p).startswith('sectorul')), '')
        heading_locality = clean(re.sub(r'^\w+\.\s*', '', extra)) if extra else ''
        district = f'{heading_locality} ({sector})' if heading_locality and sector else (sector or heading_locality)

        for line in lines[1:]:
            m = LINE.match(line)
            if not m:
                warnings.append(f'Premier {day}: rând necitit: {line[:120]}')
                continue
            streets, partial = parse_addresses(m.group('addr'), heading_locality)
            if not streets:
                warnings.append(f'Premier {day}: fără adrese: {line[:120]}')
                continue
            t0, t1 = (datetime.strptime(f'{day} {t.replace(".", ":")}', '%Y-%m-%d %H:%M') for t in (m.group('t0'), m.group('t1')))
            if t1 <= t0:
                t1 += timedelta(days=1)

            labels = [street_label(*s) for s in streets]
            shown = labels[:MAX_STREETS_SHOWN]
            if len(labels) > MAX_STREETS_SHOWN:
                shown.append(f'și încă {len(labels) - MAX_STREETS_SHOWN} străzi')
            reason = clean(m.group('reason') or '').rstrip('.')
            desc = [f'Lucrări programate{": " + reason if reason else ""}.']
            if partial:
                desc.append('Parțial: nu toți consumatorii de pe aceste adrese sunt afectați.')
            if len(labels) > MAX_STREETS_SHOWN:
                desc.append('Toate adresele: ' + ', '.join(labels))

            loc0, name0, nums0 = streets[0]
            queries = house_query(f'str. {name0}', nums0[0] if nums0 else '')
            locality = loc0 or heading_locality
            if locality and ascii_fold(locality) not in SECTORS:
                queries = [f'{q}, {locality}' for q in queries]

            out.append(Outage(
                id=f'ped-{day}-{stable_id(m.group("addr"), m.group("t0"), m.group("t1"))}',
                title=TITLE,
                severity='partial' if partial else 'total',
                district=fix_diacritics(district),
                streets=shown,
                start=t0,
                end=t1,
                updated=posted,
                description=' '.join(desc)[:900],
                geo_queries=queries,
                planned=True,
                subtype='electricitate',
                source=SOURCE,
            ))
    return out, warnings


def main() -> int:
    args = cli_args(__doc__)
    today = datetime.now(TZ).date()

    try:
        days = calendar_days(fetch(CALENDAR_URL), today)
    except Exception as e:  # noqa: BLE001
        # Fără calendar nu știm ce zile există: nu atingem Firestore, altfel am marca totul „rezolvat”.
        print(f'Calendarul Premier Energy nu a putut fi citit: {e}. Opresc sincronizarea.', file=sys.stderr)
        return 1
    print(f'Premier Energy: {len(days)} zile cu lucrări programate ({", ".join(str(d) for d, _ in days)}).')

    outages: list[Outage] = []
    failed: list[str] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = list(pool.map(lambda du: (du[0], _try_fetch(du[1])), days))
    for day, page in pages:
        if page is None:
            failed.append(f'ped-{day}-')
            print(f'::warning::Premier Energy: pagina zilei {day} nu s-a descărcat; evenimentele ei rămân neschimbate.')
            continue
        found, warnings = parse_day(page, day)
        for w in warnings:
            print(f'::warning::{w}')
        print(f'  {day}: {len(found)} rânduri în Chișinău')
        outages += found

    return publish(outages, args, SOURCE, tuple(failed))


def _try_fetch(url: str) -> str | None:
    try:
        return fetch(url)
    except Exception:  # noqa: BLE001
        return None


if __name__ == '__main__':
    sys.exit(main())
