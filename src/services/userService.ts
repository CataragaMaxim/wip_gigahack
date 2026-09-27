import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, orderBy, limit,
  serverTimestamp, increment, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { deviceId } from './device';
import { CONFIG } from '@/config/constants';
import {
  profileFromFirestore, locationFromFirestore, locationToFirestore,
  historyFromFirestore, profileWritableFields,
} from './userConverters';
import {
  UserRole, DEFAULT_USER_STATS,
  type UserProfile, type SavedLocationDoc, type HistoryEntry, type HistoryKind,
} from '@/types/user';
import type { CategoryKey, Status } from '@/types';

const USERS = 'users';

// ---------- profile ----------

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return profileFromFirestore(uid, snap.data());
}

/** Creează profilul. Folosit la signup cu email/parolă sau după primul login Google/phone. */
export async function ensureUserProfile(uid: string, data: {
  email?: string | null;
  phone?: string | null;
  name: string;
  photoURL?: string | null;
  userType?: UserRole;
}): Promise<UserProfile> {
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return profileFromFirestore(uid, snap.data());

  const payload = {
    email: data.email ?? null,
    phone: data.phone ?? null,
    name: data.name,
    photoURL: data.photoURL ?? null,
    userType: data.userType ?? UserRole.User,
    credibilityScore: 50,
    banned: false,
    locale: 'ro',
    notificationsEnabled: true,
    stats: { ...DEFAULT_USER_STATS },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  const created = await getDoc(ref);
  return profileFromFirestore(uid, created.data()!);
}

/**
 * Blocarea raportărilor după o credibilitate prea mică: data până la care contul sau acest dispozitiv nu poate raporta
 * (null = poate raporta). Citește profilul actual și documentul `blockedDevices/{deviceId}`.
 */
export async function getReportBlock(uid: string): Promise<Date | null> {
  const [user, device] = await Promise.all([getDoc(doc(db, USERS, uid)), getDoc(doc(db, 'blockedDevices', deviceId()))]);
  const until = [user.data()?.reportBlockedUntil, device.data()?.until]
    .map((v) => (v && typeof v.toDate === 'function' ? (v.toDate() as Date) : null))
    .filter((d): d is Date => !!d && d.getTime() > Date.now());
  return until.length ? new Date(Math.max(...until.map((d) => d.getTime()))) : null;
}

/** Scorul afișat: după ce blocarea a expirat, scorul revine la valoarea de pornire (serverul îl resetează la următorul vot). */
export const effectiveCredibility = (p: Pick<UserProfile, 'credibilityScore' | 'reportBlockedUntil'>) =>
  p.reportBlockedUntil && p.reportBlockedUntil.toMillis() <= Date.now() ? CONFIG.CRED_START : p.credibilityScore;

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<UserProfile, 'name' | 'photoURL' | 'locale' | 'notificationsEnabled'>>,
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), {
    ...profileWritableFields(patch),
    updatedAt: serverTimestamp(),
  });
}

/** Doar admin. */
export async function adminUpdateUser(
  uid: string,
  patch: Partial<Pick<UserProfile, 'userType' | 'credibilityScore' | 'banned'>>,
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { ...patch, updatedAt: serverTimestamp() });
}

export async function bumpUserStats(
  uid: string,
  delta: Partial<Record<keyof UserProfile['stats'], number>>,
): Promise<void> {
  const patch: Record<string, any> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(delta)) {
    if (v) patch[`stats.${k}`] = increment(v);
  }
  await updateDoc(doc(db, USERS, uid), patch);
}

export async function deleteUserProfile(uid: string): Promise<void> {
  // Șterge întâi subcolecțiile (client-side, pentru demo).
  const [locs, hist] = await Promise.all([
    getDocs(collection(db, USERS, uid, 'locations')),
    getDocs(collection(db, USERS, uid, 'history')),
  ]);
  const batch = writeBatch(db);
  locs.forEach((d) => batch.delete(d.ref));
  hist.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, USERS, uid));
  await batch.commit();
}

// ---------- locations ----------

export async function listUserLocations(uid: string): Promise<SavedLocationDoc[]> {
  const snap = await getDocs(collection(db, USERS, uid, 'locations'));
  return snap.docs.map((d) => locationFromFirestore(d.id, d.data()));
}

export async function upsertUserLocation(
  uid: string,
  locId: string,
  loc: Omit<SavedLocationDoc, 'id'>,
): Promise<void> {
  await setDoc(doc(db, USERS, uid, 'locations', locId), locationToFirestore(loc));
}

export async function deleteUserLocation(uid: string, locId: string): Promise<void> {
  await deleteDoc(doc(db, USERS, uid, 'locations', locId));
}

// ---------- history ----------

/** Scrie (sau suprascrie) o intrare în istoric. Folosit la create / vote. */
export async function recordHistory(
  uid: string,
  entry: { eventId: string; kind: HistoryKind; title: string; category: CategoryKey; status?: Status },
): Promise<void> {
  await setDoc(
    doc(db, USERS, uid, 'history', entry.eventId),
    {
      kind: entry.kind,
      title: entry.title,
      category: entry.category,
      status: entry.status ?? null,
      at: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function listUserHistory(uid: string, max = 100): Promise<HistoryEntry[]> {
  const q = query(collection(db, USERS, uid, 'history'), orderBy('at', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => historyFromFirestore(d.id, d.data()));
}

export async function listUserReports(uid: string, max = 100) {
  // Alternativă la subcollection: query direct pe events.
  const q = query(
    collection(db, 'events'),
    where('authorId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  return getDocs(q);
}