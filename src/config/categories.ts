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
];

export const CATEGORY: Record<CategoryKey, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, CategoryDef>;

export interface SubtypeDef {
  label: string;
  icon: IconName;
  /** Titlul implicit al unei raportări noi. */
  title: string;
  /** Explicația scurtă din dialogul de raportare. */
  hint: string;
}

export const SUBTYPES: Record<SubtypeKey, SubtypeDef> = {
  apa: { label: 'Apă', icon: 'droplet', title: 'Lipsă apă', hint: 'Fără apă, presiune joasă, avarie' },
  gaz: { label: 'Gaz', icon: 'flame', title: 'Lipsă gaz', hint: 'Fără gaz, miros de gaz, avarie' },
  electricitate: { label: 'Electricitate', icon: 'bolt', title: 'Fără energie electrică', hint: 'Pană de curent, tensiune instabilă' },
};

/** Opțiunile din filtre, raportare și calendar, în această ordine. */
export const TYPES: SubtypeKey[] = ['electricitate', 'apa', 'gaz'];
export const ALL_TYPES_ON: Record<SubtypeKey, boolean> = { apa: true, gaz: true, electricitate: true };
/** Documentele vechi din Firestore pot avea tipuri care nu mai există (telecom, drumuri etc.): nu le afișăm. */
export const isKnownType = (subtype: string): subtype is SubtypeKey => subtype in SUBTYPES;

/**
 * Culorile categoriilor ca valori concrete (Leaflet desenează liniile ca atribute SVG,
 * unde variabilele CSS nu funcționează). Aceleași valori ca în src/styles/tokens.css.
 * Contrast verificat WCAG AA: alb pe culoare ≥ 5,5:1 (luminos), icon închis pe culoare ≥ 7,8:1 (întunecat).
 */
export const CATEGORY_HEX: Record<'light' | 'dark', Record<CategoryKey, string>> = {
  light: { utilitati: '#1F5FC9' },
  dark: { utilitati: '#7AA7FF' },
};
export const RESOLVED_HEX = { light: '#7A7F86', dark: '#8E959F' };

/** Variabilele CSS pentru HTML (markere, liste). */
export const catVar = (k: CategoryKey) => `var(--c-${k})`;
export const catTint = (k: CategoryKey) => `var(--c-${k}-t)`;
