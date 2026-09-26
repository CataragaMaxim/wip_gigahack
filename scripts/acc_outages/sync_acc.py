"""
Flux oficial: deconectările de apă de pe https://acc.md/disconnections → colecția Firestore `events`.

Rulează din GitHub Actions (.github/workflows/acc-outages.yml). Pașii:
  1. descarcă pagina și citește tab-urile „Sistări planificate”, „Sistări curente” și „Avarieri apeduct”;
  2. transformă fiecare anunț într-un `UrbanEvent` (vezi src/types/index.ts), cu id stabil (`acc-...`);
  3. geocodează adresa (Nominatim, max. 1 cerere/s; locația se refolosește din documentul existent);
  4. scrie în Firestore; anunțurile care au dispărut de pe site primesc `resolvedAt`;
  5. șterge evenimentele rezolvate de peste 24 h (cu voturile lor), ca aplicația să nu citească istoricul la fiecare deschidere.

„Avarieri canalizare” nu are un subtip în aplicație, iar avariile fără deconectare (scurgeri) nu sunt sistări — nu se importă.

Local, fără Firestore:
  python scripts/acc_outages/sync_acc.py --dry-run --out acc.json
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

URL = 'https://acc.md/disconnections'
SOURCE = 'Apă-Canal Chișinău'
# Toate anunțurile sunt de tipul „apă deconectată” (utilitati / apa); presiunea joasă → severity 'partial'.
TITLE = 'Apă deconectată'
# Evenimentele rezolvate se șterg după atât timp; anunțurile încheiate de atât timp nu se mai importă.
RETENTION = timedelta(hours=24)
TZ = ZoneInfo('Europe/Chisinau')
USER_AGENT = 'wip-gigahack-acc-sync/1.0 (+https://github.com/CataragaMaxim/wip_gigahack)'
# Pentru site-urile sursă (unele țin la coadă cererile fără User-Agent de browser); geocodarea se identifică cu USER_AGENT.
BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
NOMINATIM = 'https://nominatim.openstreetmap.org/search'
# lng_min, lat_max, lng_max, lat_min — municipiul Chișinău, ca în src/services/geocoding.ts.
CHISINAU_VIEWBOX = '28.68,47.12,29.02,46.90'

PHOTON = 'https://photon.komoot.io/api/'
# lon_min, lat_min, lon_max, lat_max (aceeași zonă ca CHISINAU_VIEWBOX).
CHISINAU_BBOX = '28.68,46.90,29.02,47.12'
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', 'work-in-progress-d4ff1')

TAB_PLANNED, TAB_CURRENT, TAB_WATER = '1', '2', '3'
SECTORS = {'botanica', 'buiucani', 'centru', 'ciocana', 'riscani'}

MONTHS = {m: i + 1 for i, m in enumerate(
    ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
     'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'])}

STREET_PREFIXES = {
    'str': 'Str.', 'strada': 'Str.', 'bd': 'Bd.', 'b-dul': 'Bd.', 'bulevardul': 'Bd.',
    'sos': 'Șos.', 'soseaua': 'Șos.', 'str-la': 'Str-la', 'stradela': 'Str-la',
    'pl': 'Piața', 'piata': 'Piața', 'calea': 'Calea',
}
# O linie de adresă din anunțurile planificate începe cu unul dintre aceste cuvinte.
ADDRESS_START = re.compile(r'^(str|strada|bd|b-dul|bulevardul|sos|soseaua|str-la|stradela|calea|piata|pl|comuna|com|s|or|satul|orasul)\b\.?', re.I)
# Separă „str. A 1, 2, bd. B 3” în două adrese.
ADDRESS_SPLIT = re.compile(r',\s*(?=(?:str|bd|b-dul|sos|str-la|calea|comuna|s|or)\.?\s)', re.I)


def _install_https_certificates() -> None:
    """Certificatele din `certifi` pentru toate cererile HTTPS: Python de pe python.org (macOS) nu are
    certificate de sistem și altfel pică cu CERTIFICATE_VERIFY_FAILED."""
    try:
        import certifi
    except ImportError:
        return
    ctx = ssl.create_default_context(cafile=certifi.where())
    urllib.request.install_opener(urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx)))


_install_https_certificates()


# ---------- text ----------

def fix_diacritics(s: str) -> str:
    """Sedilele (ş, ţ) → virgulele corecte (ș, ț)."""
    return s.translate(str.maketrans('şţŞŢ', 'șțȘȚ'))


def ascii_fold(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


def clean(s: str) -> str:
    s = html.unescape(s).replace('\xa0', ' ')
    return fix_diacritics(re.sub(r'\s+', ' ', s)).strip()


def format_street(raw: str) -> str:
    """„şos Munceşti” → „Șos. Muncești”, „str. Vl. Korolenko” → „Str. Vl. Korolenko”."""
    s = clean(raw)
    m = re.match(r'^([\w-]+)\.?\s+(.*)$', s)
    if m and ascii_fold(m.group(1)) in STREET_PREFIXES:
        prefix = STREET_PREFIXES[ascii_fold(m.group(1))]
        rest = m.group(2)
        if prefix == 'Str.' and ascii_fold(rest).startswith('calea '):
            return rest
        return f'{prefix} {rest}'
    return s


def local_iso(dt: datetime) -> str:
    return dt.replace(tzinfo=TZ).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def parse_dmy_hm(s: str) -> datetime | None:
    """„26.09.2026 11:35” sau „25.09.26 13:18” (ora Chișinăului)."""
    m = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?', s)
    if not m:
        return None
    d, mo, y, hh, mm = m.groups()
    y = int(y) + (2000 if len(y) == 2 else 0)
    return datetime(y, int(mo), int(d), int(hh or 0), int(mm or 0))


def stable_id(*parts: str) -> str:
    return hashlib.sha1('|'.join(parts).encode()).hexdigest()[:12]


# ---------- HTML ----------

class TextExtractor(HTMLParser):
    """HTML → text, cu rânduri noi la <p>, <br>, <div>."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'p', 'div', 'li', 'tr'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('p', 'div', 'li', 'tr'):
            self.parts.append('\n')

    def handle_data(self, data):
        self.parts.append(data)

    def lines(self) -> list[str]:
        text = ''.join(self.parts)
        return [c for c in (clean(l) for l in text.split('\n')) if c]


