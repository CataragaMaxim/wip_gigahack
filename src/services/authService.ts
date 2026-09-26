import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc, setDoc, getDocs, collection, deleteDoc, GeoPoint,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User, SavedLocation } from '@/types';

/** Creează contul doar în Firebase Auth (fără doc în Firestore). */
export async function signUpUser(name: string, email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return { id: cred.user.uid, name, email };
}

export async function logInUser(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return {
    id: cred.user.uid,
    name: cred.user.displayName ?? '',
    email: cred.user.email ?? email,
  };
}

/** Salvează o adresă în users/{uid}/locations/{id}. */
export async function saveLocation(uid: string, loc: SavedLocation): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'locations', loc.id), {
    kind: loc.kind,
    name: loc.name,
    address: loc.address,
    location: new GeoPoint(loc.location.lat, loc.location.lng),
    prefs: loc.prefs,
  });
}

/** Citește toate adresele utilizatorului. */
export async function loadLocations(uid: string): Promise<SavedLocation[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'locations'));
  return snap.docs.map((d) => {
    const data = d.data();
    const gp = data.location;
    return {
      id: d.id,
      kind: data.kind,
      name: data.name,
      address: data.address,
      location: gp instanceof GeoPoint
        ? { lat: gp.latitude, lng: gp.longitude }
        : { lat: 0, lng: 0 },
      prefs: data.prefs,
    };
  }) as SavedLocation[];
}

export async function deleteLocation(uid: string, locId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'locations', locId));
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logOutUser = () => signOut(auth);

export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, (fb) => {
    if (!fb) return cb(null);
    cb({
      id: fb.uid,
      name: fb.displayName ?? '',
      email: fb.email ?? '',
    });
  });
}

/**
 * Șterge contul. Cere parola pentru reautentificare (Firebase cere login recent).
 */
export async function deleteUserAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Nu ești autentificat.');

  const cred = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, cred);
  await deleteUser(user);
}