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
NOMINATIM = 'https://nominatim.openstreetmap.org/search'
# lng_min, lat_max, lng_max, lat_min — municipiul Chișinău, ca în src/services/geocoding.ts.
CHISINAU_VIEWBOX = '28.68,47.12,29.02,46.90'

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
    geo_queries: list[str] = field(default_factory=list)

    def to_event(self) -> dict:
        """Forma `UrbanEvent` (fără `location`, adăugată după geocodare)."""
        return {
            'id': self.id,
            'category': 'utilitati',
            'subtype': 'apa',
            'title': self.title,
            'sourceType': 'official',
            'source': SOURCE,
            'feed': 'live',
            'severity': self.severity,
            'district': self.district,
            'streets': self.streets,
            'startAt': local_iso(self.start) if self.start else None,
            'endAt': local_iso(self.end) if self.end else None,
            'updatedAt': local_iso(self.updated) if self.updated else None,
            'description': self.description or None,
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
    geo_queries = house_query(street, number)
    locality = re.sub(r'\s*\(.*$', '', fix_diacritics(district))
    if ascii_fold(locality) not in SECTORS:
        # Suburbie (ex. „Cruzești (Ciocana)”): căutăm în localitate, nu pe o stradă omonimă din oraș.
        geo_queries = [f'{q}, {locality}' for q in geo_queries]
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
        geo_queries=geo_queries,
    )


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
        first = addresses[0]
        m = re.match(r'^(.*?)\s+(\d.*)$', first)
        street, number = (m.group(1), m.group(2)) if m else (first, '')
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
            geo_queries=house_query(street, number),
        ))
    return out, warnings


# ---------- geocodare ----------

_last_request = 0.0


def geocode(queries: list[str]) -> tuple[dict, str] | None:
    """Prima variantă găsită în Chișinău → ({lat, lng}, sector)."""
    global _last_request
    for q in queries:
        wait = 1.1 - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        params = urllib.parse.urlencode({
            'q': f'{q}, Chișinău', 'format': 'jsonv2', 'addressdetails': '1', 'limit': '1',
            'countrycodes': 'md', 'viewbox': CHISINAU_VIEWBOX, 'bounded': '1', 'accept-language': 'ro',
        })
        req = urllib.request.Request(f'{NOMINATIM}?{params}', headers={'User-Agent': USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                items = json.load(res)
        except Exception as e:  # noqa: BLE001 — geocodarea nu oprește sincronizarea
            print(f'  geocodare eșuată pentru „{q}”: {e}', file=sys.stderr)
            items = []
        finally:
            _last_request = time.monotonic()
        if items:
            it = items[0]
            a = it.get('address', {})
            district = a.get('city_district') or a.get('suburb') or ''
            district = re.sub(r'^Sectorul\s+', '', district)
            return {'lat': float(it['lat']), 'lng': float(it['lon'])}, district
    return None


# ---------- Firestore ----------

_db = None


def firestore_client():
    global _db
    if _db is None:
        import firebase_admin
        from firebase_admin import credentials, firestore

        raw = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
        cred = credentials.Certificate(json.loads(raw)) if raw else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db


def sync_firestore(events: list[dict]) -> None:
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
            **{k: v for k, v in e.items() if k not in ('id', 'location', 'geoKey')},
            'startAt': ts(e['startAt']), 'endAt': ts(e['endAt']), 'updatedAt': ts(e['updatedAt']),
            'location': GeoPoint(e['location']['lat'], e['location']['lng']),
            'geohash': e['geohash'], 'geoKey': e['geoKey'],
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
    feed_docs = (col.where(filter=FieldFilter('source', '==', SOURCE))
                 .where(filter=FieldFilter('feed', '==', 'live'))
                 .stream())
    cutoff = datetime.now(timezone.utc) - RETENTION
    to_delete = []
    for d in feed_docs:
        if d.id in live_ids:
            continue
        resolved_at = d.get('resolvedAt')
        if resolved_at is None:
            # Nu mai e pe site: reconectat sau retras.
            batch.update(d.reference, {'resolvedAt': SERVER_TIMESTAMP})
            resolved += 1
        elif resolved_at < cutoff:
            to_delete.append(d.reference)

    batch.commit()
    # recursive_delete șterge și subcolecția `votes`, altfel voturile ar rămâne orfane.
    for ref in to_delete:
        db.recursive_delete(ref)
    print(f'Firestore: {created} noi, {updated} actualizate, {resolved} rezolvate, {len(to_delete)} șterse.')


def existing_locations(ids: list[str]) -> dict[str, dict]:
    """Locația și cheia de geocodare din documentele existente, ca să nu geocodăm din nou."""
    db = firestore_client()
    refs = [db.collection('events').document(i) for i in ids]
    out = {}
    for snap in db.get_all(refs):
        if snap.exists:
            d = snap.to_dict()
            loc = d.get('location')
            out[snap.id] = {
                'geoKey': d.get('geoKey'),
                'location': {'lat': loc.latitude, 'lng': loc.longitude} if loc else None,
                'district': d.get('district') or '',
            }
    return out


# ---------- main ----------

def fetch_page() -> str:
    req = urllib.request.Request(URL, headers={'User-Agent': USER_AGENT, 'Accept-Language': 'ro'})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode('utf-8', errors='replace')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dry-run', action='store_true', help='nu scrie în Firestore')
    ap.add_argument('--html', help='citește pagina dintr-un fișier local în loc de acc.md')
    ap.add_argument('--out', help='scrie evenimentele (JSON) în acest fișier')
    ap.add_argument('--no-geocode', action='store_true', help='fără Nominatim (doar la --dry-run)')
    args = ap.parse_args()
    if args.no_geocode and not args.dry_run:
        ap.error('--no-geocode merge doar cu --dry-run (Firestore cere o locație)')

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

    known = {} if args.dry_run else existing_locations([o.id for o in outages])
    events: list[dict] = []
    for o in outages:
        e = o.to_event()
        geo_key = '|'.join(o.geo_queries)
        prev = known.get(o.id)
        if prev and prev['geoKey'] == geo_key and prev['location']:
            loc, district = prev['location'], prev['district']
        elif args.no_geocode:
            loc, district = None, ''
        else:
            found = geocode(o.geo_queries)
            loc, district = found if found else (None, '')
        if not loc and not args.no_geocode:
            print(f'::warning::Adresă negăsită, anunț omis: {o.id} {o.streets[0]}')
            continue
        e['district'] = e['district'] or district
        e['location'] = loc
        e['geoKey'] = geo_key
        e['_exists'] = o.id in known
        if loc:
            e['geohash'] = encode_geohash(loc['lat'], loc['lng'])
        events.append(e)

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump([{k: v for k, v in e.items() if not k.startswith('_')} for e in events], f, ensure_ascii=False, indent=2)
        print(f'Scris {len(events)} evenimente în {args.out}')

    if args.dry_run:
        return 0
    sync_firestore(events)
    return 0


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
