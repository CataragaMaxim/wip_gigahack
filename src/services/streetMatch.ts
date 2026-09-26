import { STREETS } from '@/data/streets';
import { distance, nearestStreet } from '@/lib/geo';
import type { LatLng } from '@/types';

/**
 * Potrivirea unei raportări pe strada reală (geometrie OpenStreetMap).
 *
 * 1. Overpass: toate drumurile cu nume din jurul pinului → cel mai apropiat (în limita MAX_SNAP_M).
 *    Porțiunile cu același nume se leagă între ele, iar segmentul afectat urmează strada
 *    în ambele sensuri de la punctul proiectat, mereu pe continuarea cea mai dreaptă.
 * 2. Dacă Overpass nu răspunde: Nominatim reverse (geometria unei singure porțiuni de drum).
 * 3. Offline / servicii indisponibile: doar numele din lista aproximativă de străzi, fără a desena un traseu care ar putea fi greșit.
 * Sectorul și numărul casei vin din Nominatim reverse, în paralel.
 */

export interface StreetMatch {
  /** Numele scurt, în stilul aplicației (ex. „Str. Ismail”). */
  name: string;
  /** Adresa afișată (numele + numărul casei, când e sigur că e pe aceeași stradă). */
  label: string;
  district: string;
  /** Pinul mutat pe axul străzii (sau pinul original, dacă e prea departe ca să fie mutat). */
  snapped: LatLng;
  /** Pinul a fost lipit de stradă și are un segment de-a lungul ei. */
  onStreet: boolean;
  /** Distanța de la pinul original la stradă (m). */
  distanceM: number;
  /** Segmentul afectat, de-a lungul străzii. */
  path: LatLng[];
  source: 'osm' | 'approx';
}

/** Un pin mai departe de atât de orice stradă cu nume nu se lipește de stradă. */
export const MAX_SNAP_M = 60;
/** Până la această distanță (ex. o curte între blocuri) păstrăm numele străzii, fără să mutăm pinul. */
const MAX_NEAR_M = 150;
/** Jumătatea lungimii segmentului afectat al unei raportări (m). */
const HALF_SEGMENT_M = 120;
const SEARCH_RADIUS_M = MAX_NEAR_M + HALF_SEGMENT_M + 100;
const MAX_TURN_RAD = (60 * Math.PI) / 180;
const TIMEOUT_MS = 7000;

const OVERPASS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HIGHWAYS = 'trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|service|trunk_link|primary_link|secondary_link|tertiary_link';

// ---------- geometrie locală (metri, proiecție echirectangulară în jurul pinului) ----------
interface XY {
  x: number;
  y: number;
}
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function projector(ref: LatLng) {
  const kx = rad(1) * R * Math.cos(rad(ref.lat));
  const ky = rad(1) * R;
  return {
    to: (p: LatLng): XY => ({ x: (p.lng - ref.lng) * kx, y: (p.lat - ref.lat) * ky }),
    from: (q: XY): LatLng => ({ lat: ref.lat + q.y / ky, lng: ref.lng + q.x / kx }),
  };
}
const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: XY) => Math.hypot(a.x, a.y);
const lerp = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/** Proiecția punctului p pe segmentul ab: punctul, parametrul t și distanța. */
function projectOnSegment(p: XY, a: XY, b: XY) {
  const d = sub(b, a);
  const L2 = d.x * d.x + d.y * d.y;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / L2)) : 0;
  const q = lerp(a, b, t);
  return { q, t, dist: len(sub(p, q)) };
}
function angleBetween(u: XY, v: XY) {
  const c = (u.x * v.x + u.y * v.y) / ((len(u) * len(v)) || 1);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

// ---------- denumiri ----------
const PREFIXES: [RegExp, string][] = [
  [/^Strada\s+/i, 'Str. '],
  [/^Bulevardul\s+/i, 'Bd. '],
  [/^Stradela\s+/i, 'Str-la '],
  [/^Șoseaua\s+/i, 'Șos. '],
  [/^Piața\s+/i, 'P-ța '],
  [/^Aleea\s+/i, 'Al. '],
];
export function shortStreetName(name: string): string {
  for (const [re, short] of PREFIXES) if (re.test(name)) return name.replace(re, short);
  return name;
}
const cleanDistrict = (d?: string) => (d ?? '').replace(/^sectorul\s+/i, '').trim();

// ---------- rețea ----------
async function fetchJson<T>(url: string, init: RequestInit | undefined, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(t);
    signal?.removeEventListener('abort', onAbort);
  }
}

