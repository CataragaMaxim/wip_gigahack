export type CategoryKey = 'utilitati' | 'telecom' | 'drumuri' | 'transport' | 'urban';

export type SubtypeKey =
  | 'apa' | 'gaz' | 'electricitate'
  | 'internet' | 'mobil' | 'tv'
  | 'lucrari' | 'inchis' | 'deteriorat'
  | 'traseu' | 'suspendat' | 'intarzieri'
  | 'urbane' | 'eveniment';

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
  /** Numele sursei oficiale (ex. „Premier Energy”). */
  source?: string;
  /** „live” = flux oficial automat. */
  feed?: 'live';
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
  photo?: boolean;
  authorId?: string;
  location: LatLng;
  /** Segmentul de stradă afectat. */
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

export type LocationKind = 'home' | 'work' | 'person';

/** Documentul `users/{uid}/locations/{id}`. */
export interface SavedLocation {
  id: string;
  kind: LocationKind;
  name: string;
  address: string;
  location: LatLng;
  prefs: Record<CategoryKey, boolean>;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Street {
  id: string;
  name: string;
  district: string;
  path: LatLng[];
}
