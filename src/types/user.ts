import type { Timestamp } from 'firebase/firestore';
import type { CategoryKey, LatLng, Status } from './index';

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
  kind: 'home' | 'work' | 'person';
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
  if (role >= UserRole.Admin) return 'Administrator';
  if (role >= UserRole.Manager) return 'Manager';
  if (role >= UserRole.Government) return 'Guvern';
  if (role >= UserRole.Trusted) return 'Utilizator de încredere';
  if (role >= UserRole.User) return 'Utilizator';
  return 'Blocat';
}