def html_lines(fragment: str) -> list[str]:
    p = TextExtractor()
    p.feed(fragment)
    p.close()
    return p.lines()


@dataclass
class TableRow:
    district: str
    cells: list[str]


class TableExtractor(HTMLParser):
    """Rândurile tabelului `table.avarieri`, cu sectorul din rândul `sector_title` precedent."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[TableRow] = []
        self.district = ''
        self._row_class: str | None = None
        self._cells: list[str] | None = None
        self._cell: list[str] | None = None
        self._in_tbody = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'tbody':
            self._in_tbody = True
        elif tag == 'tr' and self._in_tbody:
            self._row_class = a.get('class') or ''
            self._cells = []
        elif tag == 'td' and self._cells is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag == 'tbody':
            self._in_tbody = False
        elif tag == 'td' and self._cell is not None and self._cells is not None:
            self._cells.append(clean(''.join(self._cell)))
            self._cell = None
        elif tag == 'tr' and self._cells is not None:
            if self._row_class == 'sector_title':
                self.district = self._cells[0] if self._cells else ''
            elif len(self._cells) > 3 and self._cells[1].isdigit():
                self.rows.append(TableRow(self.district, self._cells))
            self._cells = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def split_sections(page: str) -> dict[str, str]:
    parts = re.split(r'<section id="descriptionDisconnection" data-id="(\d)"', page)
    return {parts[i]: parts[i + 1].split('</section>')[0] for i in range(1, len(parts), 2)}


def situation_time(section: str) -> datetime | None:
    m = re.search(r'situa\S*\s+la\s+([\d.]+\s+[\d:]+)', section)
    return parse_dmy_hm(m.group(1)) if m else None


# ---------- anunțuri → evenimente ----------

@dataclass
class Outage:
    id: str
    title: str
    severity: str
    district: str
    streets: list[str]
    start: datetime | None
    end: datetime | None
    updated: datetime | None
    description: str
    # Adresele afectate: [(etichetă, variante de căutare)], câte una pe număr de casă (prima = adresa principală).
    geo_targets: list[tuple[str, list[str]]] = field(default_factory=list)
    # Din „Sistări planificate” (afișate și în calendarul aplicației).
    planned: bool = False
    subtype: str = 'apa'
    source: str = SOURCE

    def to_event(self) -> dict:
        """Forma `UrbanEvent` (fără `location`, adăugată după geocodare)."""
        return {
            'id': self.id,
            'category': 'utilitati',
            'subtype': self.subtype,
            'title': self.title,
            'sourceType': 'official',
            'source': self.source,
            'feed': 'live',
            'severity': self.severity,
            'district': self.district,
            'streets': self.streets,
            'startAt': local_iso(self.start) if self.start else None,
            'endAt': local_iso(self.end) if self.end else None,
            'updatedAt': local_iso(self.updated) if self.updated else None,
            'description': self.description or None,
            'planned': self.planned,
        }


def is_low_pressure(text: str) -> bool:
    return 'presiune joasa' in ascii_fold(text) or 'pres.joasa' in ascii_fold(text)


def house_query(street: str, number: str) -> list[str]:
    """Variante de căutare, de la cea mai precisă: „str. X 12” → „X 12” → „X”."""
    name = re.sub(r'^([\w-]+)\.?\s+', lambda m: '' if ascii_fold(m.group(1)) in STREET_PREFIXES else m.group(0), clean(street))
    bare = re.sub(r'^(?:[A-ZĂÂÎȘȚ][a-zăâîșț]{0,3}\.\s*)+', '', name)  # „Vl. Korolenko” → „Korolenko”
    num = re.match(r'^\d+[a-zA-Z]?(?:/\d+)?', number.strip())
    qs = []
    if num:
        qs += [f'{name} {num.group(0)}', f'{bare} {num.group(0)}']
    qs += [name, bare]
    return list(dict.fromkeys(q for q in qs if q))


def parse_tables(sections: dict[str, str]) -> list[Outage]:
    """„Sistări curente” + rândurile cu deconectare din „Avarieri apeduct”, unite după numărul fișei."""
    by_ticket: dict[str, Outage] = {}
    faults: dict[str, str] = {}

    water = sections.get(TAB_WATER, '')
    wt = TableExtractor()
    wt.feed(water)
    # Coloane: stare, fișă, stradă, nr, avariere, depistat, străzi afectate, deconectat, reconectare, cisternă, evacuare.
    for r in wt.rows:
        c = r.cells + [''] * (11 - len(r.cells))
        faults[c[1]] = c[4]
        if parse_dmy_hm(c[7]):
            by_ticket[c[1]] = table_outage(r.district, c[1], c[2], c[3], c[4], c[6], c[7], c[8], c[9], situation_time(water))

    current = sections.get(TAB_CURRENT, '')
    ct = TableExtractor()
    ct.feed(current)
    # Coloane: stare, fișă, stradă, nr, diametru, străzi afectate, deconectat, reconectare, cisternă.
    for r in ct.rows:
        c = r.cells + [''] * (9 - len(r.cells))
        by_ticket[c[1]] = table_outage(r.district, c[1], c[2], c[3], faults.get(c[1], ''), c[5], c[6], c[7], c[8], situation_time(current))
    return list(by_ticket.values())


def table_outage(district, ticket, street, number, fault, affected, off, on, tank, updated) -> Outage:
    low = is_low_pressure(affected)
    num = re.match(r'^\d+[a-zA-Z]?(?:/\d+)?', number.strip())
    address = format_street(street) + (f' {num.group(0)}' if num else '')
    desc = [f'Sistare neplanificată — avarie: {fault}.' if fault else 'Sistare neplanificată (avarie).', f'Fișa nr. {ticket}.']
    if low:
        desc.insert(1, 'Apă cu presiune joasă.')
    if affected:
        desc.append(f'Afectați: {affected}.')
    if tank:
        desc.append(f'Cisterna: {tank}.')
    desc.append('Ora reconectării este estimativă.')
    # Suburbie (ex. „Cruzești (Ciocana)”): căutăm în localitate, nu pe o stradă omonimă din oraș.
    locality = re.sub(r'\s*\(.*$', '', fix_diacritics(district))
    targets = [t for st, nr in [(street, number), *affected_addresses(affected, street)] for t in point_targets(st, nr, locality)]
    return Outage(
        id=f'acc-{ticket}',
        title=TITLE,
        severity='partial' if low else 'total',
        district=fix_diacritics(district),
        streets=[address],
        start=parse_dmy_hm(off),
        end=parse_dmy_hm(on),
        updated=updated,
        description=' '.join(desc),
        geo_targets=targets,
    )


def affected_addresses(affected: str, main_street: str) -> list[tuple[str, str]]:
    """
    Coloana „Străzi afectate”: „Lupu, Cornului 24, Ghioceilor 1-3,Vovinteni”, „Grenoble 161/...,163/...”.
    Păstrăm doar intrările cu număr (stradă + casă); numele de sectoare sau „Toti Cu Apa” ar lărgi zona fără sens.
    """
    out: list[tuple[str, str]] = []
    prev = re.sub(r'^\S+\.?\s+', '', clean(main_street))
    for tok in (t.strip(' .') for t in re.split(r'[;,]', affected)):
        if not tok:
            continue
        if re.match(r'^\d', tok):
            out.append((prev, tok))
            continue
        m = re.match(r'^(.*?\D)\s+(\d.*)$', tok)
        if m:
            prev = m.group(1).strip()
            out.append((prev, m.group(2)))
    return out


DATE_WORDS = re.compile(r'(\d{1,2})\s+(' + '|'.join(MONTHS) + r')\b(?:\s*,?\s*(\d{4}))?')
DATE_NUM = re.compile(r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b')
TIME = re.compile(r'\b(\d{1,2}):(\d{2})\b')


def parse_interval(text: str, fallback_year: int) -> tuple[datetime | None, datetime | None]:
    """
    Prima dată + prima oră → început, ultima dată + ultima oră → sfârșit. Acoperă formele de pe site:
    „În intervalul 09:00 – 21:00, Joi, 1 Octombrie 2026”,
    „Luni, de la ora 09:00, data de 28 Septembrie 2026 pînă la Marți la ora 15:00 data de 29 Septembrie 2026”,
    „Luni, 28 septembrie, 2026 și Marți, 29 septembrie în intervalul 9:00– 21:00”.
    """
    t = ascii_fold(text)
    dates: list[tuple[int, int, int | None]] = []
    for m in sorted([*DATE_WORDS.finditer(t), *DATE_NUM.finditer(t)], key=lambda m: m.start()):
        d, mo, y = m.groups()
        mo_n = MONTHS[mo] if mo in MONTHS else int(mo)
        dates.append((int(d), mo_n, int(y) if y else None))
    times = [(int(h), int(mi)) for h, mi in TIME.findall(DATE_NUM.sub(' ', t))]
    if not dates:
        return None, None
    year = next((y for _, _, y in dates if y), fallback_year)
    try:
        (d0, m0, y0), (d1, m1, y1) = dates[0], dates[-1]
        h0, mi0 = times[0] if times else (0, 0)
        h1, mi1 = times[-1] if len(times) > 1 else (23, 59)
        start = datetime(y0 or year, m0, d0, h0, mi0)
        end = datetime(y1 or year, m1, d1, h1, mi1)
    except ValueError:
        return None, None
    if end <= start:
        end += timedelta(days=1)
    return start, end


def parse_planned(sections: dict[str, str]) -> tuple[list[Outage], list[str]]:
    body = sections.get(TAB_PLANNED, '')
    chunks = re.split(r'<div class="row" style="border-bottom', body)[1:]
    out: list[Outage] = []
    warnings: list[str] = []
    for chunk in chunks:
        lines = html_lines('<div' + chunk)
        lines = [l for l in lines if not l.startswith(':')]  # restul atributului `style` tăiat de split
        if not lines:
            continue
        posted = parse_dmy_hm(lines[0])
        rest = lines[1:] if posted else lines
        text = ' '.join(rest).split('Ne cerem scuze')[0]
        addresses: list[str] = []
        for l in rest:
            if ADDRESS_START.match(ascii_fold(l)):
                addresses += [a.strip(' ,;') for a in ADDRESS_SPLIT.split(l) if a.strip(' ,;.')]
        start, end = parse_interval(text, (posted or datetime.now(TZ)).year)
        if not start or not addresses:
            warnings.append(f'Anunț planificat necitit ({lines[0][:40]}…): {text[:120]}')
            continue
        low = is_low_pressure(text)
        intro = ' '.join(l for l in rest if not ADDRESS_START.match(ascii_fold(l)) and 'Ne cerem scuze' not in l)
        split = [re.match(r'^(.*?)\s+(\d.*)$', a) for a in addresses]
        pairs = [(m.group(1), m.group(2)) if m else (a, '') for a, m in zip(addresses, split)]
        out.append(Outage(
            id=f'acc-plan-{stable_id(lines[0], *addresses)}',
            title=TITLE,
            severity='partial' if low else 'total',
            district='',
            streets=[format_street(a) for a in addresses],
            start=start,
            end=end,
            updated=posted,
            description=('Sistare planificată. ' + ('Apă cu presiune joasă. ' if low else '') + intro)[:500],
            geo_targets=[t for st, nr in pairs for t in point_targets(st, nr)],
            planned=True,
        ))
    return out, warnings


# ---------- geocodare ----------

_last_request: dict[str, float] = {}


def _get_json(service: str, url: str) -> object | None:
    """GET cu max. 1 cerere/s per serviciu (politica Nominatim)."""
    wait = 1.1 - (time.monotonic() - _last_request.get(service, 0.0))
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Language': 'ro'})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.load(res)
    except Exception as e:  # noqa: BLE001 — geocodarea nu oprește sincronizarea
        print(f'  {service}: {e}', file=sys.stderr)
        return None
    finally:
        _last_request[service] = time.monotonic()


def _nominatim(q: str) -> dict | None:
    params = urllib.parse.urlencode({
        'q': f'{q}, Chișinău', 'format': 'jsonv2', 'addressdetails': '1', 'limit': '1',
        'countrycodes': 'md', 'viewbox': CHISINAU_VIEWBOX, 'bounded': '1', 'accept-language': 'ro',
    })
    items = _get_json('nominatim', f'{NOMINATIM}?{params}')
    if not items:
        return None
    it = items[0]  # type: ignore[index]
    a = it.get('address', {})
    bb = it.get('boundingbox')  # [lat_min, lat_max, lng_min, lng_max]
    return {
        'lat': float(it['lat']), 'lng': float(it['lon']),
        'district': re.sub(r'^Sectorul\s+', '', a.get('city_district') or a.get('suburb') or ''),
        'bbox': [float(bb[0]), float(bb[2]), float(bb[1]), float(bb[3])] if bb else None,
    }


def _photon(q: str) -> dict | None:
    """Rezervă (tot OpenStreetMap, altă infrastructură), dacă Nominatim refuză IP-urile runner-ului."""
    params = urllib.parse.urlencode({'q': f'{q}, Chișinău', 'bbox': CHISINAU_BBOX, 'limit': '1'})
    data = _get_json('photon', f'{PHOTON}?{params}')
    feats = (data or {}).get('features') or []  # type: ignore[union-attr]
    if not feats:
        return None
    lng, lat = feats[0]['geometry']['coordinates']
    p = feats[0].get('properties', {})
    # Photon caută „aproximativ”: acceptăm rezultatul doar dacă numele străzii din căutare apare în el.
    words = [w for w in re.findall(r'[a-z]{4,}', ascii_fold(q.split(',')[0]))]
    found_name = ascii_fold(' '.join(str(p.get(k) or '') for k in ('name', 'street')))
    if words and not any(w in found_name for w in words):
        return None
    ext = p.get('extent')  # [lng_min, lat_max, lng_max, lat_min]
    return {
        'lat': float(lat), 'lng': float(lng),
        'district': re.sub(r'^Sectorul\s+', '', p.get('district') or p.get('locality') or ''),
        'bbox': [float(ext[3]), float(ext[0]), float(ext[1]), float(ext[2])] if ext else None,
    }


def has_house_number(q: str) -> bool:
    """„Ion Neculce 10” → da, „Ion Neculce” / „Ion Neculce, Codru” → nu."""
    return bool(re.search(r'\s\d+\S*$', q.split(',')[0].strip()))


def geocode(queries: list[str]) -> dict | None:
    """
    Prima variantă găsită în Chișinău → {lat, lng, district, bbox}. Nominatim, apoi Photon.
    `bbox` [lat_min, lng_min, lat_max, lng_max] se păstrează doar când s-a găsit strada întreagă (fără număr):
    atunci toată strada e afectată și intră în zona evenimentului.
    """
    for lookup in (_nominatim, _photon):
        for q in queries:
            found = lookup(q)
            if found:
                found['exact'] = has_house_number(q)
                if found['exact']:
                    found['bbox'] = None
                return found
    return None


class GeoCache:
    """
    Rezultatele geocodării, păstrate între rulări într-un fișier JSON (în GitHub Actions: actions/cache),
    ca fiecare adresă să fie căutată o singură dată. Adresele negăsite se reîncearcă după MISS_RETRY.
    `budget` limitează căutările noi pe rulare; restul se fac la rulările următoare.
    """

    MISS_RETRY = timedelta(days=7)
    PENDING = {'pending': True}

    def __init__(self, path: str, budget: int) -> None:
        self.path = path
        self.budget = budget
        self.looked_up = 0
        self.pending = 0
        try:
            with open(path, encoding='utf-8') as f:
                self.data: dict[str, dict] = json.load(f)
        except (OSError, ValueError):
            self.data = {}

    def get(self, queries: list[str]) -> dict | None:
        key = ascii_fold(queries[0])
        hit = self.data.get(key)
        if hit and (not hit.get('miss') or datetime.now(timezone.utc) - datetime.fromisoformat(hit['at']) < self.MISS_RETRY):
            if not hit.get('miss') and 'exact' not in hit:
                # Intrări salvate înainte de câmpul `exact`: prima variantă (cu număr) era încercată prima.
                hit['exact'] = has_house_number(queries[0])
            return None if hit.get('miss') else hit
        if self.looked_up >= self.budget:
            self.pending += 1
            return self.PENDING
        self.looked_up += 1
        found = geocode(queries)
        now = datetime.now(timezone.utc).isoformat()
        self.data[key] = {**found, 'at': now} if found else {'miss': True, 'at': now}
        return found

    def save(self) -> None:
        os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
        with open(self.path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False)


def _meters(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distanța haversine (m) între (lat, lng)."""
    import math
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


