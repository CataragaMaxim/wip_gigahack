import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, Timestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User, SavedLocation } from '@/types';

/** Creează contul în Firebase Auth + scrie profilul în users/{uid}. */
export async function signUpUser(name: string, email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    name, email,
  });
  return { id: cred.user.uid, name, email };
}

/** Autentificare. Citește profilul din Firestore. */
export async function logInUser(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  const data = snap.data();

  // Block soft-deleted accounts
  if (data?.deletedAt) {
    await signOut(auth);
    throw new Error('EMAIL_SAU_PAROLA_GRESITA');
  }

  return {
    id: cred.user.uid,
    name: data?.name ?? cred.user.displayName ?? '',
    email: cred.user.email ?? email,
  };
}

/** Salvează o adresă în users/{uid}/locations/{id}. */
export async function saveLocation(uid: string, loc: SavedLocation): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'locations', loc.id), {
    kind: loc.kind,
    name: loc.name,
    address: loc.address,
    location: loc.location,                 // {lat, lng} — Firestore il acceptă ca GeoPoint? NU.
    prefs: loc.prefs,
  });
}

/** Citește toate adresele utilizatorului. */
export async function loadLocations(uid: string): Promise<SavedLocation[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'locations'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SavedLocation[];
}

export async function deleteLocation(uid: string, locId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'locations', locId));
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logOutUser = () => signOut(auth);

/** Ascultă schimbările de autentificare (persistă sesiunea la reload). */
export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, async (fb) => {
    if (!fb) return cb(null);
    const snap = await getDoc(doc(db, 'users', fb.uid));
    cb({
      id: fb.uid,
      name: snap.data()?.name ?? fb.displayName ?? '',
      email: fb.email ?? '',
    });
  });
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { deletedAt: Timestamp.now() });

  if (auth.currentUser) {
    await deleteUser(auth.currentUser);
  }
}