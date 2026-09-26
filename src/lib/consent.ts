import { clearPreferences, load, save } from './storage';

/** Alegerea din bannerul de cookie-uri. `necessary` e mereu adevărat (stocarea strict necesară). */
export interface Consent {
  necessary: true;
  preferences: boolean;
  /** Data alegerii (ISO), pentru dovada consimțământului. */
  at: string;
  /** Versiunea politicii la care s-a răspuns; la o versiune nouă, bannerul reapare. */
  version: number;
}

/** Crește când se schimbă categoriile sau scopurile stocării: utilizatorii sunt întrebați din nou. */
export const CONSENT_VERSION = 1;

export function loadConsent(): Consent | null {
  const c = load<Consent | null>('wip.consent', null);
  return c && c.version === CONSENT_VERSION ? c : null;
}

export function saveConsent(preferences: boolean): Consent {
  const c: Consent = { necessary: true, preferences, at: new Date().toISOString(), version: CONSENT_VERSION };
  save('wip.consent', c);
  if (!preferences) clearPreferences();
  return c;
}
