/**
 * localStorage sigur (poate lipsi în modul privat sau în iframe-uri), cu respectarea consimțământului:
 * cheile de „preferințe” se scriu pe dispozitiv doar dacă utilizatorul le-a acceptat (vezi src/lib/consent.ts
 * și politica de cookie-uri). Fără consimțământ, preferințele funcționează doar în sesiunea curentă.
 */

/** Stocare strict necesară (serviciul nu funcționează corect fără ea) — nu cere consimțământ. */
export const NECESSARY_KEYS = [
  'wip.consent', // alegerea din bannerul de cookie-uri
  'wip.deviceId', // un singur vot pe dispozitiv
  'wip.votes', // voturile date de pe acest dispozitiv
  'wip.userReports', // raportările proprii până sosesc din server
  'wip.deleted', // raportările proprii șterse
  'wip.dataVersion', // versiunea datelor locale
] as const;

/** Preferințe — se păstrează doar cu consimțământ. */
export const PREFERENCE_KEYS = [
  'wip.lang', // limba
  'wip.theme', // tema
  'wip.radius', // raza afișată
  'wip.manualPlace', // adresa introdusă când GPS-ul nu e disponibil
  'wip.onboarded', // ghidul de la prima vizită a fost văzut
  'wip.promptDismissed', // întrebările „Ai și tu problema asta?” închise
] as const;

const isPreference = (key: string) => (PREFERENCE_KEYS as readonly string[]).includes(key);

/** Consimțământul pentru preferințe (citit direct, ca `save` să nu depindă de React). */
export function preferencesAllowed(): boolean {
  try {
    const raw = window.localStorage.getItem('wip.consent');
    return !!raw && JSON.parse(raw)?.preferences === true;
  } catch {
    return false;
  }
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    if (isPreference(key) && !preferencesAllowed()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorat */
  }
}

/** La retragerea consimțământului: șterge preferințele deja salvate. */
export function clearPreferences(): void {
  try {
    PREFERENCE_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignorat */
  }
}

/** Șterge cheile date dacă versiunea datelor s-a schimbat (ex. setul demonstrativ de alerte a fost înlocuit). */
export function resetIfStale(version: string, keys: string[]): void {
  if (load<string | null>('wip.dataVersion', null) === version) return;
  try {
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignorat */
  }
  save('wip.dataVersion', version);
}
