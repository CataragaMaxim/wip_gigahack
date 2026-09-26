import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer } from 'react-leaflet';
import { RESOLVED_HEX, SUBTYPES, TYPE_HEX } from '@/config/categories';
import { CONFIG, MAP } from '@/config/constants';
import { useApp } from '@/state/AppContext';
import { eventTitle, isClosed, statusBadge } from '@/lib/status';
import { areaRadius } from '@/lib/geo';
import { reverseGeocode } from '@/services/geocoding';
import type { DerivedEvent } from '@/types';
import { eventIcon, meIcon, placeIcon } from './markerIcons';
import { getLang, t } from '@/i18n';

/**
 * Harta (Leaflet + OpenStreetMap/CARTO).
 * Toate evenimentele rămân montate în aceeași ordine; cele filtrate doar se estompează,
 * ca markerele rămase să nu se miște când se schimbă filtrele.
 */
export function MapView() {
  const app = useApp();
  const { events, visible, selected, fadingTypes, isDark, user, locations, userPos, gps, loadState, report, modal, mode, radius, panelOpen } = app;
  // În Setări, raza aleasă se vede ca un cerc în jurul utilizatorului.
  const showRadius = mode === 'settings' && panelOpen && radius !== 'all' && !!userPos;
  const theme = isDark ? 'dark' : 'light';
  const shown = useMemo(() => new Set(visible.map((e) => e.id)), [visible]);
  const pinMode = modal === 'report' && report.step === 2;
  const dataReady = loadState === 'ready';

  // Prima dată când aflăm locația (GPS sau adresă), harta se deschide pe utilizator cu același zoom ca „Locația mea”,
  // centrată în zona vizibilă (ține cont de panou / bottom sheet).
  const framed = useRef(false);
  useEffect(() => {
    const m = app.mapRef.current;
    if (!m || !userPos || framed.current) return;
    framed.current = true;
    const z = CONFIG.LOCATE_ZOOM;
    const { left, top, bottom } = app.mapInsets.current;
    const pt = m.project([userPos.lat, userPos.lng], z).subtract([left / 2, (top - bottom) / 2]);
    m.setView(m.unproject(pt, z), z, { animate: false });
  }, [userPos, dataReady, app.mapRef, app.mapInsets]);

  const isShown = (e: DerivedEvent) =>
    dataReady && (shown.has(e.id) || selected?.id === e.id) && !fadingTypes[e.subtype];

  return (
    <div className={`map ${pinMode ? 'map--pin' : ''}`}>
      <MapContainer
        ref={app.mapRef}
        center={[MAP.CENTER.lat, MAP.CENTER.lng]}
        zoom={MAP.ZOOM}
        minZoom={MAP.MIN_ZOOM}
        maxZoom={MAP.MAX_ZOOM}
        zoomControl={false}
        zoomAnimation
        fadeAnimation
        // Zoom lin la rotiță / trackpad: pași de ¼ de nivel, mai mulți pixeli de derulare pe nivel.
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={110}
        wheelDebounceTime={30}
        className="map__canvas"
      >
        <TileLayer
          key={theme}
          url={isDark ? MAP.TILES_DARK : MAP.TILES_LIGHT}
          attribution={MAP.ATTRIBUTION}
          subdomains="abcd"
          eventHandlers={{ loading: () => app.setTilesReady(false), load: () => app.setTilesReady(true) }}
        />

        {showRadius && userPos && <RadiusCircle center={userPos} radiusM={radius} />}

        {events.map((e) => (
          <EventShape key={`shape-${e.id}`} e={e} theme={theme} show={isShown(e)} selected={selected?.id === e.id} />
        ))}

        {user &&
          locations.map((l) => (
            <Marker key={`place-${l.id}`} position={[l.location.lat, l.location.lng]} icon={placeIcon(l)} interactive={false} keyboard={false} zIndexOffset={-500} />
          ))}

        {userPos && dataReady && gps !== 'manual' && <Marker position={[userPos.lat, userPos.lng]} icon={meIcon} interactive={false} keyboard={false} zIndexOffset={-400} />}
        {userPos && dataReady && gps === 'manual' && <ManualMarker />}

        {events.map((e) => (
          <EventMarker key={`marker-${e.id}`} e={e} show={isShown(e)} selected={selected?.id === e.id} onOpen={app.openEvent} />
        ))}
      </MapContainer>
      {pinMode && (
        <div className="center-pin" aria-hidden="true">
          <span className="center-pin__head">
            <span />
          </span>
          <span className="center-pin__shadow" />
        </div>
      )}
      {loadState === 'loading' && <div className="map__loading" aria-hidden="true" />}
    </div>
  );
}

