/** localStorage sigur (poate lipsi în modul privat sau în iframe-uri). */
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
    window.localStorage.setItem(key, JSON.stringify(value));
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
