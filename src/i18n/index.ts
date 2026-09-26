import { load, save } from '@/lib/storage';
import { EN, EN_PLURALS } from './en';
import { RU, RU_PLURALS } from './ru';

/**
 * Traduceri: româna e limba sursă (textul din cod); rusa și engleza vin din `ru.ts` și `en.ts`, cheiate după textul românesc.
 * Regula echipei: orice text nou din interfață se adaugă și în `ru.ts` și `en.ts` (verificat de `npm run check:i18n`).
 * Textul oficial preluat de la furnizori (descrieri, străzi) rămâne în limba sursei.
 */
export type Lang = 'ro' | 'ru' | 'en';
export const LANGS: { key: Lang; label: string; name: string }[] = [
  { key: 'ro', label: 'RO', name: 'Română' },
  { key: 'ru', label: 'RU', name: 'Русский' },
  { key: 'en', label: 'EN', name: 'English' },
];

const initial = (): Lang => {
  const saved = load<Lang | null>('wip.lang', null);
  if (saved === 'ro' || saved === 'ru' || saved === 'en') return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? '' : '';
  return nav.startsWith('ru') ? 'ru' : nav.startsWith('en') ? 'en' : 'ro';
};

let current: Lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;

/** Schimbă limba (apelat de AppContext, care re-randează aplicația). */
export function applyLang(l: Lang) {
  current = l;
  save('wip.lang', l);
  document.documentElement.lang = l;
}

/** „Afectează {names}” + { names: 'Acasă' } → textul în limba curentă, cu variabilele înlocuite. */
export function t(ro: string, vars?: Record<string, string | number>): string {
  let s = current === 'ru' ? RU[ro] ?? ro : current === 'en' ? EN[ro] ?? ro : ro;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/**
 * Pluralul cu numărul în față: tp(5, 'eveniment', 'evenimente') → „5 evenimente” / „5 событий”.
 * Româna: 1 eveniment, 2–19 evenimente, 20+ „de evenimente”. Rusa: одна / две–четыре / пять форм.
 */
export function tp(n: number, one: string, many: string): string {
  if (current === 'en') {
    const forms = EN_PLURALS[`${one}|${many}`];
    if (forms) return `${n} ${n === 1 ? forms[0] : forms[1]}`;
  }
  if (current === 'ru') {
    const forms = RU_PLURALS[`${one}|${many}`];
    if (forms) {
      const m10 = n % 10;
      const m100 = n % 100;
      const f = m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2];
      return `${n} ${f}`;
    }
  }
  if (n === 1) return `1 ${one}`;
  const r = n % 100;
  if (n === 0 || (r >= 1 && r <= 19)) return `${n} ${many}`;
  return `${n} de ${many}`;
}