# Zona fiecărei adrese: mică, ca zonele să nu se suprapună. Casă găsită exact → 25 m; doar strada → 55 m.
AREA_HOUSE_M = 25
AREA_STREET_M = 55
AREA_MAX_M = 55
# Două zone mai apropiate de atât sunt același loc și se unesc.
SAME_SPOT_M = 15
# Două zone care nu pot fi unite se micșorează dacă centrele lor sunt mai apropiate de 80% din suma razelor.
MAX_OVERLAP = 0.8
# O adresă la peste atât de mediana celorlalte e, cel mai probabil, o stradă omonimă găsită greșit.
OUTLIER_M = 3000


def build_areas(found: list[tuple[str, dict]]) -> list[dict]:
    """
    [(etichetă, rezultat geocodare), …] → zonele afectate [{lat, lng, radiusM, label}], câte una pe adresă.
    Adresele vecine se unesc într-o zonă comună, ca cercurile să nu se suprapună; nicio zonă nu depășește AREA_MAX_M —
    o adresă care ar depăși-o formează o zonă nouă.
    """
    import statistics
    if not found:
        return []
    mlat = statistics.median(f['lat'] for _, f in found)
    mlng = statistics.median(f['lng'] for _, f in found)
    kept = [(l, f) for l, f in found if _meters((f['lat'], f['lng']), (mlat, mlng)) <= OUTLIER_M] or found[:1]

    # Grupare aglomerativă: pornim cu un cerc pe adresă și unim mereu perechea al cărei cerc comun e cel mai mic,
    # cât timp rămâne ≤ AREA_MAX_M. Adresele care nu mai încap rămân (sau încep) un grup separat.
    def circle(members: list[tuple[tuple[float, float], int]]) -> tuple[tuple[float, float], float]:
        center = (sum(m[0][0] for m in members) / len(members), sum(m[0][1] for m in members) / len(members))
        return center, max(_meters(center, m[0]) + m[1] for m in members)

    clusters: list[dict] = []
    for label, f in kept:
        base = AREA_HOUSE_M if f.get('exact') else AREA_STREET_M
        clusters.append({'members': [((f['lat'], f['lng']), base)], 'labels': [label]})
    while len(clusters) > 1:
        best = None
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                ci, cj = circle(clusters[i]['members'])[0], circle(clusters[j]['members'])[0]
                if _meters(ci, cj) > 2 * AREA_MAX_M:
                    continue  # prea departe ca să încapă în același cerc
                _, r = circle(clusters[i]['members'] + clusters[j]['members'])
                if r <= AREA_MAX_M and (best is None or r < best[0]):
                    best = (r, i, j)
        if not best:
            break
        _, i, j = best
        clusters[i] = {'members': clusters[i]['members'] + clusters[j]['members'],
                       'labels': clusters[i]['labels'] + [l for l in clusters[j]['labels'] if l not in clusters[i]['labels']]}
        del clusters[j]
    for c in clusters:
        (c['lat'], c['lng']), c['r'] = circle(c['members'])
    # Zonele care nu pot fi unite (ar depăși AREA_MAX_M) dar se acoperă mult — ex. stradele întregi vecine,
    # fiecare de 55 m — se micșorează până la distanța dintre centre (minim AREA_HOUSE_M): se ating, nu se acoperă.
    i = 0
    while i < len(clusters):
        a = clusters[i]
        j = i + 1
        while j < len(clusters):
            b = clusters[j]
            d = _meters((a['lat'], a['lng']), (b['lat'], b['lng']))
            if d < SAME_SPOT_M:
                # Practic același loc: o singură zonă (tot ≤ AREA_MAX_M), cu ambele adrese.
                a['r'] = min(AREA_MAX_M, max(a['r'], b['r']))
                a['labels'] += [l for l in b['labels'] if l not in a['labels']]
                del clusters[j]
                continue
            if d < MAX_OVERLAP * (a['r'] + b['r']):
                a['r'] = b['r'] = max(AREA_HOUSE_M, min(a['r'], b['r'], d / 2 + 5))
            j += 1
        i += 1
    return [{
        'lat': round(c['lat'], 7), 'lng': round(c['lng'], 7),
        'radiusM': int(round(min(AREA_MAX_M, max(AREA_HOUSE_M, c['r'])))),
        'label': merge_labels(c['labels']),
    } for c in clusters]


