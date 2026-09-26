/** Platforma acoperă doar utilitățile. */
export type CategoryKey = 'utilitati';

/** Tipurile de eveniment: apă, gaz, electricitate. */
export type SubtypeKey = 'apa' | 'gaz' | 'electricitate';

export type SourceType = 'official' | 'citizen';
export type Severity = 'total' | 'partial';
export type Status = 'oficial' | 'confirmat' | 'raportat' | 'contestat' | 'rezolvat' | 'expirat';
export type Theme = 'light' | 'dark' | 'system';
export type Vote = 'yes' | 'no';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Documentul `events/{id}` (formă compatibilă cu Firestore). Datele calendaristice sunt ISO 8601. */
export interface UrbanEvent {
  id: string;
  category: CategoryKey;
  subtype: SubtypeKey;
  title: string;
  sourceType: SourceType;
  source?: string;
  feed?: 'live';
  /** Deconectare anunțată din timp (ex. „Sistări planificate” de pe acc.md) — apare în calendar. */
  planned?: boolean;
  severity: Severity;
  district: string;
  streets: string[];
  startAt?: string;
  endAt?: string;
  updatedAt?: string;
  reportedAt?: string;
  resolvedAt?: string;
  confirmations: number;
  denials: number;
  description?: string;
  /** URL extern sau dataURL (base64) pentru fotografie; lipsă = fără fotografie. */
  photo?: string;
  authorId?: string;
  location: LatLng;
  path?: LatLng[];
}

/** Eveniment îmbogățit pe client (status, distanță, locațiile afectate). */
export interface DerivedEvent extends UrbanEvent {
  status: Status;
  conf: number;
  den: number;
  distanceM: number | null;
  affects: string[];
}

/** Documentul `users/{uid}/locations/{id}` — formă veche păstrată pentru compatibilitate cu mockUser. */
export interface SavedLocation {
  id: string;
  kind: 'home' | 'work' | 'person';
  name: string;
  address: string;
  location: LatLng;
  prefs: Record<CategoryKey, boolean>;
}

export interface Street {
  id: string;
  name: string;
  district: string;
  path: LatLng[];
}

/** Re-exportă tipurile de user. */
export * from './user';