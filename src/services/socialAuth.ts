/**
 * Autentificarea prin Google (Gmail) și Facebook — DOAR interfața și o implementare demonstrativă.
 *
 * Pentru conectarea reală (ex. Firebase Auth):
 *   - Google:   signInWithPopup(auth, new GoogleAuthProvider())
 *   - Facebook: signInWithPopup(auth, new FacebookAuthProvider())
 * apoi întoarce un `SocialProfile`. `isNewUser` vine din getAdditionalUserInfo(result)?.isNewUser.
 * Erorile se traduc în `SocialAuthError`:
 *   - 'auth/popup-closed-by-user', 'auth/cancelled-popup-request' → 'cancelled'
 *   - 'auth/popup-blocked'                                         → 'popup-blocked'
 *   - 'auth/account-exists-with-different-credential'              → 'account-exists'
 *   - orice altceva                                                → 'failed'
 * UI-ul (AuthDialog) nu trebuie modificat.
 */

export type SocialProvider = 'google' | 'facebook';

export const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

export interface SocialProfile {
  provider: SocialProvider;
  name: string;
  email: string;
  /** Contul a fost creat acum: mai cerem adresa „Acasă” și acordul pentru termeni. */
  isNewUser: boolean;
}

export type SocialAuthErrorCode = 'cancelled' | 'popup-blocked' | 'account-exists' | 'failed';

export class SocialAuthError extends Error {
  constructor(public code: SocialAuthErrorCode, public provider: SocialProvider) {
    super(`${provider}: ${code}`);
  }
}

export interface SocialAuthService {
  signIn(provider: SocialProvider, intent: 'signup' | 'login'): Promise<SocialProfile>;
}

/** Demonstrativ: simulează fereastra furnizorului și întoarce un profil fictiv. */
export const mockSocialAuth: SocialAuthService = {
  async signIn(provider, intent) {
    await new Promise((r) => setTimeout(r, 1100));
    return {
      provider,
      name: 'Andrei Rusu',
      email: provider === 'google' ? 'andrei.rusu@gmail.com' : 'andrei.rusu@exemplu.md',
      isNewUser: intent === 'signup',
    };
  },
};

export const socialAuth: SocialAuthService = mockSocialAuth;