def merge_labels(labels: list[str]) -> str:
    """„Str. Ion Neculce 10”, „Str. Ion Neculce 12” → „Str. Ion Neculce 10, 12”."""
    out: list[tuple[str, list[str]]] = []
    key = lambda st: ascii_fold(re.sub(r'^[\w-]+\.\s*', '', st))  # „Str. Alba-Iulia” = „Alba-Iulia”
    for l in labels:
        m = re.match(r'^(.*?)\s+(\d\S*)$', l)
        street, num = (m.group(1), m.group(2)) if m else (l, '')
        for s_, nums in out:
            if key(s_) == key(street):
                if num and num not in nums:
                    nums.append(num)
                break
        else:
            out.append((street, [num] if num else []))
    return '; '.join(f'{s_} {", ".join(n)}' if n else s_ for s_, n in out)


HOUSE_NO_RE = re.compile(r'\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?')


def house_numbers(raw: str) -> list[str]:
    """„10, 12/1, 5-9, 189/...-203/..” → [10, 12/1, 5, 9, 189, 203] (intervalele: capetele)."""
    out: list[str] = []
    for tok in re.split(r'[,;]', raw):
        found = HOUSE_NO_RE.findall(tok)
        if not found:
            continue
        picks = [found[0], found[-1]] if '-' in tok and len(found) > 1 else found[:1]
        for n in picks:
            n = re.sub(r'/$', '', n)
            if n not in out:
                out.append(n)
    return out


