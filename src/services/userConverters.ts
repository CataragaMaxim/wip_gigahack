import { Timestamp, GeoPoint } from 'firebase/firestore';
import { UserRole, DEFAULT_USER_STATS, type UserProfile, type SavedLocationDoc, type HistoryEntry, type HistoryKind } from '@/types/user';
import type { LatLng } from '@/types';

const ts = (v: unknown): Timestamp | null => (v instanceof Timestamp ? v : null);
const gp = (v: unknown): LatLng | null =>
  v instanceof GeoPoint ? { lat: v.latitude, lng: v.longitude } : null;

export function profileFromFirestore(uid: string, d: any): UserProfile {
  return {
    uid,
    email: d.email ?? null,
    phone: d.phone ?? null,
    name: d.name ?? '',
    photoURL: d.photoURL ?? null,
    userType: (d.userType as UserRole) ?? UserRole.User,
    credibilityScore: d.credibilityScore ?? 50,
    banned: d.banned ?? false,
    locale: d.locale ?? 'ro',
    notificationsEnabled: d.notificationsEnabled ?? true,
    stats: { ...DEFAULT_USER_STATS, ...(d.stats ?? {}) },
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  };
}

/** Doar câmpurile scriabile de client (fără createdAt/updatedAt/stats/userType). */
export function profileWritableFields(p: Partial<UserProfile>) {
  const out: Record<string, any> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.photoURL !== undefined) out.photoURL = p.photoURL;
  if (p.locale !== undefined) out.locale = p.locale;
  if (p.notificationsEnabled !== undefined) out.notificationsEnabled = p.notificationsEnabled;
  return out;
}

export function locationFromFirestore(id: string, d: any): SavedLocationDoc {
  return {
    id,
    kind: d.kind,
    name: d.name,
    address: d.address,
    location: gp(d.location) ?? { lat: 0, lng: 0 },
    prefs: d.prefs ?? {},
  };
}

export function locationToFirestore(l: Omit<SavedLocationDoc, 'id'>) {
  return {
    kind: l.kind,
    name: l.name,
    address: l.address,
    location: new GeoPoint(l.location.lat, l.location.lng),
    prefs: l.prefs,
  };
}

export function historyFromFirestore(eventId: string, d: any): HistoryEntry {
  return {
    eventId,
    kind: (d.kind as HistoryKind) ?? 'created',
    title: d.title ?? '',
    category: d.category,
    at: ts(d.at),
    status: d.status ?? undefined,
  };
}