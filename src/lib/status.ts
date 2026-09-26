import { CONFIG } from '@/config/constants';
import { SUBTYPES, typeTint, typeVar } from '@/config/categories';
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

/** Aspectul markerului/plăcuței: culoarea = categoria, forma = statusul, umplerea = gravitatea. */
export function tileStyle(e: DerivedEvent) {
  const color = typeVar(e.subtype);
  const tint = typeTint(e.subtype);
  if (isClosed(e.status))
    return { bg: 'var(--resolved)', fg: 'var(--surface)', border: 'var(--resolved)', dashed: false, faded: false };
  if (e.status === 'raportat') return { bg: 'var(--surface)', fg: color, border: color, dashed: true, faded: false };
  const faded = e.status === 'contestat';
  if (e.severity === 'partial') return { bg: tint, fg: color, border: color, dashed: false, faded };
  return { bg: color, fg: 'var(--on-cat)', border: color, dashed: false, faded };
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
