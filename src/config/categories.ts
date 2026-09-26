import type { CategoryKey, SubtypeKey } from '@/types';
import type { IconName } from '@/lib/icons';
import { t } from '@/i18n';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  short: string;
  hint: string;
  icon: IconName;
  subtypes: SubtypeKey[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'utilitati',
    get label() { return t('Utilități'); },
    get short() { return t('Utilități'); },
    get hint() { return t('Apă, gaz, electricitate'); },
    icon: 'plug',
    subtypes: ['apa', 'gaz', 'electricitate'],
  },
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

/** Textele se traduc la citire (getter), deci oriunde se folosește `SUBTYPES[k].label` apare în limba curentă. */
const subtype = (icon: IconName, label: string, title: string, hint: string): SubtypeDef => ({
  icon,
  get label() { return t(label); },
  get title() { return t(title); },
  get hint() { return t(hint); },
});

/** Titlul salvat în Firestore pentru o raportare nouă — mereu în română (se traduce doar la afișare). */
export const SUBTYPE_TITLE_RO: Record<SubtypeKey, string> = {
  apa: 'Lipsă apă',
  gaz: 'Lipsă gaz',
  electricitate: 'Fără energie electrică',
};

export const SUBTYPES: Record<SubtypeKey, SubtypeDef> = {
  apa: subtype('droplet', 'Apă', SUBTYPE_TITLE_RO.apa, 'Fără apă, presiune joasă, avarie'),
  gaz: subtype('flame', 'Gaz', SUBTYPE_TITLE_RO.gaz, 'Fără gaz, miros de gaz, avarie'),
  electricitate: subtype('bolt', 'Electricitate', SUBTYPE_TITLE_RO.electricitate, 'Pană de curent, tensiune instabilă'),
};

/** Opțiunile din filtre, raportare și calendar, în această ordine. */
export const TYPES: SubtypeKey[] = ['electricitate', 'apa', 'gaz'];
export const ALL_TYPES_ON: Record<SubtypeKey, boolean> = { apa: true, gaz: true, electricitate: true };
/** Documentele vechi din Firestore pot avea tipuri care nu mai există (telecom, drumuri etc.): nu le afișăm. */
export const isKnownType = (subtype: string): subtype is SubtypeKey => subtype in SUBTYPES;

/** Culorile tipurilor ca valori concrete (Leaflet desenează ca atribute SVG, unde variabilele CSS nu funcționează). Aceleași valori ca în src/styles/tokens.css. */
export const TYPE_HEX: Record<'light' | 'dark', Record<SubtypeKey, string>> = {
  light: { apa: '#1F5FC9', electricitate: '#A16207', gaz: '#C2410C' },
  dark: { apa: '#7AA7FF', electricitate: '#FACC15', gaz: '#FB923C' },
};
export const RESOLVED_HEX = { light: '#7A7F86', dark: '#8E959F' };

/** Variabilele CSS pentru HTML (markere, liste). */
export const catVar = (k: CategoryKey) => `var(--c-${k})`;
export const catTint = (k: CategoryKey) => `var(--c-${k}-t)`;
/** Culoarea fiecărui tip (apă, electricitate, gaz) — folosită peste tot pentru evenimente. */
export const typeVar = (k: SubtypeKey) => `var(--c-${k})`;
export const typeTint = (k: SubtypeKey) => `var(--c-${k}-t)`;
