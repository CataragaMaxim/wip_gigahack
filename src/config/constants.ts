/**
 * Constante de produs — ajustabile de echipă fără a atinge componentele.
 */
export const CONFIG = {
  /** Confirmări necesare ca o raportare să devină „Confirmat” și publică. */
  CONFIRM_THRESHOLD: 3,
  /** „Contestat” = negări > confirmări și cel puțin atâtea negări. */
  CONTEST_MIN_DENIALS: 3,
  /** Poți vota doar dacă ești la cel mult atâția metri. */
  VOTE_RADIUS_M: 1000,
  /** Raza în care căutăm raportări similare înainte de a crea una nouă. */
  DEDUP_RADIUS_M: 300,
  /** O raportare neconfirmată expiră după atâtea ore. */
  REPORT_EXPIRY_H: 6,
  /** O raportare confirmată, fără activitate, expiră după atâtea ore. */
  CONFIRMED_EXPIRY_H: 24,
  /** Limita de caractere a descrierii. */
  DESCRIPTION_MAX: 280,
  /** O adresă salvată e „afectată” dacă e la cel mult atâția metri de eveniment. */
  IMPACT_RADIUS_M: 250,
  /** Opțiunile de rază din Setări (metri; 'all' = tot orașul). */
  RADIUS_OPTIONS: ['all', 1000, 2000, 5000] as const,
  /** Durata animației de estompare la filtrare (ms). */
  FADE_MS: 300,
} as const;

export type RadiusOption = (typeof CONFIG.RADIUS_OPTIONS)[number];

export const MAP = {
  CENTER: { lat: 47.0165, lng: 28.8420 },
  ZOOM: 13,
  MIN_ZOOM: 11,
  MAX_ZOOM: 18,
  TILES_LIGHT:
    import.meta.env.VITE_TILES_LIGHT ?? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  TILES_DARK:
    import.meta.env.VITE_TILES_DARK ?? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/** Locație demonstrativă (Botanica), folosită când VITE_USE_DEMO_LOCATION=true. */
export const DEMO_USER_LOCATION = { lat: 46.9882, lng: 28.8695 };
export const USE_DEMO_LOCATION = (import.meta.env.VITE_USE_DEMO_LOCATION ?? 'true') !== 'false';
