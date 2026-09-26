import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { CONFIG, DEMO_USER_LOCATION, USE_DEMO_LOCATION, type RadiusOption } from '@/config/constants';
import { SUBTYPES } from '@/config/categories';
import { ALL_CATEGORIES_ON, DEMO_LOCATIONS, DEMO_USER } from '@/data/mockUser';
import { STREETS } from '@/data/streets';
import { distanceToEvent, nearestStreet, segmentAround } from '@/lib/geo';
import { deriveStatus, isClosed, isPublic } from '@/lib/status';
import { load, resetIfStale, save } from '@/lib/storage';
import { normalize } from '@/lib/format';
import { eventsService } from '@/services/eventsService';
import type {
  CategoryKey, DerivedEvent, LatLng, SavedLocation, Severity, SubtypeKey, Theme, UrbanEvent, User, Vote,
} from '@/types';

/** Crește la fiecare schimbare a setului de alerte demonstrative: voturile, ștergerile și raportările vechi se golesc. */
const DATA_VERSION = '2026-09-real-streets';
resetIfStale(DATA_VERSION, ['wip.userReports', 'wip.deleted', 'wip.votes']);

export type PanelMode = 'list' | 'detail' | 'settings';
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
  pinChoice: string | null;
  duplicateId: string | null;
  duplicateDistanceM: number | null;
  noDuplicate: boolean;
  description: string;
  photo: boolean;
  severity: Severity;
  resultId: string | null;
  confirmedDuplicate: boolean;
}

const emptyReport = (): ReportDraft => ({
  step: 1, category: null, subtype: null, pin: null, pinChoice: null, duplicateId: null, duplicateDistanceM: null,
  noDuplicate: false, description: '', photo: false, severity: 'total', resultId: null, confirmedDuplicate: false,
});

type LoadState = 'loading' | 'ready' | 'error';
type GpsState = 'demo' | 'pending' | 'granted' | 'manual' | 'denied' | 'unsupported';

/** Adresa introdusă manual când GPS-ul nu e disponibil (păstrată între vizite). */
export interface ManualPlace {
  label: string;
  location: LatLng;
}

interface Session {
  user: User | null;
  locations: SavedLocation[];
}

