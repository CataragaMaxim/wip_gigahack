import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
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

export async function logInWithGoogle(): Promise<UserProfile> {
  const cred = await signInWithPopup(auth, googleProvider);
  const u = cred.user;
  return ensureUserProfile(u.uid, {
    email: u.email,
    name: u.displayName ?? u.email?.split('@')[0] ?? 'Utilizator',
    photoURL: u.photoURL,
    userType: UserRole.User,
  });
}

// ---------- Phone ----------

let recaptcha: RecaptchaVerifier | null = null;
let confirmation: ConfirmationResult | null = null;

/** Pregătește Recaptcha (invizibil). Apelează o singură dată per pagină. */
export function initRecaptcha(containerId: string): RecaptchaVerifier {
  if (recaptcha) return recaptcha;
  recaptcha = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return recaptcha;
}

/** Trimite SMS. Întoarce true dacă s-a trimis. */
export async function sendPhoneCode(phone: string, containerId: string): Promise<boolean> {
  const verifier = initRecaptcha(containerId);
  confirmation = await signInWithPhoneNumber(auth, phone, verifier);
  return true;
}

/** Verifică codul SMS și creează/încarcă profilul. */
export async function confirmPhoneCode(code: string): Promise<UserProfile> {
  if (!confirmation) throw new Error('Nu ai cerut un cod.');
  const cred = await confirmation.confirm(code);
  const u = cred.user;
  return ensureUserProfile(u.uid, {
    phone: u.phoneNumber,
    name: u.displayName ?? u.phoneNumber ?? 'Utilizator',
    userType: UserRole.User,
  });
}

// ---------- reset parolă / logout ----------

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
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