def point_targets(street: str, numbers: str | list[str], locality: str = '', label_street: str | None = None) -> list[tuple[str, list[str]]]:
    """
    O stradă cu numerele ei → câte o țintă de geocodare pe număr: [(etichetă, variante de căutare)].
    Fără numere → o singură țintă pentru stradă. Suburbiile se caută în localitatea lor.
    """
    if re.search(r'/|\btraseu\b', ascii_fold(street)):
        return []  # cod de conductă (ex. „San/Traseu Tr1”), nu o adresă
    nums = house_numbers(', '.join(numbers) if isinstance(numbers, list) else numbers)
    label_street = label_street or format_street(street)
    suffix = f', {locality}' if locality and ascii_fold(locality) not in SECTORS else ''
    if not nums:
        return [(label_street, [q + suffix for q in house_query(street, '')])]
    return [(f'{label_street} {n}', [q + suffix for q in house_query(street, n)]) for n in nums]


# ---------- Firestore ----------

_db = None


def firestore_client():
    global _db
    if _db is None:
        import firebase_admin
        from firebase_admin import credentials, firestore

        raw = (os.environ.get('FIREBASE_SERVICE_ACCOUNT') or '').strip()
        if os.environ.get('FIRESTORE_EMULATOR_HOST') and not raw:
            # Emulatorul local nu cere credențiale.
            from google.auth.credentials import AnonymousCredentials
            from google.cloud import firestore as gcf
            _db = gcf.Client(project=FIREBASE_PROJECT_ID, credentials=AnonymousCredentials())
            return _db
        if not raw and not os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
            raise SystemExit(
                'Lipsește FIREBASE_SERVICE_ACCOUNT: JSON-ul (sau calea spre fișierul JSON) unui cont de serviciu Firebase.\n'
                'Firebase Console → Project settings → Service accounts → Generate new private key; în GitHub: '
                'Settings → Secrets and variables → Actions → FIREBASE_SERVICE_ACCOUNT.\n'
                'Config-ul web (VITE_FIREBASE_API_KEY etc.) NU poate scrie în Firestore.')
        if raw.startswith('{'):
            info = json.loads(raw)
        elif raw:
            with open(raw, encoding='utf-8') as f:
                info = json.load(f)
        else:
            info = None
        if info and info.get('type') != 'service_account':
            raise SystemExit('FIREBASE_SERVICE_ACCOUNT nu e o cheie de cont de serviciu (lipsește "type": "service_account").')
        if info and info.get('project_id') != FIREBASE_PROJECT_ID:
            print(f'::warning::Cheia e pentru proiectul „{info.get("project_id")}”, aplicația folosește „{FIREBASE_PROJECT_ID}”.')
        cred = credentials.Certificate(info) if info else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db


