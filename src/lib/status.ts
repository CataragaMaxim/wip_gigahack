import { CONFIG } from '@/config/constants';
import { SUBTYPES, toneFg, toneLine, toneTint, toneVar, type Tone } from '@/config/categories';
import type { DerivedEvent, Status, UrbanEvent } from '@/types';
import { fmtAgo, fmtAt } from './format';
import { t } from '@/i18n';
import type { IconName } from './icons';

/** Statusul unui eveniment, calculat din sursă, voturi și timp. */
export function deriveStatus(e: UrbanEvent, extraYes = 0, extraNo = 0, now = Date.now()): Status {
  if (e.resolvedAt) return 'rezolvat';
  if (e.sourceType === 'official') {
    return e.endAt && new Date(e.endAt).getTime() < now ? 'expirat' : 'oficial';
  }
  const c = e.confirmations + extraYes;
  const n = e.denials + extraNo;
  if (n > c && n >= CONFIG.CONTEST_MIN_DENIALS) return 'contestat';
  const ageH = e.reportedAt ? (now - new Date(e.reportedAt).getTime()) / 36e5 : 0;
  if (c >= CONFIG.CONFIRM_THRESHOLD) return ageH > CONFIG.CONFIRMED_EXPIRY_H ? 'expirat' : 'confirmat';
  return ageH > CONFIG.REPORT_EXPIRY_H ? 'expirat' : 'raportat';
}

export const isClosed = (s: Status) => s === 'rezolvat' || s === 'expirat';

/**
 * Pe harta publică: anunțurile oficiale active și raportările active (confirmate sau încă neconfirmate —
 * acestea trebuie văzute de vecini ca să poată fi confirmate). Cele contestate sau expirate nu apar.
 */
/**
 * Numărul de evenimente (anunțuri): un anunț cu mai multe adrese apare pe hartă ca mai multe zone,
 * dar se numără o singură dată — la fel ca în calendar și în „încă N mai târziu”.
 */
export const countOutages = (list: { id: string; parentId?: string }[]) => new Set(list.map((e) => e.parentId ?? e.id)).size;

/** Pe hartă acum: evenimentele în curs și cele care încep în următoarele CONFIG.MAP_AHEAD_H ore. */
export const isOnMapNow = (e: Pick<UrbanEvent, 'startAt'>, now = Date.now()) =>
  !e.startAt || new Date(e.startAt).getTime() <= now + CONFIG.MAP_AHEAD_H * 36e5;

/** Evenimentul e activ (măcar o parte) în zilele date: `days` zile de la `day` (00:00, ora locală). */
export function activeOnDay(e: Pick<UrbanEvent, 'startAt' | 'endAt' | 'reportedAt'>, day: Date, days = 1): boolean {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + days).getTime() - 1;
  const start = new Date(e.startAt ?? e.reportedAt ?? 0).getTime();
  const end = e.endAt ? new Date(e.endAt).getTime() : start;
  return start <= to && end >= from;
}

export function isPublic(e: DerivedEvent): boolean {
  return e.status === 'oficial' || e.status === 'confirmat' || e.status === 'raportat';
}

export interface BadgeStyle {
  label: string;
  icon: IconName;
  className: string;
}

export function statusBadge(e: DerivedEvent): BadgeStyle {
  switch (e.status) {
    case 'oficial':
      return { label: t('Oficial'), icon: 'shield', className: 'badge badge--official' };
    case 'confirmat':
      return { label: t('Confirmat de {n} vecini', { n: e.conf }), icon: 'check', className: 'badge badge--confirmed' };
    case 'raportat':
      return { label: t('Neconfirmat'), icon: 'clock', className: 'badge badge--reported' };
    case 'contestat':
      return { label: t('Contestat'), icon: 'help', className: 'badge badge--contested' };
    case 'rezolvat':
      return { label: t('Rezolvat'), icon: 'check', className: 'badge badge--closed' };
    default:
      return { label: t('Expirat'), icon: 'history', className: 'badge badge--closed' };
  }
}

export const severityLabel = (e: UrbanEvent) =>
  e.severity === 'total'
    ? { label: t('Întrerupere totală'), short: t('Totală') }
    : { label: t('Parțial — posibil afectat'), short: t('Posibil afectat') };

export function sourceLabel(e: UrbanEvent): { label: string; icon: IconName } {
  if (e.feed === 'live') return { label: t('Flux oficial · {source}', { source: e.source ?? '' }), icon: 'radio' };
  if (e.sourceType === 'official') return { label: e.source ?? t('Sursă oficială'), icon: 'shield' };
  return { label: t('Raportat de vecini'), icon: 'user' };
}

