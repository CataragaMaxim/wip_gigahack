import { CONFIG } from '@/config/constants';
import { CATEGORY, SUBTYPES, catTint, catVar } from '@/config/categories';
import type { DerivedEvent, Status, UrbanEvent } from '@/types';
import { fmtAgo, fmtAt, fmtDistance } from './format';
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

/** Pe harta publică: doar anunțuri oficiale active și raportări confirmate (plus raportările proprii). */
export function isPublic(e: DerivedEvent, userId?: string): boolean {
  if (e.status === 'oficial' || e.status === 'confirmat') return true;
  return !!userId && e.authorId === userId && e.status === 'raportat';
}

export interface BadgeStyle {
  label: string;
  icon: IconName;
  className: string;
}

export function statusBadge(e: DerivedEvent): BadgeStyle {
  switch (e.status) {
    case 'oficial':
      return { label: 'Oficial', icon: 'shield', className: 'badge badge--official' };
    case 'confirmat':
      return { label: `Confirmat de ${e.conf} vecini`, icon: 'check', className: 'badge badge--confirmed' };
    case 'raportat':
      return { label: 'Neconfirmat', icon: 'clock', className: 'badge badge--reported' };
    case 'contestat':
      return { label: 'Contestat', icon: 'help', className: 'badge badge--contested' };
    case 'rezolvat':
      return { label: 'Rezolvat', icon: 'check', className: 'badge badge--closed' };
    default:
      return { label: 'Expirat', icon: 'history', className: 'badge badge--closed' };
  }
}

export const severityLabel = (e: UrbanEvent) =>
  e.severity === 'total'
    ? { label: 'Întrerupere totală', short: 'Totală' }
    : { label: 'Parțial — posibil afectat', short: 'Posibil afectat' };

export function sourceLabel(e: UrbanEvent): { label: string; icon: IconName } {
  if (e.feed === 'live') return { label: `Flux oficial · ${e.source}`, icon: 'radio' };
  if (e.sourceType === 'official') return { label: e.source ?? 'Sursă oficială', icon: 'shield' };
  return { label: 'Raportat de vecini', icon: 'user' };
}

/** Aspectul markerului/plăcuței: culoarea = categoria, forma = statusul, umplerea = gravitatea. */
export function tileStyle(e: DerivedEvent) {
  const color = catVar(e.category);
  const tint = catTint(e.category);
  if (isClosed(e.status))
    return { bg: 'var(--resolved)', fg: 'var(--surface)', border: 'var(--resolved)', dashed: false, faded: false };
  if (e.status === 'raportat') return { bg: 'var(--surface)', fg: color, border: color, dashed: true, faded: false };
  const faded = e.status === 'contestat';
  if (e.severity === 'partial') return { bg: tint, fg: color, border: color, dashed: false, faded };
  return { bg: color, fg: 'var(--on-cat)', border: color, dashed: false, faded };
}

export function timeInfo(e: DerivedEvent): string {
  if (e.status === 'rezolvat' && e.resolvedAt) return `rezolvat ${fmtAt(new Date(e.resolvedAt))}`;
  if (e.status === 'expirat') return 'expirat';
  if (e.sourceType === 'official') {
    const st = e.startAt ? new Date(e.startAt) : null;
    if (st && st.getTime() > Date.now()) return `de ${fmtAt(st)}`;
    return e.endAt ? `până ${fmtAt(new Date(e.endAt))}` : '';
  }
  return e.reportedAt ? `raportat ${fmtAgo(new Date(e.reportedAt))}` : '';
}

export function metaLine(e: DerivedEvent): string {
  return [e.district, e.distanceM != null ? fmtDistance(e.distanceM) : null, timeInfo(e)].filter(Boolean).join(' · ');
}

export const categoryLine = (e: UrbanEvent) => `${CATEGORY[e.category].short} · ${SUBTYPES[e.subtype].label}`;

/** „Se reia în aproximativ 3 h” / „Începe mâine la 09:00”. */
export function countdown(e: DerivedEvent): { title: string; sub: string } | null {
  if (e.sourceType !== 'official' || isClosed(e.status) || !e.endAt) return null;
  const st = e.startAt ? new Date(e.startAt) : null;
  const en = new Date(e.endAt);
  if (st && st.getTime() > Date.now()) return { title: `Începe ${fmtAt(st)}`, sub: `Durată estimată până ${fmtAt(en)}` };
  const h = (en.getTime() - Date.now()) / 36e5;
  const verb = 'Se reia';
  const title =
    h < 1 ? `${verb} în mai puțin de o oră` : h < 36 ? `${verb} în aproximativ ${Math.round(h)} h` : `${verb} în aproximativ ${Math.round(h / 24)} zile`;
  return { title, sub: `Conform anunțului oficial: ${fmtAt(en)}` };
}
