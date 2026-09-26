/**
 * Autentificarea prin Google (Gmail) și prin telefon (cod SMS) — DOAR interfața și o implementare demonstrativă.
 *
 * Pentru conectarea reală (ex. Firebase Auth):
 *   - Google:  signInWithPopup(auth, new GoogleAuthProvider())
 *   - Telefon: signInWithPhoneNumber(auth, phone, new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' }))
 *              → păstrează ConfirmationResult în `PhoneVerification.handle`, apoi handle.confirm(code).
 *              Containerul `#recaptcha-container` există deja în ecranul de telefon (PhoneAuth).
 * `isNewUser` vine din getAdditionalUserInfo(result)?.isNewUser. Erorile se traduc în `SocialAuthError`:
 *   - 'auth/popup-closed-by-user', 'auth/cancelled-popup-request' → 'cancelled'
 *   - 'auth/popup-blocked'                                         → 'popup-blocked'
 *   - 'auth/account-exists-with-different-credential'              → 'account-exists'
 *   - 'auth/invalid-phone-number'                                  → 'invalid-phone'
 *   - 'auth/invalid-verification-code'                             → 'invalid-code'
 *   - 'auth/code-expired'                                          → 'code-expired'
 *   - 'auth/too-many-requests'                                     → 'too-many-requests'
 *   - orice altceva                                                → 'failed'
 * UI-ul (AuthDialog, PhoneAuth) nu trebuie modificat.
 */

export type SocialProvider = 'google' | 'phone';
export type AuthIntent = 'signup' | 'login';

export const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', phone: 'telefonul' };

export interface SocialProfile {
  provider: SocialProvider;
  /** Gol pentru un cont nou creat cu telefonul (îl cerem în pasul „Aproape gata”). */
  name: string;
  /** Gol pentru un cont nou creat cu telefonul (opțional în pasul „Aproape gata”). */
  email: string;
  /** Numărul în format internațional (+373…), pentru conturile prin telefon. */
  phone?: string;
  /** Contul a fost creat acum: mai cerem adresa „Acasă” și acordul pentru termeni. */
  isNewUser: boolean;
}

/** Verificarea în curs a unui număr de telefon (la Firebase: ConfirmationResult). */
export interface PhoneVerification {
  phone: string;
  handle: unknown;
}

export type SocialAuthErrorCode =
  | 'cancelled'
  | 'popup-blocked'
  | 'account-exists'
  | 'invalid-phone'
  | 'invalid-code'
  | 'code-expired'
  | 'too-many-requests'
  | 'failed';

export class SocialAuthError extends Error {
  constructor(public code: SocialAuthErrorCode, public provider: SocialProvider) {
    super(`${provider}: ${code}`);
  }
}

export interface SocialAuthService {
  signInWithGoogle(intent: AuthIntent): Promise<SocialProfile>;
  /** Trimite codul SMS. `phone` e în format internațional (+37369123456). */
  sendPhoneCode(phone: string): Promise<PhoneVerification>;
  confirmPhoneCode(verification: PhoneVerification, code: string, intent: AuthIntent): Promise<SocialProfile>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Demonstrativ: simulează furnizorii. Orice cod de 6 cifre e acceptat, cu excepția „000000”
 * (util ca să vezi mesajul de cod greșit).
 */
export const mockSocialAuth: SocialAuthService = {
  async signInWithGoogle(intent) {
    await wait(1100);
    return { provider: 'google', name: 'Andrei Rusu', email: 'andrei.rusu@gmail.com', isNewUser: intent === 'signup' };
  },
  async sendPhoneCode(phone) {
    await wait(900);
    return { phone, handle: null };
  },
  async confirmPhoneCode(verification, code, intent) {
    await wait(800);
    if (code === '000000') throw new SocialAuthError('invalid-code', 'phone');
    return intent === 'signup'
      ? { provider: 'phone', name: '', email: '', phone: verification.phone, isNewUser: true }
      : { provider: 'phone', name: 'Ana Ciobanu', email: 'ana.ciobanu@exemplu.md', phone: verification.phone, isNewUser: false };
  },
};

export const socialAuth: SocialAuthService = mockSocialAuth;