/**
 * Gravitatea, arătată prin culoare: întrerupere totală = roșu, parțial (doar o parte din adrese sau presiune slabă) = galben.
 * Anunțurile oficiale și raportările vecinilor au aceleași culori; raportările se deosebesc prin dungi oblice.
 */
export function tone(e: Pick<UrbanEvent, 'severity'> & { status: Status }): Tone {
  if (isClosed(e.status)) return 'closed';
  return e.severity === 'partial' ? 'partial' : 'full';
}
type ToneInput = Pick<UrbanEvent, 'severity'> & { status: Status };
/** Culoarea pentru text, contururi și puncte (lizibilă pe fundal deschis). */
export const eventColor = (e: ToneInput) => toneLine(tone(e));
export const eventTint = (e: ToneInput) => toneTint(tone(e));

/** Dungile oblice ale raportărilor vecinilor, în culoarea iconiței (albe pe roșu, închise pe galben). */
export const stripes = (fg: string) =>
  `repeating-linear-gradient(-45deg, color-mix(in srgb, ${fg} 34%, transparent) 0 3px, transparent 3px 7px)`;

/**
 * Aspectul markerului/plăcuței: culoarea = gravitatea, dungile = raportare a vecinilor, conturul punctat = încă neconfirmată,
 * estompat = contestată, iconița = tipul.
 */
export function tileStyle(e: DerivedEvent) {
  const k = tone(e);
  if (k === 'closed')
    return { bg: toneVar(k), fg: toneFg(k), border: toneLine(k), dashed: false, faded: false, striped: false };
  return {
    bg: toneVar(k),
    fg: toneFg(k),
    border: toneLine(k),
    dashed: e.status === 'raportat',
    faded: e.status === 'contestat',
    striped: e.sourceType === 'citizen',
  };
}

export function timeInfo(e: DerivedEvent): string {
  if (e.status === 'rezolvat' && e.resolvedAt) return t('rezolvat {when}', { when: fmtAt(new Date(e.resolvedAt)) });
  if (e.status === 'expirat') return t('expirat');
  if (e.sourceType === 'official') {
    const st = e.startAt ? new Date(e.startAt) : null;
    if (st && st.getTime() > Date.now()) return t('de {when}', { when: fmtAt(st) });
    return e.endAt ? t('până {when}', { when: fmtAt(new Date(e.endAt)) }) : '';
  }
  return e.reportedAt ? t('raportat {ago}', { ago: fmtAgo(new Date(e.reportedAt)) }) : '';
}

export function metaLine(e: DerivedEvent): string {
  // Pentru o adresă dintr-un anunț mai mare, adresa e primul lucru din rând.
  return [e.parentId ? e.streets[0] : null, districtName(e.district), timeInfo(e)].filter(Boolean).join(' · ');
}

export const categoryLine = (e: UrbanEvent) => SUBTYPES[e.subtype].label;

/** Rândul „și încă 12 străzi / adrese” adăugat de fluxurile oficiale (în română în baza de date) → limba interfeței. */
export const streetLine = (s: string) => {
  const m = s.match(/^și încă (\d+) (străzi|adrese)$/);
  return m ? t(m[2] === 'străzi' ? 'și încă {n} străzi' : 'și încă {n} adrese', { n: m[1] }) : s;
};

/** Titlul afișat: titlurile standard (ex. „Apă deconectată”) se traduc; textul liber rămâne cum e. */
export const eventTitle = (e: Pick<UrbanEvent, 'title'>) => t(e.title);

/** Sectoarele au nume traduse (Botanica → Ботаника); „Cruzești (Ciocana)” → „Cruzești (Чеканы)”. */
export const districtName = (d: string) => d.replace(/[^()]+/g, (part) => t(part.trim()) === part.trim() ? part : part.replace(part.trim(), t(part.trim())));

/** „Se reia în aproximativ 3 h” / „Începe mâine la 09:00”. */
export function countdown(e: DerivedEvent): { title: string; sub: string } | null {
  if (e.sourceType !== 'official' || isClosed(e.status) || !e.endAt) return null;
  const st = e.startAt ? new Date(e.startAt) : null;
  const en = new Date(e.endAt);
  if (st && st.getTime() > Date.now())
    return { title: t('Începe {when}', { when: fmtAt(st) }), sub: t('Durată estimată până {when}', { when: fmtAt(en) }) };
  const h = (en.getTime() - Date.now()) / 36e5;
  const title =
    h < 1
      ? t('Se reia în mai puțin de o oră')
      : h < 36
        ? t('Se reia în aproximativ {n} h', { n: Math.round(h) })
        : t('Se reia în aproximativ {n} zile', { n: Math.round(h / 24) });
  return { title, sub: t('Conform anunțului oficial: {when}', { when: fmtAt(en) }) };
}