def sync_firestore(events: list[dict], source: str = SOURCE, keep_prefixes: tuple[str, ...] = ()) -> None:
    """Scrie evenimentele sursei; cele care lipsesc sunt rezolvate, cu excepția id-urilor cu `keep_prefixes`
    (ex. zilele a căror pagină nu s-a putut descărca)."""
    from google.cloud.firestore import GeoPoint, SERVER_TIMESTAMP
    from google.cloud.firestore_v1.base_query import FieldFilter

    def ts(iso: str | None):
        return datetime.fromisoformat(iso.replace('Z', '+00:00')) if iso else None

    db = firestore_client()
    col = db.collection('events')
    batch = db.batch()
    live_ids = set()
    created = updated = resolved = 0

    for e in events:
        live_ids.add(e['id'])
        ref = col.document(e['id'])
        doc = {
            **{k: v for k, v in e.items() if k not in ('id', 'location')},
            'startAt': ts(e['startAt']), 'endAt': ts(e['endAt']), 'updatedAt': ts(e['updatedAt']),
            'location': GeoPoint(e['location']['lat'], e['location']['lng']),
            'geohash': e['geohash'],
            'resolvedAt': None, 'path': None,
        }
        if doc.pop('_exists'):
            batch.update(ref, doc)
            updated += 1
        else:
            batch.set(ref, {**doc, 'confirmations': 0, 'denials': 0, 'photo': False,
                            'authorId': None, 'reportedAt': None, 'createdAt': SERVER_TIMESTAMP})
            created += 1

    # Toate evenimentele fluxului (doar egalități → fără index compus); colecția rămâne mică datorită ștergerii.
    feed_docs = (col.where(filter=FieldFilter('source', '==', source))
                 .where(filter=FieldFilter('feed', '==', 'live'))
                 .stream())
    cutoff = datetime.now(timezone.utc) - RETENTION
    to_delete = []
    for d in feed_docs:
        if d.id in live_ids or d.id.startswith(keep_prefixes or ('\0',)):
            continue
        resolved_at = d.get('resolvedAt')
        if resolved_at is None:
            # Nu mai e pe site: reconectat sau retras.
            batch.update(d.reference, {'resolvedAt': SERVER_TIMESTAMP})
            resolved += 1
        elif resolved_at < cutoff:
            to_delete.append(d.reference)

    batch.commit()
    summary(f'Firestore ({source}): {created} noi, {updated} actualizate, {resolved} rezolvate, {len(to_delete)} de șters.')
    # recursive_delete șterge și subcolecția `votes`, altfel voturile ar rămâne orfane.
    for ref in to_delete:
        db.recursive_delete(ref)


