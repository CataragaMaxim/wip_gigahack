import type { CategoryKey, SubtypeKey } from '@/types';
import type { IconName } from '@/lib/icons';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  short: string;
  hint: string;
  icon: IconName;
  subtypes: SubtypeKey[];
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'utilitati', label: 'Utilități', short: 'Utilități', hint: 'Apă, gaz, electricitate', icon: 'plug', subtypes: ['apa', 'gaz', 'electricitate'] },
  { key: 'telecom', label: 'Telecomunicații', short: 'Telecomunicații', hint: 'Internet, mobil, TV', icon: 'wifi', subtypes: ['internet', 'mobil', 'tv'] },
  { key: 'drumuri', label: 'Drumuri', short: 'Drumuri', hint: 'Lucrări, închideri, gropi', icon: 'cone', subtypes: ['lucrari', 'inchis', 'deteriorat'] },
  { key: 'transport', label: 'Transport public', short: 'Transport public', hint: 'Rute, linii, întârzieri', icon: 'bus', subtypes: ['traseu', 'suspendat', 'intarzieri'] },
  { key: 'urban', label: 'Lucrări și evenimente urbane', short: 'Lucrări urbane', hint: 'Lucrări ale orașului, evenimente cu acces restricționat', icon: 'building', subtypes: ['urbane', 'eveniment'] },
];

export const CATEGORY: Record<CategoryKey, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, CategoryDef>;

export interface SubtypeDef {
  label: string;
  icon: IconName;
  /** Titlul implicit al unei raportări noi. */
  title: string;
}

export const SUBTYPES: Record<SubtypeKey, SubtypeDef> = {
  apa: { label: 'Apă', icon: 'droplet', title: 'Lipsă apă' },
  gaz: { label: 'Gaz', icon: 'flame', title: 'Lipsă gaz' },
  electricitate: { label: 'Electricitate', icon: 'bolt', title: 'Fără energie electrică' },
  internet: { label: 'Internet', icon: 'wifi', title: 'Internet indisponibil' },
  mobil: { label: 'Rețea mobilă', icon: 'phone', title: 'Semnal mobil slab' },
  tv: { label: 'TV', icon: 'tv', title: 'Semnal TV indisponibil' },
  lucrari: { label: 'Lucrări pe drum', icon: 'cone', title: 'Lucrări pe drum' },
  inchis: { label: 'Drum închis', icon: 'ban', title: 'Drum închis' },
  deteriorat: { label: 'Carosabil deteriorat', icon: 'alert', title: 'Carosabil deteriorat' },
  traseu: { label: 'Traseu modificat', icon: 'route', title: 'Traseu modificat' },
  suspendat: { label: 'Linie suspendată', icon: 'ban', title: 'Linie suspendată' },
  intarzieri: { label: 'Întârzieri', icon: 'clock', title: 'Întârzieri mari' },
  urbane: { label: 'Lucrări urbane', icon: 'building', title: 'Lucrări urbane' },
  eveniment: { label: 'Eveniment', icon: 'calendar', title: 'Eveniment cu acces restricționat' },
};

/**
 * Culorile categoriilor ca valori concrete (Leaflet desenează liniile ca atribute SVG,
 * unde variabilele CSS nu funcționează). Aceleași valori ca în src/styles/tokens.css.
 * Contrast verificat WCAG AA: alb pe culoare ≥ 5,5:1 (luminos), icon închis pe culoare ≥ 7,8:1 (întunecat).
 */
export const CATEGORY_HEX: Record<'light' | 'dark', Record<CategoryKey, string>> = {
  light: { utilitati: '#1F5FC9', telecom: '#6B3FC4', drumuri: '#A94F00', transport: '#1C7340', urban: '#0B6B75' },
  dark: { utilitati: '#7AA7FF', telecom: '#B69CFF', drumuri: '#F59A4A', transport: '#5CC98A', urban: '#4CC3CC' },
};
export const RESOLVED_HEX = { light: '#7A7F86', dark: '#8E959F' };

/** Variabilele CSS pentru HTML (markere, liste). */
export const catVar = (k: CategoryKey) => `var(--c-${k})`;
export const catTint = (k: CategoryKey) => `var(--c-${k}-t)`;
