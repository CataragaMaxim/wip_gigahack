import type { Timestamp } from 'firebase/firestore';
import type { CategoryKey, LatLng, Status } from './index';
import { t } from '@/i18n';

/** Roluri numerice: cu cât mai mare, cu atât mai multe drepturi. */
export enum UserRole {
  Banned = 0,
  User = 1,
  Trusted = 10,
  Government = 100,
  Manager = 1000,
  Admin = 10000,
}

export interface UserStats {
  reports: number;
  confirmations: number;
  denials: number;
  resolved: number;
}

/** Documentul `users/{uid}`. */
export interface UserProfile {
  uid: string;
  email: string | null;
  phone: string | null;
  name: string;
  photoURL: string | null;
  userType: UserRole;
  credibilityScore: number;
  /** Până când contul nu poate raporta (credibilitate sub CONFIG.CRED_MIN). Scris doar de server. */
  reportBlockedUntil: Timestamp | null;
  banned: boolean;
  locale: 'ro' | 'ru' | 'en';
  notificationsEnabled: boolean;
  stats: UserStats;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Documentul `users/{uid}/locations/{id}`. */
export interface SavedLocationDoc {
  id: string;
  /** 'home' = Acasă (una singură); 'other' = adresele suplimentare (max. MAX_EXTRA_ADDRESSES). 'work'/'person' = conturi vechi. */
  kind: 'home' | 'work' | 'person' | 'other';
  name: string;
  address: string;
  location: LatLng;
  prefs: Record<CategoryKey, boolean>;
}

export type HistoryKind = 'created' | 'confirmed' | 'denied';

/** Documentul `users/{uid}/history/{eventId}`. */
export interface HistoryEntry {
  eventId: string;
  kind: HistoryKind;
  title: string;
  category: CategoryKey;
  at: Timestamp | null;
  status?: Status;
}

export const DEFAULT_USER_STATS: UserStats = {
  reports: 0,
  confirmations: 0,
  denials: 0,
  resolved: 0,
};

// ---------- helperi rol ----------
export const hasRole = (u: Pick<UserProfile, 'userType'> | null, min: UserRole): boolean =>
  !!u && u.userType >= min;

export const isAdmin = (u: UserProfile | null) => hasRole(u, UserRole.Admin);
export const isManager = (u: UserProfile | null) => hasRole(u, UserRole.Manager);
export const isGovernment = (u: UserProfile | null) => hasRole(u, UserRole.Government);
export const isTrusted = (u: UserProfile | null) => hasRole(u, UserRole.Trusted);

export function roleLabel(role: UserRole): string {
  if (role >= UserRole.Admin) return t('Administrator');
  if (role >= UserRole.Manager) return t('Manager');
  if (role >= UserRole.Government) return t('Guvern');
  if (role >= UserRole.Trusted) return t('Utilizator de încredere');
  if (role >= UserRole.User) return t('Utilizator');
  return t('Blocat');
}