def existing_locations(ids: list[str]) -> dict[str, dict]:
    """Zona (centru, rază) și sectorul din documentele existente — rezervă când geocodarea nu are rezultate."""
    db = firestore_client()
    refs = [db.collection('events').document(i) for i in ids]
    out = {}
    for snap in db.get_all(refs):
        if snap.exists:
            d = snap.to_dict()
            loc = d.get('location')
            out[snap.id] = {
                'radiusM': d.get('radiusM'),
                'areas': d.get('areas'),
                'location': {'lat': loc.latitude, 'lng': loc.longitude} if loc else None,
                'district': d.get('district') or '',
            }
    return out


# ---------- main ----------

def fetch_page() -> str:
    last: Exception | None = None
    for attempt in range(1, 4):
        req = urllib.request.Request(URL, headers={'User-Agent': BROWSER_UA, 'Accept-Language': 'ro'})
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return res.read().decode('utf-8', errors='replace')
        except Exception as e:  # noqa: BLE001
            last = e
            print(f'  {URL}: încercarea {attempt} eșuată ({e})', file=sys.stderr)
            time.sleep(5 * attempt)
    raise RuntimeError(f'{URL}: {last}')


def main() -> int:
    args = cli_args(__doc__, 'citește pagina dintr-un fișier local în loc de acc.md')

    page = open(args.html, encoding='utf-8').read() if args.html else fetch_page()
    sections = split_sections(page)
    missing = [t for t in (TAB_PLANNED, TAB_CURRENT, TAB_WATER) if t not in sections]
    if missing or 'table class="avarieri"' not in page:
        # Structura s-a schimbat: nu atingem Firestore, altfel am marca totul „rezolvat”.
        print(f'Structura paginii s-a schimbat (lipsesc tab-urile {missing}). Opresc sincronizarea.', file=sys.stderr)
        return 1

    outages = parse_tables(sections)
    planned, warnings = parse_planned(sections)
    outages += planned
    # Anunțurile încheiate de peste 24 h (ex. cele planificate, care rămân listate pe site) nu se mai importă:
    # astfel sunt rezolvate și apoi șterse ca oricare altele.
    now_local = datetime.now(TZ).replace(tzinfo=None)
    outages = [o for o in outages if not (o.end and o.end < now_local - RETENTION)]
    for w in warnings:
        print(f'::warning::{w}')
    print(f'ACC: {len(outages) - len(planned)} sistări curente, {len(planned)} planificate.')

    return publish(outages, args, SOURCE)


