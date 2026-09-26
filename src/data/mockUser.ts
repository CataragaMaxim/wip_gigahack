import type { CategoryKey } from '@/types';
import type { SavedLocationDoc } from '@/types/user';
import { DEMO_USER_ID } from './mockEvents';

export const ALL_CATEGORIES_ON: Record<CategoryKey, boolean> = {
  utilitati: true,
};

/**
 * Locatii demonstrative, in forma `SavedLocationDoc` (fara id-ul de document).
 * Cheia din obiect e id-ul subcollection-ului `users/{uid}/locations/{id}`.
 */
export const DEMO_LOCATIONS: Array<SavedLocationDoc & { id: string }> = [
  {
    id: 'acasa',
    kind: 'home',
    name: 'Acasă',
    address: 'Bd. Dacia 27, Botanica',
    location: { lat: 46.98636, lng: 28.85878 },
    prefs: { ...ALL_CATEGORIES_ON },
  },
  {
    id: 'serviciu',
    kind: 'work',
    name: 'Serviciu',
    address: 'Str. Ismail 88, Centru',
    location: { lat: 47.01799, lng: 28.84983 },
    prefs: { ...ALL_CATEGORIES_ON },
  },
  {
    id: 'parinti',
    kind: 'person',
    name: 'Părinți',
    address: 'Bd. Mircea cel Bătrîn 12, Ciocana',
    location: { lat: 47.04407, lng: 28.89149 },
    prefs: { ...ALL_CATEGORIES_ON },
  },
];

// DEMO_USER_ID vine din mockEvents; nu mai avem nevoie de tipul User vechi.
// Daca iti trebuie un user demo pentru teste, foloseste DEMO_USER_ID direct
// sau construieste un UserProfile in teste.
export { DEMO_USER_ID };