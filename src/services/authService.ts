import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  deleteUser,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import {
  ensureUserProfile,
  getUserProfile,
  listUserLocations,
} from './userService';
import { UserRole, type UserProfile, type SavedLocationDoc } from '@/types/user';

// ---------- signup cu email/parolă ----------

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return ensureUserProfile(cred.user.uid, {
    email,
    name,
    userType: UserRole.User,
  });
}

// ---------- login cu email/parolă ----------

export async function logInWithEmail(email: string, password: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return ensureUserProfile(cred.user.uid, {
    email: cred.user.email,
    name: cred.user.displayName ?? email.split('@')[0],
    photoURL: cred.user.photoURL,
  });
}

// ---------- Google ----------

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Codul unei erori Firebase Auth („auth/unauthorized-domain” etc.), sau „” dacă nu e una. */
export const authErrorCode = (e: unknown) => (typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '');

/**
 * Google: fereastră pop-up; dacă browserul o blochează (sau nu o suportă, ex. în unele aplicații mobile),
 * trecem la redirect — pagina merge la Google și revine, iar `completeGoogleRedirect` încheie autentificarea.
 * Întoarce null când a pornit redirectul.
 */
export async function logInWithGoogle(): Promise<UserProfile | null> {
  let cred;
  try {
    cred = await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = authErrorCode(e);
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment') {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw e;
  }
  const u = cred.user;
  return ensureUserProfile(u.uid, {
    email: u.email,
    name: u.displayName ?? u.email?.split('@')[0] ?? 'Utilizator',
    photoURL: u.photoURL,
    userType: UserRole.User,
  });
}

/** După redirectul Google: aruncă eroarea (ex. domeniu neautorizat), dacă a fost una; profilul îl creează `watchAuth`. */
export async function completeGoogleRedirect(): Promise<boolean> {
  return !!(await getRedirectResult(auth));
}

// ---------- reset parolă / logout ----------

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

/** Șterge contul din Firebase Authentication (emailul / legătura Google). Poate cere o autentificare recentă. */
export async function deleteAuthAccount(): Promise<void> {
  if (auth.currentUser) await deleteUser(auth.currentUser);
}
export const logOutUser = () => signOut(auth);

// ---------- watchAuth ----------

export interface AuthSnapshot {
  profile: UserProfile | null;
  locations: SavedLocationDoc[];
}

/**
 * Ascultă schimbările de auth. La fiecare login (email/Google/phone),
 * creează profilul dacă lipsește (util pentru Google/phone, care nu trec prin signup).
 */
export function watchAuth(cb: (snap: AuthSnapshot) => void): () => void {
  return onAuthStateChanged(auth, async (fb: FirebaseUser | null) => {
    if (!fb) return cb({ profile: null, locations: [] });
    // Anonymous Firebase Auth provides a stable, rules-verifiable vote identity
    // without making a guest appear signed in or creating a profile document.
    if (fb.isAnonymous) return cb({ profile: null, locations: [] });

    // ensureUserProfile este idempotent: dacă există deja, îl întoarce.
    const profile = await ensureUserProfile(fb.uid, {
      email: fb.email,
      phone: fb.phoneNumber,
      name: fb.displayName ?? fb.email?.split('@')[0] ?? fb.phoneNumber ?? 'Utilizator',
      photoURL: fb.photoURL,
    });
    const locations = await listUserLocations(fb.uid);
    cb({ profile, locations });
  });
}

export { getUserProfile };