/** Cercul razei afișate, cu eticheta „2 km” pe marginea de sus. */
function RadiusCircle({ center, radiusM }: { center: { lat: number; lng: number }; radiusM: number }) {
  const label = useMemo(
    () => L.divIcon({ className: 'wip-radius-host', html: `<span class="wip-radius-label">${t('{km} km', { km: radiusM / 1000 })}</span>`, iconSize: [0, 0] }),
    [radiusM, getLang()],
  );
  const top: [number, number] = [center.lat + radiusM / 111320, center.lng];
  return (
    <>
      <Circle center={[center.lat, center.lng]} radius={radiusM} interactive={false} pathOptions={{ className: 'wip-radius', weight: 2, dashArray: '6 6' }} />
      <Marker position={top} icon={label} interactive={false} keyboard={false} zIndexOffset={-600} />
    </>
  );
}

/** Locația introdusă manual: se poate trage pentru precizie; clic = schimbă adresa. */
function ManualMarker() {
  const { userPos, manualPlace, setManualLocation, openLocationPicker } = useApp();
  if (!userPos) return null;
  return (
    <Marker
      position={[userPos.lat, userPos.lng]}
      icon={meIcon}
      draggable
      title={`${manualPlace?.label ?? t('Locația ta')} — ${t('trage pentru a ajusta, clic pentru a schimba adresa')}`}
      zIndexOffset={-400}
      eventHandlers={{
        click: openLocationPicker,
        dragend: (ev) => {
          const { lat, lng } = (ev.target as L.Marker).getLatLng();
          const location = { lat, lng };
          setManualLocation({ label: manualPlace?.label ?? t('Locație aleasă pe hartă'), location }, { fly: false });
          void reverseGeocode(location).then((r) => {
            if (r) setManualLocation({ label: r.detail ? `${r.label}, ${r.detail}` : r.label, location }, { fly: false });
          });
        },
      }}
    />
  );
}

/** Zona afectată: cercul care cuprinde toate adresele anunțului (sau o zonă implicită în jurul raportării). */
function EventShape({ e, theme, show, selected }: { e: DerivedEvent; theme: 'light' | 'dark'; show: boolean; selected: boolean }) {
  const color = isClosed(e.status) ? RESOLVED_HEX[theme] : TYPE_HEX[theme][e.subtype];
  const partial = e.severity === 'partial';
  const base = e.status === 'contestat' ? 0.35 : 1;
  return (
    <Circle
      center={[e.location.lat, e.location.lng]}
      radius={areaRadius(e)}
      interactive={false}
      pathOptions={{
        color,
        weight: selected ? 3 : 2,
        opacity: show ? base : 0,
        fillColor: color,
        fillOpacity: show ? (selected ? 0.22 : partial ? 0.08 : 0.14) * base : 0,
        dashArray: e.status === 'raportat' ? '2 8' : partial ? '10 6' : undefined,
        className: 'wip-line',
      }}
    />
  );
}

function EventMarker({ e, show, selected, onOpen }: { e: DerivedEvent; show: boolean; selected: boolean; onOpen: (id: string) => void }) {
  const icon = useMemo(() => eventIcon(e, selected), [e, selected]);
  const title = `${SUBTYPES[e.subtype].label}, ${statusBadge(e).label}: ${eventTitle(e)}`;
  return (
    <Marker
      position={[e.location.lat, e.location.lng]}
      icon={icon}
      opacity={show ? 1 : 0}
      title={title}
      zIndexOffset={selected ? 1000 : show ? (e.affects.length ? 200 : 100) : -1000}
      eventHandlers={{ click: () => show && onOpen(e.id) }}
    />
  );
}