function useAppStore() {
  // ---------- preferințe ----------
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('wip.theme', 'system'));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [radius, setRadius] = useState<RadiusOption>(() => load<RadiusOption>('wip.radius', 'all'));
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

  // ---------- sesiune ----------
  const [session, setSession] = useState<Session>(() => load<Session>('wip.session', { user: null, locations: [] }));
  useEffect(() => save('wip.session', session), [session]);
  const { user, locations } = session;

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

  const fetchEvents = useCallback(async () => {
    setLoadState('loading');
    try {
      const list = await eventsService.list();
      setRaw(list);
      setSyncedAt(new Date());
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);
  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

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

  const [modal, setModal] = useState<null | 'report' | 'auth' | 'location'>(null);

  // ---------- locație ----------
  const [gps, setGps] = useState<GpsState>(USE_DEMO_LOCATION ? 'demo' : 'pending');
  const [userPos, setUserPos] = useState<LatLng | null>(USE_DEMO_LOCATION ? DEMO_USER_LOCATION : null);
  const [manualPlace, setManualPlace] = useState<ManualPlace | null>(() => load<ManualPlace | null>('wip.manualPlace', null));
  useEffect(() => save('wip.manualPlace', manualPlace), [manualPlace]);
  /** Fără GPS: folosim adresa salvată sau cerem una (dialog obligatoriu). */
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
  // La pornire cerem locația live și o urmărim; dacă e refuzată, trecem la adresa introdusă manual.
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
        // Erorile trecătoare după un fix reușit nu schimbă nimic.
        if (hadFix && err.code !== err.PERMISSION_DENIED) return;
        navigator.geolocation.clearWatch(watchId);
        fallBackToManual('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [fallBackToManual]);

  // ---------- UI ----------
  const [cats, setCats] = useState<Record<CategoryKey, boolean>>({ ...ALL_CATEGORIES_ON });
  const [fadingCats, setFadingCats] = useState<Partial<Record<CategoryKey, true>>>({});
  const fadeTimers = useRef<Partial<Record<CategoryKey, number>>>({});
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<PanelMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('mini');
  const cycleSheet = useCallback(() => setSheetSnap((s) => SHEET_SNAPS[(SHEET_SNAPS.indexOf(s) + 1) % SHEET_SNAPS.length]), []);
  /** Înălțimea reală (px) a bottom sheet-ului, actualizată de BottomSheet prin ResizeObserver. */
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
  /** Cât din hartă e acoperit de panou / bottom sheet / carduri (px), ca centrarea să țină cont de zona vizibilă. */
  const mapInsets = useRef({ left: 0, top: 0, bottom: 0 });
  const flyTo = useCallback((p: LatLng, zoom?: number) => {
    const m = mapRef.current;
    if (!m) return;
    const z = zoom ?? Math.max(m.getZoom(), 15);
    const { left, top, bottom } = mapInsets.current;
    const pt = m.project([p.lat, p.lng], z).subtract([left / 2, (top - bottom) / 2]);
    m.flyTo(m.unproject(pt, z), z, { duration: 0.6 });
  }, []);
  /** Centrul zonei vizibile a hărții (unde stă pinul de raportare). */
  const visibleCenter = useCallback((): LatLng | null => {
    const m = mapRef.current;
    if (!m) return null;
    const { left, top, bottom } = mapInsets.current;
    const size = m.getSize();
    const c = m.containerPointToLatLng([size.x / 2 + left / 2, size.y / 2 + (top - bottom) / 2]);
    return { lat: c.lat, lng: c.lng };
  }, []);

  // ---------- evenimente derivate ----------
  const events: DerivedEvent[] = useMemo(() => {
    return raw
      .concat(userReports)
      .filter((e) => !deletedIds[e.id])
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
          affects:
            user && active
              ? locations.filter((l) => l.prefs[e.category] && distanceToEvent(l.location, e) <= CONFIG.IMPACT_RADIUS_M).map((l) => l.name)
              : [],
        };
      });
  }, [raw, userReports, deletedIds, votes, userPos, user, locations]);

  /** Alertele publice active din tot orașul (oficiale + confirmate), fără rază, căutare sau filtre. */
  const cityActiveCount = useMemo(() => events.filter((e) => e.status === 'oficial' || e.status === 'confirmat').length, [events]);

  const byId = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);
  const selected = selectedId ? byId[selectedId] ?? null : null;

  /** Evenimentele din listă (sortate: adresele mele, distanță, recență). */
  const visible = useMemo(() => {
    const q = normalize(search.trim());
    return events
      .filter((e) => {
        if (!cats[e.category] && !fadingCats[e.category]) return false;
        if (!isPublic(e, user?.id)) return false;
        if (radius !== 'all' && e.distanceM != null && e.distanceM > radius) return false;
        if (q && !normalize(`${e.title} ${e.district} ${e.streets.join(' ')}`).includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const aa = a.affects.length ? 0 : 1;
        const bb = b.affects.length ? 0 : 1;
        if (aa !== bb) return aa - bb;
        if (a.distanceM != null && b.distanceM != null && Math.abs(a.distanceM - b.distanceM) > 20) return a.distanceM - b.distanceM;
        const t = (e: UrbanEvent) => new Date(e.updatedAt ?? e.reportedAt ?? e.startAt ?? 0).getTime();
        return t(b) - t(a);
      });
  }, [events, cats, fadingCats, user, radius, search]);

  // ---------- acțiuni ----------
  const toggleCategory = useCallback((k: CategoryKey) => {
    setCats((c) => {
      const on = c[k];
      window.clearTimeout(fadeTimers.current[k]);
      if (on) {
        setFadingCats((f) => ({ ...f, [k]: true }));
        fadeTimers.current[k] = window.setTimeout(() => {
          setFadingCats((f) => {
            const n = { ...f };
            delete n[k];
            return n;
          });
        }, CONFIG.FADE_MS);
      } else {
        setFadingCats((f) => {
          const n = { ...f };
          delete n[k];
          return n;
        });
      }
      return { ...c, [k]: !on };
    });
  }, []);
  const resetFilters = useCallback(() => {
    setCats({ ...ALL_CATEGORIES_ON });
    setRadius('all');
    setSearch('');
  }, []);

  const openEvent = useCallback(
    (id: string) => {
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
    flyTo(p, 15);
  }, [userPos, requestLocation, flyTo]);

  const openLocationPicker = useCallback(() => setModal('location'), []);
  /** Setează locația din adresa introdusă (sau din marcajul mutat pe hartă). */
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
    (id: string, v: Vote) => {
      if (votes[id]) return;
      setVotes((s) => ({ ...s, [id]: v }));
      void eventsService.vote(id, v);
      flash('Mulțumim! Răspunsul tău a fost înregistrat.');
    },
    [votes, flash],
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
        flash(n[id] ? 'Urmărești evenimentul.' : 'Nu mai urmărești evenimentul');
        return n;
      });
    },
    [user, openAuth, flash],
  );

  const signIn = useCallback(
    (u: User, locs: SavedLocation[]) => {
      setSession({ user: u, locations: locs });
      setModal(null);
      if (authAfter === 'report') {
        setReport(emptyReport());
        setModal('report');
      } else if (authAfter && typeof authAfter === 'object') {
        setFollowing((f) => ({ ...f, [authAfter.follow]: true }));
      }
      setAuthAfter(null);
    },
    [authAfter],
  );
  const signUp = useCallback(
    (name: string, email: string, streetId: string, number: string) => {
      const s = STREETS.find((x) => x.id === streetId)!;
      const home: SavedLocation = {
        id: 'acasa', kind: 'home', name: 'Acasă',
        address: `${s.name}${number.trim() ? ` ${number.trim()}` : ''}, ${s.district}`,
        location: s.path[Math.floor(s.path.length / 2)], prefs: { ...ALL_CATEGORIES_ON },
      };
      signIn({ id: `u-${Date.now()}`, name: name.trim(), email: email.trim() }, [home]);
      flash(`Cont creat. Bine ai venit, ${name.trim().split(' ')[0]}!`);
    },
    [signIn, flash],
  );
  const logIn = useCallback(
    (email: string) => {
      signIn({ ...DEMO_USER, email: email.trim() }, DEMO_LOCATIONS.map((l) => ({ ...l, prefs: { ...l.prefs } })));
      flash('Te-ai autentificat');
    },
    [signIn, flash],
  );
  const logOut = useCallback(() => {
    setSession({ user: null, locations: [] });
    setFollowing({});
    setMode('list');
    flash('Ai ieșit din cont');
  }, [flash]);
  const deleteAccount = useCallback(() => {
    setSession({ user: null, locations: [] });
    setFollowing({});
    setUserReports([]);
    setMode('list');
    flash('Contul a fost șters');
  }, [flash]);

  const addLocation = useCallback(
    (kind: 'work' | 'person', name: string, streetId: string) => {
      const s = STREETS.find((x) => x.id === streetId)!;
      const loc: SavedLocation = {
        id: kind === 'work' ? 'serviciu' : `l-${Date.now()}`, kind, name: kind === 'work' ? 'Serviciu' : name.trim(),
        address: `${s.name}, ${s.district}`, location: s.path[Math.floor(s.path.length / 2)], prefs: { ...ALL_CATEGORIES_ON },
      };
      setSession((ss) => ({ ...ss, locations: [...ss.locations, loc] }));
      flash(`Adresa „${loc.name}” a fost salvată`);
    },
    [flash],
  );
  const removeLocation = useCallback(
    (id: string) => {
      setSession((ss) => ({ ...ss, locations: ss.locations.filter((l) => l.id !== id) }));
      flash('Adresa a fost ștearsă');
    },
    [flash],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      setDeletedIds((d) => ({ ...d, [id]: true }));
      setUserReports((r) => r.filter((e) => e.id !== id));
      void eventsService.remove(id);
      setDeleteAsk(null);
      if (selectedId === id) backToList();
      flash('Raportarea a fost ștearsă');
    },
    [selectedId, backToList, flash],
  );

  // ---------- raportare ----------
  const openReport = useCallback(() => {
    if (!online) {
      flash('Raportarea necesită conexiune la internet');
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
  const patchReport = useCallback((p: Partial<ReportDraft>) => setReport((r) => ({ ...r, ...p })), []);
  const goToPinStep = useCallback(() => {
    const home = locations.find((l) => l.kind === 'home');
    const start = userPos ?? home?.location ?? null;
    patchReport({ step: 2, pinChoice: userPos ? 'gps' : home ? home.id : null });
    if (start) window.setTimeout(() => flyTo(start, 16), 50);
  }, [locations, userPos, patchReport, flyTo]);
  const confirmPin = useCallback(() => {
    const pin = visibleCenter();
    if (!pin) return;
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
    patchReport({ pin, step: best ? 3 : 4, duplicateId: best?.id ?? null, duplicateDistanceM: best ? bd : null, noDuplicate: !best });
  }, [events, report.category, patchReport, visibleCenter]);
  const confirmDuplicate = useCallback(() => {
    const id = report.duplicateId;
    if (!id) return;
    if (!votes[id]) setVotes((s) => ({ ...s, [id]: 'yes' }));
    patchReport({ step: 'done', confirmedDuplicate: true, resultId: id });
  }, [report.duplicateId, votes, patchReport]);
  const submitReport = useCallback(async () => {
    if (!report.pin || !report.category || !report.subtype || !user) return;
    const ns = nearestStreet(report.pin, STREETS);
    const e: UrbanEvent = {
      id: `u-${Date.now()}`, category: report.category, subtype: report.subtype, title: SUBTYPES[report.subtype].title,
      sourceType: 'citizen', authorId: user.id, severity: report.severity, district: ns?.street.district ?? '',
      streets: ns ? [ns.street.name] : [], reportedAt: new Date().toISOString(), confirmations: 0, denials: 0,
      description: report.description.trim() || undefined, photo: report.photo, location: report.pin,
      path: segmentAround(report.pin, STREETS, 120),
    };
    const saved = await eventsService.create(e);
    setUserReports((r) => [...r, saved]);
    patchReport({ step: 'done', resultId: saved.id });
  }, [report, user, patchReport]);
  const viewReportResult = useCallback(() => {
    const id = report.resultId;
    closeReport();
    if (id) window.setTimeout(() => openEvent(id), 0);
  }, [report.resultId, closeReport, openEvent]);

  return {
    // preferințe
    theme, setTheme, isDark, radius, setRadius,
    // sesiune
    user, locations, signUp, logIn, logOut, deleteAccount, addLocation, removeLocation,
    // date
    events, visible, byId, selected, loadState, syncedAt, fetchEvents, votes, vote, online,
    userPos, gps, locateMe, gpsNotice, setGpsNotice, manualPlace, setManualLocation, openLocationPicker,
    // filtre & căutare
    cats, fadingCats, toggleCategory, resetFilters, search, setSearch,
    // panou
    mode, openEvent, backToList, openSettings, panelOpen, setPanelOpen, sheetSnap, setSheetSnap, cycleSheet, sheetPx, cityActiveCount,
    following, toggleFollow, deleteAsk, setDeleteAsk, deleteEvent,
    // dialoguri
    modal, setModal, authMode, setAuthMode, authAfter, openAuth,
    report, patchReport, openReport, closeReport, goToPinStep, confirmPin, confirmDuplicate, submitReport, viewReportResult,
    // hartă
    mapRef, mapInsets, flyTo, visibleCenter,
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
