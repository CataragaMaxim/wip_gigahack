import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import { CATEGORY_HEX, RESOLVED_HEX, CATEGORY } from '@/config/categories';
import { CONFIG, MAP } from '@/config/constants';
import { useApp } from '@/state/AppContext';
import { isClosed, statusBadge } from '@/lib/status';
import { STREETS } from '@/data/streets';
import { segmentAround } from '@/lib/geo';
import { reverseGeocode } from '@/services/geocoding';
import type { DerivedEvent } from '@/types';
import { eventIcon, meIcon, placeIcon } from './markerIcons';

/**
 * Harta (Leaflet + OpenStreetMap/CARTO).
 * Toate evenimentele rămân montate în aceeași ordine; cele filtrate doar se estompează,
 * ca markerele rămase să nu se miște când se schimbă filtrele.
 */
export function MapView() {
  const app = useApp();
  const { events, visible, selected, fadingCats, isDark, user, locations, userPos, gps, loadState, report, modal } = app;
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
    dataReady && (shown.has(e.id) || selected?.id === e.id) && !fadingCats[e.category];

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
        className="map__canvas"
      >
        <TileLayer key={theme} url={isDark ? MAP.TILES_DARK : MAP.TILES_LIGHT} attribution={MAP.ATTRIBUTION} subdomains="abcd" />

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

/** Locația introdusă manual: se poate trage pentru precizie; clic = schimbă adresa. */
function ManualMarker() {
  const { userPos, manualPlace, setManualLocation, openLocationPicker } = useApp();
  if (!userPos) return null;
  return (
    <Marker
      position={[userPos.lat, userPos.lng]}
      icon={meIcon}
      draggable
      title={`${manualPlace?.label ?? 'Locația ta'} — trage pentru a ajusta, clic pentru a schimba adresa`}
      zIndexOffset={-400}
      eventHandlers={{
        click: openLocationPicker,
        dragend: (ev) => {
          const { lat, lng } = (ev.target as L.Marker).getLatLng();
          const location = { lat, lng };
          setManualLocation({ label: manualPlace?.label ?? 'Locație aleasă pe hartă', location }, { fly: false });
          void reverseGeocode(location).then((r) => {
            if (r) setManualLocation({ label: r.detail ? `${r.label}, ${r.detail}` : r.label, location }, { fly: false });
          });
        },
      }}
    />
  );
}

function EventShape({ e, theme, show, selected }: { e: DerivedEvent; theme: 'light' | 'dark'; show: boolean; selected: boolean }) {
  // Fără traseu: segment aproximativ. Cu traseu dintr-un singur punct (raportare departe de stradă): doar markerul.
  const path = useMemo(() => e.path ?? segmentAround(e.location, STREETS), [e.path, e.location]);
  if (path.length < 2) return null;
  const color = isClosed(e.status) ? RESOLVED_HEX[theme] : CATEGORY_HEX[theme][e.category];
  const partial = e.severity === 'partial';
  const base = e.status === 'contestat' ? 0.35 : 1;
  const positions = path.map((p) => [p.lat, p.lng] as [number, number]);
  return (
    <>
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{ color, weight: 18, opacity: show ? (selected ? 0.35 : partial ? 0.14 : 0.22) * base : 0, lineCap: 'round', lineJoin: 'round', className: 'wip-line' }}
      />
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color, weight: 5, opacity: show ? base : 0, lineCap: 'round', lineJoin: 'round',
          dashArray: e.status === 'raportat' ? '1 10' : partial ? '12 8' : undefined, className: 'wip-line',
        }}
      />
    </>
  );
}

function EventMarker({ e, show, selected, onOpen }: { e: DerivedEvent; show: boolean; selected: boolean; onOpen: (id: string) => void }) {
  const icon = useMemo(() => eventIcon(e, selected), [e, selected]);
  const title = `${CATEGORY[e.category].short}, ${statusBadge(e).label}: ${e.title}`;
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