interface OsmWay {
  id: number;
  tags: { name?: string; highway?: string };
  geometry: { lat: number; lon: number }[];
}
interface Line {
  name: string;
  highway: string;
  pts: LatLng[];
}

async function overpassLines(p: LatLng, signal?: AbortSignal): Promise<Line[]> {
  const q = `[out:json][timeout:10];way(around:${SEARCH_RADIUS_M},${p.lat},${p.lng})["highway"~"^(${HIGHWAYS})$"]["name"];out geom tags;`;
  let lastErr: unknown;
  for (const url of OVERPASS) {
    try {
      const d = await fetchJson<{ elements: OsmWay[] }>(url, { method: 'POST', body: new URLSearchParams({ data: q }) }, signal);
      return d.elements
        .filter((w) => w.tags.name && w.geometry?.length > 1)
        .map((w) => ({ name: w.tags.name!, highway: w.tags.highway ?? '', pts: w.geometry.map((g) => ({ lat: g.lat, lng: g.lon })) }));
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

interface ReverseResult {
  address?: Record<string, string | undefined>;
  geojson?: { type: string; coordinates: number[][] };
  error?: string;
}
async function reverse(p: LatLng, withGeometry: boolean, signal?: AbortSignal): Promise<ReverseResult | null> {
  const params = new URLSearchParams({
    lat: String(p.lat), lon: String(p.lng), format: 'jsonv2', addressdetails: '1', zoom: withGeometry ? '17' : '18', 'accept-language': 'ro',
    ...(withGeometry ? { polygon_geojson: '1' } : {}),
  });
  const r = await fetchJson<ReverseResult>(`${NOMINATIM}/reverse?${params}`, undefined, signal);
  return r.error ? null : r;
}

// ---------- potrivire ----------
/** Cea mai apropiată stradă cu nume; drumurile de serviciu (curți, parcări) sunt penalizate. */
function pickNearest(p: XY, lines: Line[], to: (l: LatLng) => XY) {
  let best: { line: Line; dist: number; score: number } | null = null;
  for (const line of lines) {
    const xy = line.pts.map(to);
    for (let i = 0; i < xy.length - 1; i++) {
      const { dist } = projectOnSegment(p, xy[i], xy[i + 1]);
      const score = dist + (line.highway === 'service' ? 20 : 0);
      if (!best || score < best.score) best = { line, dist, score };
    }
  }
  return best;
}

const key = (q: XY) => `${Math.round(q.x * 10)},${Math.round(q.y * 10)}`;

/**
 * Segmentul de-a lungul străzii `name`, centrat pe proiecția lui p, cu `half` metri în fiecare sens.
 * Porțiunile de drum sunt legate într-un graf prin nodurile comune.
 */
function segmentAlong(p: XY, lines: Line[], name: string, to: (l: LatLng) => XY, half: number) {
  const nodes = new Map<string, XY>();
  const adj = new Map<string, Set<string>>();
  const link = (a: XY, b: XY) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) return;
    nodes.set(ka, a);
    nodes.set(kb, b);
    if (!adj.has(ka)) adj.set(ka, new Set());
    if (!adj.has(kb)) adj.set(kb, new Set());
    adj.get(ka)!.add(kb);
    adj.get(kb)!.add(ka);
  };
  let best: { a: XY; b: XY; q: XY; dist: number } | null = null;
  for (const line of lines) {
    if (line.name !== name) continue;
    const xy = line.pts.map(to);
    for (let i = 0; i < xy.length - 1; i++) {
      link(xy[i], xy[i + 1]);
      const pr = projectOnSegment(p, xy[i], xy[i + 1]);
      if (!best || pr.dist < best.dist) best = { a: xy[i], b: xy[i + 1], q: pr.q, dist: pr.dist };
    }
  }
  if (!best) return null;

  /** Merge din `from` spre `next` până acumulează `remaining` metri. */
  const walk = (from: XY, next: XY, remaining: number): XY[] => {
    const out: XY[] = [];
    const seen = new Set<string>([key(from)]);
    let cur: XY = from;
    let nxt: XY | null = next;
    while (nxt && remaining > 0) {
      const d = len(sub(nxt, cur));
      if (d >= remaining) {
        out.push(lerp(cur, nxt, remaining / d));
        break;
      }
      out.push(nxt);
      remaining -= d;
      seen.add(key(nxt));
      const dir = sub(nxt, cur);
      const prev: XY = nxt;
      let cand: XY | null = null;
      let bestTurn = MAX_TURN_RAD;
      const neighbours: Set<string> = adj.get(key(prev)) ?? new Set<string>();
      for (const k of neighbours) {
        if (seen.has(k)) continue;
        const n: XY = nodes.get(k)!;
        const turn = angleBetween(dir, sub(n, prev));
        if (turn <= bestTurn) {
          bestTurn = turn;
          cand = n;
        }
      }
      cur = prev;
      nxt = cand;
    }
    return out;
  };
  const fwd = walk(best.q, best.b, half);
  const back = walk(best.q, best.a, half);
  return { snapped: best.q, dist: best.dist, path: [...back.reverse(), best.q, ...fwd] };
}

function approxMatch(p: LatLng): StreetMatch | null {
  const ns = nearestStreet(p, STREETS);
  if (!ns || ns.distanceM > 400) return null;
  return {
    name: ns.street.name, label: ns.street.name, district: ns.street.district, snapped: p, onStreet: false,
    distanceM: Math.round(ns.distanceM), path: [p], source: 'approx',
  };
}

const cache = new Map<string, Promise<StreetMatch | null>>();

/**
 * Strada reală a unui punct. `null` = nicio stradă cu nume în apropiere (ex. mijlocul unui parc).
 * Rezultatele se păstrează în memorie, pe puncte rotunjite la ~1 m.
 */
export function matchStreet(p: LatLng): Promise<StreetMatch | null> {
  const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  let pending = cache.get(k);
  if (!pending) {
    pending = doMatch(p).catch(() => approxMatch(p));
    cache.set(k, pending);
    // Eșecurile de rețea nu rămân în cache.
    pending.then((m) => m?.source === 'approx' && cache.delete(k));
  }
  return pending;
}

async function doMatch(p: LatLng): Promise<StreetMatch | null> {
  const { to, from } = projector(p);
  const origin = to(p);
  const addressP = reverse(p, false).catch(() => null);

  let lines: Line[] | null = null;
  try {
    lines = await overpassLines(p);
  } catch {
    // Overpass indisponibil: geometria porțiunii de drum din Nominatim.
    const r = await reverse(p, true);
    const road = r?.address?.road;
    const g = r?.geojson;
    if (road && g?.type === 'LineString') {
      lines = [{ name: road, highway: '', pts: g.coordinates.map(([lng, lat]) => ({ lat, lng })) }];
    } else if (!r) {
      throw new Error('Geocodare indisponibilă');
    } else {
      lines = [];
    }
  }

  const nearest = pickNearest(origin, lines, to);
  if (!nearest || nearest.dist > MAX_NEAR_M) return null;
  const onStreet = nearest.dist <= MAX_SNAP_M;
  const seg = onStreet ? segmentAlong(origin, lines, nearest.line.name, to, HALF_SEGMENT_M) : null;

  const addr = (await addressP)?.address ?? {};
  const name = shortStreetName(nearest.line.name);
  const sameStreet = addr.road && addr.road === nearest.line.name;
  const snapped = seg ? from(seg.snapped) : p;
  return {
    name,
    label: sameStreet && addr.house_number ? `${name} ${addr.house_number}` : name,
    district: cleanDistrict(addr.city_district ?? addr.suburb) || nearestStreet(p, STREETS)?.street.district || '',
    snapped,
    onStreet: !!seg,
    distanceM: Math.round(seg ? distance(p, snapped) : nearest.dist),
    path: seg ? seg.path.map(from) : [p],
    source: 'osm',
  };
}