def publish(outages: list[Outage], args: argparse.Namespace, source: str, keep_prefixes: tuple[str, ...] = (),
            geo_budget: int = 300) -> int:
    """Geocodarea fiecărei adrese (cu cache) → zonele afectate (câte una pe adresă) → JSON opțional → Firestore."""
    known = {} if args.dry_run else existing_locations([o.id for o in outages])
    cache = GeoCache(os.environ.get('GEOCACHE_PATH', '.geocache/geocache.json'), geo_budget)
    # Întâi adresa principală a fiecărui anunț (ca toate să apară pe hartă din prima rulare), apoi celelalte.
    found_by: dict[str, list[tuple[str, dict]]] = {o.id: [] for o in outages}
    deferred: set[str] = set()
    asked: set[tuple[str, str]] = set()
    if not args.no_geocode:
        for targets_of in (lambda o: o.geo_targets[:1], lambda o: o.geo_targets[1:]):
            for o in outages:
                for label, queries in targets_of(o):
                    if (o.id, ascii_fold(queries[0])) in asked:
                        continue  # aceeași adresă de două ori în același anunț
                    asked.add((o.id, ascii_fold(queries[0])))
                    r = cache.get(queries)
                    if r is GeoCache.PENDING:
                        deferred.add(o.id)
                    elif r:
                        found_by[o.id].append((label, r))

    events: list[dict] = []
    for o in outages:
        e = o.to_event()
        prev = known.get(o.id)
        found = found_by[o.id]
        if found:
            areas = build_areas(found)
            district = next((f['district'] for _, f in found if f.get('district')), '')
        elif prev and prev['location'] and o.id in deferred:
            # Căutările au fost amânate (buget terminat / cache pierdut): păstrăm zonele calculate anterior.
            # O adresă negăsită sau invalidă nu primește locația veche.
            areas, district = prev['areas'] or [{**prev['location'], 'radiusM': prev['radiusM'], 'label': o.streets[0]}], prev['district']
        elif args.no_geocode:
            areas, district = [], ''
        elif o.id in deferred:
            print(f'Amânat (bugetul de geocodare s-a terminat): {o.id}')
            continue
        else:
            print(f'::warning::Adresă negăsită, anunț omis: {o.id} {o.streets[0]}')
            continue
        e['district'] = e['district'] or district
        # Zonele pe adrese; `location`/`radiusM` = prima zonă (compatibil cu clienții vechi).
        e['areas'] = areas
        loc = {'lat': areas[0]['lat'], 'lng': areas[0]['lng']} if areas else None
        e['location'] = loc
        e['radiusM'] = areas[0]['radiusM'] if areas else None
        e['_exists'] = o.id in known
        if loc:
            e['geohash'] = encode_geohash(loc['lat'], loc['lng'])
        events.append(e)
    if not args.no_geocode:
        cache.save()

    skipped = len(outages) - len(events)
    summary(f'**{source}**: {len(outages)} anunțuri citite, {len(events)} localizate, {skipped} omise (adresă negăsită). '
            f'Geocodare: {cache.looked_up} căutări noi, {cache.pending} amânate pentru rularea următoare.')
    if outages and not events:
        # Nimic localizat = geocodarea nu merge (ex. serviciu blocat), nu „nicio deconectare”: nu scriem nimic.
        print('Nicio adresă nu a putut fi localizată (Nominatim și Photon). Opresc sincronizarea.', file=sys.stderr)
        return 1

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump([{k: v for k, v in e.items() if not k.startswith('_')} for e in events], f, ensure_ascii=False, indent=2)
        print(f'Scris {len(events)} evenimente în {args.out}')

    if args.dry_run:
        return 0
    sync_firestore(events, source, keep_prefixes)
    return 0


def summary(line: str) -> None:
    """Un rând în log și în rezumatul rulării GitHub Actions."""
    print(line)
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(line + '\n\n')


def cli_args(description: str | None, html_help: str | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dry-run', action='store_true', help='nu scrie în Firestore')
    if html_help:
        ap.add_argument('--html', help=html_help)
    ap.add_argument('--out', help='scrie evenimentele (JSON) în acest fișier')
    ap.add_argument('--no-geocode', action='store_true', help='fără Nominatim (doar la --dry-run)')
    args = ap.parse_args()
    if args.no_geocode and not args.dry_run:
        ap.error('--no-geocode merge doar cu --dry-run (Firestore cere o locație)')
    return args


def encode_geohash(lat: float, lng: float, precision: int = 10) -> str:
    """Același geohash ca `geohashForLocation` din geofire-common (folosit la interogările pe rază)."""
    base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    lat_r, lng_r = [-90.0, 90.0], [-180.0, 180.0]
    out, bits, ch, even = [], 0, 0, True
    while len(out) < precision:
        rng, val = (lng_r, lng) if even else (lat_r, lat)
        mid = (rng[0] + rng[1]) / 2
        if val > mid:
            ch = (ch << 1) | 1
            rng[0] = mid
        else:
            ch <<= 1
            rng[1] = mid
        even = not even
        bits += 1
        if bits == 5:
            out.append(base32[ch])
            bits, ch = 0, 0
    return ''.join(out)


if __name__ == '__main__':
    sys.exit(main())
