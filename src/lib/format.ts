import { getLang, t, tp } from '@/i18n';

const MONTHS = {
  ro: ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'],
  ru: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Luna scurtă în limba curentă: „oct.” / „окт.” / „Oct”. */
export const monthShort = (d: Date) => MONTHS[getLang()][d.getMonth()];

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
  if (k === 0) return t('azi la {time}', { time: hm(d) });
  if (k === 1) return t('mâine la {time}', { time: hm(d) });
  if (k === -1) return t('ieri la {time}', { time: hm(d) });
  return `${d.getDate()} ${MONTHS[getLang()][d.getMonth()]}, ${hm(d)}`;
}

/** „acum 12 min”, „acum 3 h”, „ieri” */
export function fmtAgo(d: Date): string {
  const m = Math.round((Date.now() - d.getTime()) / 6e4);
  if (m < 1) return t('chiar acum');
  if (m < 60) return t('acum {n} min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('acum {n} h', { n: h });
  const days = Math.floor(h / 24);
  return days === 1 ? t('ieri') : t('acum {n} zile', { n: days });
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Pluralul cu numărul în față, în limba curentă (1 eveniment / 5 evenimente / 20 de evenimente; rusa: 3 forme). */
export const plural = tp;

export const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Prima literă, în alfabetul limbii interfeței (latin ↔ chirilic), pentru inițialele din avatar. */
const TO_CYR: Record<string, string> = {
  A: 'А', Ă: 'А', Â: 'Ы', B: 'Б', C: 'К', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Х', I: 'И', Î: 'Ы', J: 'Ж', K: 'К',
  L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'К', R: 'Р', S: 'С', Ș: 'Ш', Ş: 'Ш', T: 'Т', Ț: 'Ц', Ţ: 'Ц', U: 'У',
  V: 'В', W: 'В', X: 'Х', Y: 'Й', Z: 'З',
};
const TO_LAT: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'J', З: 'Z', И: 'I', Й: 'I', К: 'K', Л: 'L', М: 'M',
  Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'H', Ц: 'Ț', Ч: 'C', Ш: 'Ș', Щ: 'Ș', Ы: 'Î',
  Э: 'E', Ю: 'I', Я: 'I',
};
const inScript = (ch: string) => {
  const c = ch.toUpperCase();
  if (getLang() === 'ru') return TO_CYR[c] ?? c;
  const lat = TO_LAT[c] ?? c;
  // În engleză, fără diacriticele românești.
  return getLang() === 'en' ? lat.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : lat;
};

/** Inițialele numelui („Dumitru Frumosu” → „DF” / „ДФ”), în alfabetul limbii interfeței. */
export const initials = (name: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => inScript(w[0]))
    .join('') || '?';

/** Inițiale deja scrise („AM”) aduse în alfabetul limbii interfeței. */
export const initialsInScript = (s: string) => [...s].map(inScript).join('');

/** Data ISO relativă la momentul curent (pentru datele demonstrative). */
export function relIso(hours: number): string {
  return new Date(Date.now() + hours * 36e5).toISOString();
}
