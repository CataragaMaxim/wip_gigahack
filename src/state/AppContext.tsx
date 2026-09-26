import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import L, { type Map as LeafletMap } from 'leaflet';
import { flushSync } from 'react-dom';
import { CONFIG, DEMO_USER_LOCATION, USE_DEMO_LOCATION, type RadiusOption } from '@/config/constants';
import { ALL_TYPES_ON, SUBTYPE_TITLE_RO, isKnownType } from '@/config/categories';
import { ALL_CATEGORIES_ON } from '@/data/mockUser';
import { distanceToEvent } from '@/lib/geo';
import { activeOnDay, deriveStatus, isClosed, isOnMapNow, isPublic } from '@/lib/status';
import { fromKey } from '@/lib/days';
import { load, resetIfStale, save } from '@/lib/storage';
import { normalize } from '@/lib/format';
import { eventsService } from '@/services/eventsService';
import { matchStreet, type StreetMatch } from '@/services/streetMatch';
import type { GeoResult } from '@/services/geocoding';
import { applyLang, getLang, t, type Lang } from '@/i18n';
import {
  watchAuth,
  logInWithEmail,
  signUpWithEmail,
  logInWithGoogle,
  sendPhoneCode,
  confirmPhoneCode,
  logOutUser,
} from '@/services/authService';
import {
  upsertUserLocation,
  deleteUserLocation,
  deleteUserProfile,
  bumpUserStats,
  recordHistory,
} from '@/services/userService';
import type { UserProfile, SavedLocationDoc } from '@/types/user';
import type {
  CategoryKey, DerivedEvent, LatLng, Severity, SubtypeKey, Theme, UrbanEvent, Vote,
} from '@/types';

/** Crește la fiecare schimbare a setului de alerte demonstrative. */
const DATA_VERSION = '2026-09-real-streets';
resetIfStale(DATA_VERSION, ['wip.userReports', 'wip.deleted', 'wip.votes']);

export type PanelMode = 'list' | 'detail' | 'settings' | 'calendar';
/** Pozițiile bottom sheet-ului pe mobil. */
export type SheetSnap = 'mini' | 'mid' | 'tall';
export const SHEET_SNAPS: SheetSnap[] = ['mini', 'mid', 'tall'];
export type AuthMode = 'signup' | 'login' | 'forgot' | 'sent';
export type AuthAfter = null | 'report' | { follow: string };
export type ReportStep = 1 | 2 | 3 | 4 | 5 | 'done';

export interface ReportDraft {
  step: ReportStep;
  category: CategoryKey | null;
  subtype: SubtypeKey | null;
  pin: LatLng | null;
  street: StreetMatch | null;
  locating: boolean;
  pinChoice: string | null;
  duplicateId: string | null;
  duplicateDistanceM: number | null;
  noDuplicate: boolean;
  description: string;
  /** URL / dataURL; null = fără fotografie. */
  photo: string | null;
  severity: Severity;
  resultId: string | null;
  confirmedDuplicate: boolean;
}

const emptyReport = (): ReportDraft => ({
  step: 1, category: null, subtype: null, pin: null, street: null, locating: false, pinChoice: null,
  duplicateId: null, duplicateDistanceM: null,
  noDuplicate: false, description: '', photo: null, severity: 'total', resultId: null, confirmedDuplicate: false,
});

type LoadState = 'loading' | 'ready' | 'error';
type GpsState = 'demo' | 'pending' | 'granted' | 'manual' | 'denied' | 'unsupported';

export interface ManualPlace {
  label: string;
  location: LatLng;
}

interface Session {
  user: UserProfile | null;
  locations: SavedLocationDoc[];
}

/**
 * Un anunț oficial cu mai multe adrese devine câte un eveniment pe adresă (zonă mică, 25–55 m),
 * ca pe hartă să nu apară cercuri mari suprapuse. Id-ul zonei: `${anunț}~${index}`.
 */
