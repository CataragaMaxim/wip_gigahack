import L from 'leaflet';
import { SUBTYPES, TONES } from '@/config/categories';
import { iconSvg } from '@/lib/icons';
import { tileStyle } from '@/lib/status';
import type { DerivedEvent, SavedLocation } from '@/types';
import { clusterSize, type MarkerCluster } from './clusters';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Markerul unui eveniment: culoarea = gravitatea, dungile = raportare a vecinilor, iconița = tipul, insigna = verificarea. */
export function eventIcon(e: DerivedEvent, selected: boolean): L.DivIcon {
  const t = tileStyle(e);
  const badge =
    e.status === 'oficial'
      ? `<span class="wip-marker__badge">${iconSvg('shield', 12, 2.6)}</span>`
      : e.status === 'confirmat'
        ? `<span class="wip-marker__badge">${e.conf}</span>`
        : e.status === 'contestat'
          ? '<span class="wip-marker__badge">?</span>'
          : '';
  const cls = ['wip-marker', selected ? 'is-selected' : '', t.faded ? 'is-faded' : '', t.striped ? 'is-striped' : ''].join(' ');
  const style = `--m-bg:${t.bg};--m-fg:${t.fg};--m-bc:${t.border};--m-bs:${t.dashed ? 'dashed' : 'solid'}`;
  return L.divIcon({
    className: 'wip-marker-host',
    html: `<div class="${cls}" style="${style}"><span class="wip-marker__dot">${iconSvg(SUBTYPES[e.subtype].icon, 18)}</span>${badge}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

const PLACE_ICON = { home: 'home', work: 'briefcase', person: 'user', other: 'pin' } as const;

/** Adresele salvate: punct + etichetă „Acasă · Bd. Dacia 27”. */
export function placeIcon(l: SavedLocation): L.DivIcon {
  const short = l.address.split(',')[0];
  return L.divIcon({
    className: 'wip-place-host',
    html: `<div class="wip-place"><span class="wip-place__dot"></span><span class="wip-place__tail"></span><span class="wip-place__label">${iconSvg(PLACE_ICON[l.kind], 15, 2.2)}<strong>${esc(l.name)}</strong><span>${esc(short)}</span></span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export const meIcon = L.divIcon({
  className: 'wip-me-host',
  html: '<div class="wip-me"><span class="wip-me__pulse"></span><span class="wip-me__dot"></span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/**
 * Grupul de markere suprapuse (zoom depărtat): cerc mai mare în culoarea gravității dominante, inel cu proporția
 * întreruperilor totale (roșu) și parțiale (galben), iconița tipului dominant și numărul de evenimente.
 */
export function clusterIcon(c: MarkerCluster): L.DivIcon {
  const total = c.members.length;
  const size = clusterSize(total);
  let at = 0;
  const stops = TONES.filter((k) => c.byTone[k]).map((k) => {
    const from = at;
    at += ((c.byTone[k] ?? 0) / total) * 360;
    return `var(--s-${k}) ${from}deg ${at}deg`;
  });
  const style = `--cl-size:${size}px;--cl-bg:var(--s-${c.mainTone});--cl-fg:var(--s-${c.mainTone}-fg);--cl-ring:conic-gradient(${stops.join(',')})`;
  return L.divIcon({
    className: 'wip-marker-host',
    html: `<div class="wip-cluster" style="${style}"><span class="wip-cluster__dot">${iconSvg(SUBTYPES[c.main].icon, 20)}</span><span class="wip-cluster__count">${total > 99 ? '99+' : total}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
