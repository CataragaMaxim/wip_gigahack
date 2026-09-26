import type { CategoryKey, SavedLocation, User } from '@/types';
import { DEMO_USER_ID } from './mockEvents';

export const ALL_CATEGORIES_ON: Record<CategoryKey, boolean> = {
  utilitati: true,
  telecom: true,
  drumuri: true,
  transport: true,
  urban: true,
};

/** Cont demonstrativ (fictiv). */
export const DEMO_USER: User = { id: DEMO_USER_ID, name: 'Ana Ciobanu', email: 'ana.ciobanu@exemplu.md' };

export const DEMO_LOCATIONS: SavedLocation[] = [
  { id: 'acasa', kind: 'home', name: 'Acasă', address: 'Bd. Dacia 27, Botanica', location: { lat: 46.98636, lng: 28.85878 }, prefs: { ...ALL_CATEGORIES_ON } },
  { id: 'serviciu', kind: 'work', name: 'Serviciu', address: 'Str. Ismail 88, Centru', location: { lat: 47.01799, lng: 28.84983 }, prefs: { ...ALL_CATEGORIES_ON, telecom: false } },
  { id: 'parinti', kind: 'person', name: 'Părinți', address: 'Bd. Mircea cel Bătrîn 12, Ciocana', location: { lat: 47.04407, lng: 28.89149 }, prefs: { ...ALL_CATEGORIES_ON } },
];