function splitAreas(e: UrbanEvent): (UrbanEvent & { parentId?: string; allStreets?: string[] })[] {
  if (!e.areas?.length) return [e];
  if (e.areas.length === 1) {
    const a = e.areas[0];
    return [{ ...e, location: { lat: a.lat, lng: a.lng }, radiusM: a.radiusM }];
  }
  return e.areas.map((a, i) => ({
    ...e,
    id: `${e.id}~${i}`,
    parentId: e.id,
    allStreets: e.streets,
    streets: [a.label],
    location: { lat: a.lat, lng: a.lng },
    radiusM: a.radiusM,
    areas: undefined,
  }));
}

/** Documentul unei adrese salvate, dintr-o adresă aleasă din căutare. */
function placeDoc(kind: SavedLocationDoc['kind'], name: string, p: GeoResult): Omit<SavedLocationDoc, 'id'> {
  return {
    kind,
    name,
    address: p.detail ? `${p.label}, ${p.detail}` : p.label,
    location: p.location,
    prefs: { ...ALL_CATEGORIES_ON },
  };
}

function useAppStore() {
  // ---------- preferințe ----------
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('wip.theme', 'system'));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [radius, setRadius] = useState<RadiusOption>(() => load<RadiusOption>('wip.radius', 'all'));
  // Limba: `t()` citește limba curentă din modulul i18n; schimbarea stării re-randează toată aplicația.
  const [lang, setLangState] = useState<Lang>(getLang);
  const setLang = useCallback((l: Lang) => {
    const apply = () => {
      applyLang(l);
      setLangState(l);
    };
    // Tranziție la schimbarea limbii: cross-fade (View Transitions) sau o estompare scurtă, fără animație la „reduce motion”.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!reduce && doc.startViewTransition) {
      doc.startViewTransition(() => flushSync(apply));
    } else if (!reduce) {
      document.documentElement.classList.add('is-lang-switching');
      window.setTimeout(() => {
        apply();
        window.setTimeout(() => document.documentElement.classList.remove('is-lang-switching'), 20);
      }, 150);
    } else {
      apply();
    }
  }, []);
  useEffect(() => save('wip.theme', theme), [theme]);
  useEffect(() => save('wip.radius', radius), [radius]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // ---------- sesiune (Firebase Auth) ----------
  const [session, setSession] = useState<Session>({ user: null, locations: [] });
  const { user, locations } = session;

  // Ascultă schimbările de auth din Firebase.
  useEffect(() => {
    const unsub = watchAuth(({ profile, locations: locs }) => {
      setSession({ user: profile, locations: locs });
    });
    return () => unsub();
  }, []);

  // ---------- date ----------
  const [raw, setRaw] = useState<UrbanEvent[]>([]);
  const [userReports, setUserReports] = useState<UrbanEvent[]>(() => load('wip.userReports', []));
  const [deletedIds, setDeletedIds] = useState<Record<string, true>>(() => load('wip.deleted', {}));
  const [votes, setVotes] = useState<Record<string, Vote>>(() => load('wip.votes', {}));
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  useEffect(() => save('wip.userReports', userReports), [userReports]);
  useEffect(() => save('wip.deleted', deletedIds), [deletedIds]);
  useEffect(() => save('wip.votes', votes), [votes]);

  // Evenimentele în timp real: o raportare nouă a unui vecin (și întrebarea „Ai și tu problema asta?”)
  // apare imediat, fără reîncărcarea paginii. `fetchEvents` (butonul „Reîncearcă”) repornește ascultarea.
  const [subscription, setSubscription] = useState(0);
  const fetchEvents = useCallback(async () => {
    setLoadState('loading');
    setSubscription((n) => n + 1);
  }, []);
  useEffect(() => {
    return eventsService.subscribe(
      (list) => {
        setRaw(list);
        setSyncedAt(new Date());
        setLoadState('ready');
      },
      () => setLoadState('error'),
    );
  }, [subscription]);

  // ---------- conexiune ----------
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const [modal, setModal] = useState<null | 'report' | 'auth' | 'location' | 'help'>(null);

  // ---------- locație ----------
  const [gps, setGps] = useState<GpsState>(USE_DEMO_LOCATION ? 'demo' : 'pending');
  const [userPos, setUserPos] = useState<LatLng | null>(USE_DEMO_LOCATION ? DEMO_USER_LOCATION : null);
  const [manualPlace, setManualPlace] = useState<ManualPlace | null>(() => load<ManualPlace | null>('wip.manualPlace', null));
  useEffect(() => save('wip.manualPlace', manualPlace), [manualPlace]);

  const fallBackToManual = useCallback((state: 'denied' | 'unsupported') => {
    const saved = load<ManualPlace | null>('wip.manualPlace', null);
    if (saved) {
      setUserPos(saved.location);
      setGps('manual');
      return;
    }
    setGps(state);
    setModal((m) => m ?? 'location');
  }, []);

  const requestLocation = useCallback((): Promise<LatLng | null> => {
    if (USE_DEMO_LOCATION) return Promise.resolve(DEMO_USER_LOCATION);
    if (!('geolocation' in navigator)) {
      setGps('unsupported');
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
          setUserPos(pos);
          setGps('granted');
          setModal((m) => (m === 'location' ? null : m));
          resolve(pos);
        },
        () => {
          setGps((g) => (g === 'manual' ? g : 'denied'));
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }, []);

  useEffect(() => {
    if (USE_DEMO_LOCATION) return;
    if (!('geolocation' in navigator)) {
      fallBackToManual('unsupported');
      return;
    }
    let hadFix = false;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        hadFix = true;
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGps('granted');
      },
      (err) => {
        if (hadFix && err.code !== err.PERMISSION_DENIED) return;
        navigator.geolocation.clearWatch(watchId);
        fallBackToManual('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [fallBackToManual]);

  // ---------- UI ----------
  /** Filtrele de pe hartă: câte unul pe tip (apă, gaz, electricitate). */
  const [types, setTypes] = useState<Record<SubtypeKey, boolean>>({ ...ALL_TYPES_ON });
  const [fadingTypes, setFadingTypes] = useState<Partial<Record<SubtypeKey, true>>>({});
  const fadeTimers = useRef<Partial<Record<SubtypeKey, number>>>({});
  const [search, setSearch] = useState('');
  /** Lista arată doar aceste evenimente (grupul de pe hartă cu mai multe evenimente în același loc). */
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  /**
   * Previzualizare din calendar: o zi (`days: 1`) sau o săptămână (`days: 7`, de luni) — harta arată evenimentele
   * active în acel interval. `start` = „2026-09-28”.
   */
  const [preview, setPreviewState] = useState<{ start: string; days: 1 | 7 } | null>(null);
  const setPreview = useCallback((p: { start: string; days: 1 | 7 } | null) => {
    setPreviewState(p);
    setFocusIds(null);
  }, []);
  const [mode, setMode] = useState<PanelMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** De unde s-a deschis detaliul — „Înapoi” revine acolo. */
  const [detailFrom, setDetailFrom] = useState<'list' | 'calendar'>('list');
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('mini');
  const cycleSheet = useCallback(
    () => setSheetSnap((s) => SHEET_SNAPS[(SHEET_SNAPS.indexOf(s) + 1) % SHEET_SNAPS.length]),
    [],
  );
  const sheetPx = useRef(92);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authAfter, setAuthAfter] = useState<AuthAfter>(null);
  const [report, setReport] = useState<ReportDraft>(emptyReport);
  const [following, setFollowing] = useState<Record<string, true>>({});
  const [deleteAsk, setDeleteAsk] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const flash = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---------- harta ----------
  const mapRef = useRef<LeafletMap | null>(null);
  const [tilesReady, setTilesReady] = useState(false);
  const mapInsets = useRef({ left: 0, top: 0, bottom: 0 });

  const flyTo = useCallback((p: LatLng, zoom?: number) => {
    const m = mapRef.current;
    if (!m) return;
    const z = zoom ?? Math.max(m.getZoom(), 15);
    const { left, top, bottom } = mapInsets.current;
    const pt = m.project([p.lat, p.lng], z).subtract([left / 2, (top - bottom) / 2]);
    m.flyTo(m.unproject(pt, z), z, { duration: 0.6 });
  }, []);

  /** Încadrează cercurile razei în jurul tuturor punctelor (locația curentă și adresele salvate). */
  const fitRadius = useCallback((centers: LatLng[], radiusM: number) => {
    const m = mapRef.current;
    if (!m || !centers.length) return;
    const { left, top, bottom } = mapInsets.current;
    const bounds = centers.reduce(
      (b, c) => b.extend(L.latLng(c.lat, c.lng).toBounds(radiusM * 2)),
      L.latLng(centers[0].lat, centers[0].lng).toBounds(radiusM * 2),
    );
    m.flyToBounds(bounds, {
      paddingTopLeft: [left + 24, top + 32],
      paddingBottomRight: [24, bottom + 24],
      duration: 0.6,
    });
  }, []);

  const visibleCenter = useCallback((): LatLng | null => {
    const m = mapRef.current;
    if (!m) return null;
    const { left, top, bottom } = mapInsets.current;
    const size = m.getSize();
    const c = m.containerPointToLatLng([size.x / 2 + left / 2, size.y / 2 + (top - bottom) / 2]);
    return { lat: c.lat, lng: c.lng };
  }, []);

  // ---------- evenimente derivate ----------
  /** Punctele în jurul cărora se aplică raza: locația curentă și adresele salvate. */
  const anchors = useMemo(() => [...(userPos ? [userPos] : []), ...locations.map((l) => l.location)], [userPos, locations]);

  const events: DerivedEvent[] = useMemo(() => {
    // Raportările proprii rămân local până le aduce și lista din Firestore (fără dubluri după reîncărcare).
    const rawIds = new Set(raw.map((e) => e.id));
    return raw
      .concat(userReports.filter((e) => !rawIds.has(e.id)))
      .flatMap(splitAreas)
      .filter((e) => !deletedIds[e.id] && isKnownType(e.subtype))
      .map((e) => {
        const v = votes[e.id];
        const yes = v === 'yes' ? 1 : 0;
        const no = v === 'no' ? 1 : 0;
        const status = deriveStatus(e, yes, no);
        const active = !isClosed(status) && status !== 'contestat';
        return {
          ...e,
          status,
          conf: e.confirmations + yes,
          den: e.denials + no,
          distanceM: userPos ? distanceToEvent(userPos, e) : null,
          nearM: anchors.length ? Math.min(...anchors.map((p) => distanceToEvent(p, e))) : null,
          affects:
            user && active
              ? locations
                  .filter((l) => l.prefs[e.category] && distanceToEvent(l.location, e) <= CONFIG.IMPACT_RADIUS_M)
                  .map((l) => l.name)
              : [],
        };
      });
  }, [raw, userReports, deletedIds, votes, userPos, anchors, user, locations]);

  // Ceasul pentru fereastra hărții: un eveniment programat apare singur pe hartă când intră în următoarele 24 h.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const cityActiveCount = useMemo(
    () => events.filter((e) => (e.status === 'oficial' || e.status === 'confirmat') && isOnMapNow(e, now)).length,
    [events, now],
  );
  /** Evenimentele programate mai târziu de 24 h (sunt doar în calendar). */
  const laterCount = useMemo(
    () => new Set(events.filter((e) => isPublic(e) && !isOnMapNow(e, now)).map((e) => e.parentId ?? e.id)).size,
    [events, now],
  );

  const byId = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);
  const selected = selectedId ? byId[selectedId] ?? null : null;

  const visible = useMemo(() => {
    const q = normalize(search.trim());
    return events
      .filter((e) => {
        if (!types[e.subtype] && !fadingTypes[e.subtype]) return false;
        if (preview) {
          // Ziua / săptămâna aleasă din calendar: tot ce e programat sau raportat atunci (fără ce a fost rezolvat sau contestat).
          if (e.status === 'rezolvat' || e.status === 'contestat' || !activeOnDay(e, fromKey(preview.start), preview.days)) return false;
        } else {
          if (!isPublic(e)) return false;
          // Doar evenimentele în curs și cele din următoarele 24 h; restul apar la timpul lor (și în calendar).
          if (!isOnMapNow(e, now)) return false;
        }
        if (focusIds && !focusIds.includes(e.id)) return false;
        // Raza se aplică în jurul locației curente și al fiecărei adrese salvate (Acasă + celelalte).
        if (radius !== 'all' && e.nearM != null && e.nearM > radius) return false;
        if (q && !normalize(`${e.title} ${e.district} ${e.streets.join(' ')}`).includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const aa = a.affects.length ? 0 : 1;
        const bb = b.affects.length ? 0 : 1;
        if (aa !== bb) return aa - bb;
        if (a.nearM != null && b.nearM != null && Math.abs(a.nearM - b.nearM) > 20) {
          return a.nearM - b.nearM;
        }
        const t = (e: UrbanEvent) => new Date(e.updatedAt ?? e.reportedAt ?? e.startAt ?? 0).getTime();
        return t(b) - t(a);
      });
  }, [events, types, fadingTypes, user, radius, search, focusIds, now, preview]);

  // ---------- acțiuni ----------
  const toggleType = useCallback((k: SubtypeKey) => {
    setTypes((c) => {
      const on = c[k];
      window.clearTimeout(fadeTimers.current[k]);
      if (on) {
        setFadingTypes((f) => ({ ...f, [k]: true }));
        fadeTimers.current[k] = window.setTimeout(() => {
          setFadingTypes((f) => {
            const n = { ...f };
            delete n[k];
            return n;
          });
        }, CONFIG.FADE_MS);
      } else {
        setFadingTypes((f) => {
          const n = { ...f };
          delete n[k];
          return n;
        });
      }
      return { ...c, [k]: !on };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setTypes({ ...ALL_TYPES_ON });
    setRadius('all');
    setSearch('');
  }, []);

  const openEvent = useCallback(
    (id: string, from: 'list' | 'calendar' = 'list') => {
      setDetailFrom(from);
      setSelectedId(id);
      setMode('detail');
      setPanelOpen(true);
      setDeleteAsk(null);
      setSheetSnap((s) => (s === 'mini' ? 'mid' : s));
      const e = byId[id];
      if (e) flyTo(e.location);
    },
    [byId, flyTo],
  );

  const backToList = useCallback(() => {
    setMode('list');
    setSelectedId(null);
    setDeleteAsk(null);
  }, []);
  /** Închide detaliul: înapoi în calendar dacă de acolo a fost deschis, altfel la listă. */
  const closeDetail = useCallback(() => {
    setMode(detailFrom);
    setSelectedId(null);
    setDeleteAsk(null);
  }, [detailFrom]);
  const openCalendar = useCallback(() => {
    setMode('calendar');
    setSelectedId(null);
    setPanelOpen(true);
    setSheetSnap('tall');
  }, []);
  const openSettings = useCallback(() => {
    setMode('settings');
    setSelectedId(null);
    setPanelOpen(true);
    setSheetSnap('tall');
  }, []);

  const locateMe = useCallback(async () => {
    const p = userPos ?? (await requestLocation());
    if (!p) {
      setModal('location');
      return;
    }
    setGpsNotice(false);
    flyTo(p, CONFIG.LOCATE_ZOOM);
  }, [userPos, requestLocation, flyTo]);

  const openLocationPicker = useCallback(() => setModal('location'), []);

  const setManualLocation = useCallback(
    (place: ManualPlace, opts: { fly?: boolean } = {}) => {
      setManualPlace(place);
      setUserPos(place.location);
      setGps('manual');
      setGpsNotice(false);
      setModal((m) => (m === 'location' ? null : m));
      if (opts.fly !== false) window.setTimeout(() => flyTo(place.location, 17), 50);
    },
    [flyTo],
  );

  const vote = useCallback(
    async (id: string, v: Vote) => {
      if (votes[id]) return;
      const ev = byId[id];
      if (!ev) return;
      setVotes((s) => ({ ...s, [id]: v }));
      await eventsService.vote(id, v);

      if (user) {
        await Promise.all([
          bumpUserStats(user.uid, { [v === 'yes' ? 'confirmations' : 'denials']: 1 }),
          recordHistory(user.uid, {
            eventId: id,
            kind: v === 'yes' ? 'confirmed' : 'denied',
            title: ev.title,
            category: ev.category,
          }),
        ]);
      }
      flash(t('Mulțumim! Răspunsul tău a fost înregistrat.'));
    },
    [votes, byId, user, flash],
  );

  const openAuth = useCallback((m: AuthMode, after: AuthAfter = null) => {
    setAuthMode(m);
    setAuthAfter(after);
    setModal('auth');
  }, []);

  const toggleFollow = useCallback(
    (id: string) => {
      if (!user) {
        openAuth('signup', { follow: id });
        return;
      }
      setFollowing((f) => {
        const n = { ...f };
        if (n[id]) delete n[id];
        else n[id] = true;
        flash(n[id] ? t('Urmărești evenimentul.') : t('Nu mai urmărești evenimentul'));
        return n;
      });
    },
    [user, openAuth, flash],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string, home: GeoResult | null) => {
      try {
        const profile = await signUpWithEmail(name, email, password);
        if (home) {
          const doc = placeDoc('home', 'Acasă', home);
          await upsertUserLocation(profile.uid, 'acasa', doc);
          setSession((ss) => ({ ...ss, locations: [{ ...doc, id: 'acasa' }, ...ss.locations.filter((l) => l.id !== 'acasa')] }));
        }
        setModal(null);
        if (authAfter === 'report') {
          setReport(emptyReport());
          setModal('report');
        } else if (authAfter && typeof authAfter === 'object') {
          setFollowing((f) => ({ ...f, [authAfter.follow]: true }));
        }
        setAuthAfter(null);
        flash(t('Cont creat. Bine ai venit, {name}!', { name: name.split(' ')[0] }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        flash(msg.includes('email-already-in-use')
          ? t('Există deja un cont cu acest email.')
          : t('Nu am putut crea contul. Încearcă din nou.'));
      }
    },
    [authAfter, flash],
  );

  const logIn = useCallback(
    async (email: string, password: string) => {
      try {
        await logInWithEmail(email, password);
        setModal(null);
        if (authAfter === 'report') {
          setReport(emptyReport());
          setModal('report');
        } else if (authAfter && typeof authAfter === 'object') {
          setFollowing((f) => ({ ...f, [authAfter.follow]: true }));
        }
        setAuthAfter(null);
        flash(t('Te-ai autentificat'));
      } catch {
        flash(t('Email sau parolă incorectă.'));
      }
    },
    [authAfter, flash],
  );

  const logInGoogle = useCallback(async () => {
    try {
      await logInWithGoogle();
      setModal(null);
      if (authAfter === 'report') {
        setReport(emptyReport());
        setModal('report');
      } else if (authAfter && typeof authAfter === 'object') {
        setFollowing((f) => ({ ...f, [authAfter.follow]: true }));
      }
      setAuthAfter(null);
      flash(t('Te-ai autentificat cu Google'));
    } catch {
      flash(t('Autentificarea cu Google a eșuat.'));
    }
  }, [authAfter, flash]);

  const requestPhoneCode = useCallback(
    async (phone: string, containerId: string) => {
      try {
        await sendPhoneCode(phone, containerId);
        flash(t('Codul a fost trimis prin SMS.'));
      } catch {
        flash(t('Nu am putut trimite codul. Verifică numărul.'));
      }
    },
    [flash],
  );

  const verifyPhoneCode = useCallback(
    async (code: string) => {
      try {
        await confirmPhoneCode(code);
        setModal(null);
        if (authAfter === 'report') {
          setReport(emptyReport());
          setModal('report');
        } else if (authAfter && typeof authAfter === 'object') {
          setFollowing((f) => ({ ...f, [authAfter.follow]: true }));
        }
        setAuthAfter(null);
        flash(t('Te-ai autentificat cu telefonul'));
      } catch {
        flash(t('Cod incorect.'));
      }
    },
    [authAfter, flash],
  );

  const logOut = useCallback(async () => {
    await logOutUser();
    setFollowing({});
    setMode('list');
    flash(t('Ai ieșit din cont'));
  }, [flash]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    await deleteUserProfile(user.uid);
    await logOutUser();
    setUserReports([]);
    setMode('list');
    flash(t('Contul a fost șters'));
  }, [user, flash]);

  /** Setează sau schimbă adresa „Acasă”. */
  const setHomeLocation = useCallback(
    async (place: GeoResult) => {
      if (!user) return;
      const doc = placeDoc('home', 'Acasă', place);
      await upsertUserLocation(user.uid, 'acasa', doc);
      setSession((ss) => ({ ...ss, locations: [{ ...doc, id: 'acasa' }, ...ss.locations.filter((l) => l.kind !== 'home')] }));
      flash(t('Adresa de acasă a fost salvată'));
    },
    [user, flash],
  );
  /** Adaugă o adresă suplimentară (max. CONFIG.MAX_EXTRA_ADDRESSES pe lângă „Acasă”). */
  const addLocation = useCallback(
    async (name: string, place: GeoResult) => {
      if (!user) return;
      if (locations.filter((l) => l.kind !== 'home').length >= CONFIG.MAX_EXTRA_ADDRESSES) {
        flash(t('Poți salva cel mult {n} adrese pe lângă „Acasă”.', { n: CONFIG.MAX_EXTRA_ADDRESSES }));
        return;
      }
      const locId = `l-${Date.now()}`;
      const doc = placeDoc('other', name.trim(), place);
      await upsertUserLocation(user.uid, locId, doc);
      setSession((ss) => ({ ...ss, locations: [...ss.locations, { ...doc, id: locId }] }));
      flash(t('Adresa „{name}” a fost salvată', { name: doc.name }));
    },
    [user, locations, flash],
  );
  const removeLocation = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteUserLocation(user.uid, id);
      setSession((ss) => ({ ...ss, locations: ss.locations.filter((l) => l.id !== id) }));
      flash(t('Adresa a fost ștearsă'));
    },
    [user, flash],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      setDeletedIds((d) => ({ ...d, [id]: true }));
      setUserReports((r) => r.filter((e) => e.id !== id));
      await eventsService.remove(id);
      if (user) await bumpUserStats(user.uid, { reports: -1 });
      setDeleteAsk(null);
      if (selectedId === id) backToList();
      flash(t('Raportarea a fost ștearsă'));
    },
    [selectedId, backToList, user, flash],
  );

  // ---------- raportare ----------
  const openReport = useCallback(() => {
    if (!online) {
      flash(t('Raportarea necesită conexiune la internet'));
      return;
    }
    if (!user) {
      openAuth('signup', 'report');
      return;
    }
    setReport(emptyReport());
    setSheetSnap('mini');
    setModal('report');
  }, [online, user, openAuth, flash]);

  const closeReport = useCallback(() => {
    setModal(null);
    setReport(emptyReport());
  }, []);

  const patchReport = useCallback(
    (p: Partial<ReportDraft>) => setReport((r) => ({ ...r, ...p })),
    [],
  );

  const goToPinStep = useCallback(() => {
    const home = locations.find((l) => l.kind === 'home');
    const start = userPos ?? home?.location ?? null;
    patchReport({ step: 2, pinChoice: userPos ? 'gps' : home ? home.id : null });
    if (start) window.setTimeout(() => flyTo(start, 16), 50);
  }, [locations, userPos, patchReport, flyTo]);

  const confirmPin = useCallback(async () => {
    const raw = visibleCenter();
    if (!raw || report.locating) return;
    patchReport({ locating: true });
    const street = await matchStreet(raw);
    const pin = street ? street.snapped : raw;
    let best: DerivedEvent | null = null;
    let bd = Infinity;
    for (const e of events) {
      if (e.category !== report.category || isClosed(e.status)) continue;
      const d = distanceToEvent(pin, e);
      if (d <= CONFIG.DEDUP_RADIUS_M && d < bd) {
        bd = d;
        best = e;
      }
    }
    setReport((r) =>
      r.locating
        ? {
            ...r,
            pin,
            street,
            locating: false,
            step: best ? 3 : 4,
            duplicateId: best?.id ?? null,
            duplicateDistanceM: best ? bd : null,
            noDuplicate: !best,
          }
        : r,
    );
  }, [events, report.category, report.locating, patchReport, visibleCenter]);

  const confirmDuplicate = useCallback(() => {
    const id = report.duplicateId;
    if (!id) return;
    if (!votes[id]) setVotes((s) => ({ ...s, [id]: 'yes' }));
    patchReport({ step: 'done', confirmedDuplicate: true, resultId: id });
  }, [report.duplicateId, votes, patchReport]);

  const submitReport = useCallback(async () => {
    if (!report.pin || !report.category || !report.subtype || !user) return;
    const st = report.street;
    const e: UrbanEvent = {
      id: `u-${Date.now()}`,
      category: report.category,
      subtype: report.subtype,
      title: SUBTYPE_TITLE_RO[report.subtype],
      sourceType: 'citizen',
      authorId: user.uid,
      severity: report.severity,
      district: st?.district ?? '',
      streets: st ? [st.label] : [],
      reportedAt: new Date().toISOString(),
      confirmations: 0,
      denials: 0,
      description: report.description.trim() || undefined,
      photo: report.photo ?? undefined,
      location: report.pin,
      path: st && st.path.length > 1 ? st.path : [report.pin],
    };
    const saved = await eventsService.create(e);
    setUserReports((r) => [...r, saved]);

    await Promise.all([
      bumpUserStats(user.uid, { reports: 1 }),
      recordHistory(user.uid, {
        eventId: saved.id,
        kind: 'created',
        title: saved.title,
        category: saved.category,
        status: 'raportat',
      }),
    ]);

    patchReport({ step: 'done', resultId: saved.id });
  }, [report, user, patchReport]);

  const viewReportResult = useCallback(() => {
    const id = report.resultId;
    closeReport();
    if (id) window.setTimeout(() => openEvent(id), 0);
  }, [report.resultId, closeReport, openEvent]);

  return {
    // preferințe
    theme, setTheme, isDark, radius, setRadius, lang, setLang,
    // sesiune
    user, locations,
    signUp, logIn, logInGoogle, requestPhoneCode, verifyPhoneCode,
    logOut, deleteAccount, addLocation, setHomeLocation, removeLocation,
    // date
    events, visible, byId, selected, loadState, syncedAt, fetchEvents, votes, vote, online,
    userPos, anchors, gps, locateMe, gpsNotice, setGpsNotice, manualPlace, setManualLocation, openLocationPicker,
    // filtre & căutare
    types, fadingTypes, toggleType, resetFilters, search, setSearch, focusIds, setFocusIds, preview, setPreview,
    // panou
    mode, openEvent, backToList, closeDetail, detailFrom, openCalendar, openSettings, panelOpen, setPanelOpen, sheetSnap, setSheetSnap, cycleSheet, sheetPx, cityActiveCount, laterCount,
    following, toggleFollow, deleteAsk, setDeleteAsk, deleteEvent,
    // dialoguri
    modal, setModal, authMode, setAuthMode, authAfter, openAuth,
    report, patchReport, openReport, closeReport, goToPinStep, confirmPin, confirmDuplicate, submitReport, viewReportResult,
    // hartă
    mapRef, mapInsets, flyTo, fitRadius, visibleCenter, tilesReady, setTilesReady,
    toast, flash,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const store = useAppStore();
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

export function useApp(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp trebuie folosit în <AppProvider>');
  return ctx;
}