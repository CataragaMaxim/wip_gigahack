const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];

export const hm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function dayDiff(d: Date, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export const isToday = (d: Date) => dayDiff(d) === 0;

/** „azi la 18:00”, „mâine la 09:00”, „10 oct., 20:00” */
export function fmtAt(d: Date): string {
  const k = dayDiff(d);
  if (k === 0) return `azi la ${hm(d)}`;
  if (k === 1) return `mâine la ${hm(d)}`;
  if (k === -1) return `ieri la ${hm(d)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm(d)}`;
}

/** „acum 12 min”, „acum 3 h”, „ieri” */
export function fmtAgo(d: Date): string {
  const m = Math.round((Date.now() - d.getTime()) / 6e4);
  if (m < 1) return 'chiar acum';
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h} h`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'ieri' : `acum ${days} zile`;
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Pluralul românesc: 1 eveniment, 5 evenimente, 20 de evenimente. */
export function plural(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const r = n % 100;
  if (n === 0 || (r >= 1 && r <= 19)) return `${n} ${many}`;
  return `${n} de ${many}`;
}

export const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const initials = (name: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

/** Data ISO relativă la momentul curent (pentru datele demonstrative). */
export function relIso(hours: number): string {
  return new Date(Date.now() + hours * 36e5).toISOString();
}
