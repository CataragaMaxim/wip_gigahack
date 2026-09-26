import { CONFIG } from '@/config/constants';
import { SUBTYPES, TYPES, typeTint, typeVar } from '@/config/categories';
import { hm, plural } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { categoryLine, metaLine } from '@/lib/status';
import { useApp } from '@/state/AppContext';
import type { DerivedEvent } from '@/types';
import { EventTile, SeverityBadge, SourceBadge, StatusBadge } from './EventBits';

export function EventListHeader() {
  const { visible, radius, search, loadState, online, syncedAt, gps, userPos } = useApp();
  const count = visible.length;
  const scope = search.trim() ? `pentru „${search.trim()}”` : radius === 'all' ? 'tot orașul' : `rază ${radius / 1000} km`;
  let summary = `${plural(count, 'eveniment', 'evenimente')} · ${scope}`;
  if (loadState === 'loading') summary = 'Se actualizează…';
  if (loadState === 'error') summary = 'Date indisponibile';
  if (!online && syncedAt) summary += ` · date din ${syncedAt.getHours().toString().padStart(2, '0')}:${syncedAt.getMinutes().toString().padStart(2, '0')}`;
  return (
    <div className="panel__titles">
      <h2>Evenimente în zonă</h2>
      <p className="muted">{summary}</p>
      {!userPos && gps !== 'pending' && (
        <p className="muted small row gap-6">
          <Icon name="info" size={14} />
          Locația e dezactivată: nu afișăm distanțe.
        </p>
      )}
    </div>
  );
}

/** Filtrele pe tip (electricitate, apă, gaz), în capul listei. */
export function TypeFilter() {
  const { types, toggleType } = useApp();
  return (
    <div className="chips type-filter" role="group" aria-label="Filtrează după tip">
      {TYPES.map((k) => {
        const on = types[k];
        return (
          <button
            key={k}
            type="button"
            className={`chip ${on ? 'is-on' : ''}`}
            style={{ ['--cat' as string]: typeVar(k), ['--cat-t' as string]: typeTint(k) }}
            aria-pressed={on}
            onClick={() => toggleType(k)}
          >
            <Icon name={SUBTYPES[k].icon} size={18} />
            {SUBTYPES[k].label}
            {on && <Icon name="check" size={14} strokeWidth={2.6} />}
          </button>
        );
      })}
    </div>
  );
}

/** „12 alerte active” → <b>12</b> alerte active (numărul îngroșat). */
function boldCount(text: string) {
  const m = text.match(/^(\d+)(.*)$/);
  return m ? (
    <>
      <b>{m[1]}</b>
      {m[2]}
    </>
  ) : (
    text
  );
}

/**
 * Textele barei bottom sheet-ului (mobil).
 * `mini` / `miniAria`: numărul de alerte publice active din tot orașul (fără rază, căutare sau filtre).
 * `subtitle`: antetul din stările 'mid' și 'tall', cu rezumatul listei filtrate.
 */
export function useSheetSummary() {
  const { cityActiveCount: n, visible, radius, search, types, loadState, online, syncedAt, gps, userPos } = useApp();
  const noGps = !userPos && gps !== 'pending';
  const synced = syncedAt ? hm(syncedAt) : null;
  const active = plural(n, 'alertă activă', 'alerte active');

  if (loadState === 'loading')
    return { live: 'loading' as const, mini: 'Se încarcă alertele…', miniAria: 'Evenimente în zonă, se încarcă alertele', subtitle: 'Se încarcă alertele…' };
  if (loadState === 'error')
    return { live: 'error' as const, mini: 'Date indisponibile · Atinge pentru detalii', miniAria: 'Evenimente în zonă, date indisponibile', subtitle: 'Date indisponibile' };
  if (n === 0)
    return { live: online ? ('ok' as const) : ('offline' as const), mini: 'Nicio alertă activă în oraș', miniAria: 'Evenimente în zonă, nicio alertă activă în oraș', subtitle: 'Nicio alertă activă în oraș' };
  if (!online) {
    const t = `${plural(n, 'alertă', 'alerte')}${synced ? ` · date din ${synced}` : ''}`;
    return { live: 'offline' as const, mini: boldCount(t), miniAria: `Evenimente în zonă, ${t}`, subtitle: t };
  }

  const q = search.trim();
  const typesOff = Object.values(types).some((on) => !on);
  let scope = 'tot orașul';
  if (q) scope = `${plural(visible.length, 'eveniment', 'evenimente')} pentru „${q}”`;
  else if (radius !== 'all' && !noGps) scope = `${plural(visible.length, 'eveniment', 'evenimente')} · rază ${radius / 1000} km`;
  else if (typesOff) scope = plural(visible.length, 'eveniment afișat', 'evenimente afișate');
  const subtitle = noGps ? `${active} · fără distanțe` : `${active} în oraș · ${scope}`;
  return { live: 'ok' as const, mini: boldCount(`${active} în oraș`), miniAria: `Evenimente în zonă, ${active} în oraș`, subtitle };
}

/** Avizele offline și „GPS refuzat”, în capul listei (mobil), ca să rămână vizibile și în starea 'tall'. */
export function ListNotices({ onSearch }: { onSearch: () => void }) {
  const { online, syncedAt, gps, userPos, gpsNotice } = useApp();
  const noGps = (!userPos && gps !== 'pending') || gpsNotice;
  return (
    <>
      {!online && (
        <div className="notice notice--inlist" role="status">
          <Icon name="wifiOff" size={18} />
          <span>
            <strong>Ești offline.</strong> {syncedAt ? `Afișăm datele salvate la ${hm(syncedAt)}.` : 'Afișăm datele salvate.'}
          </span>
        </div>
      )}
      {noGps && (
        <div className="notice notice--inlist notice--top" role="status">
          <Icon name="locate" size={20} />
          <span className="stack gap-8">
            <span>
              <strong>Locația nu este disponibilă.</strong>{' '}
              <span className="muted">Permite accesul din setările browserului sau caută o adresă.</span>
            </span>
            <button type="button" className="btn btn--primary btn--sm notice__action" onClick={onSearch}>
              Caută o adresă
            </button>
          </span>
        </div>
      )}
    </>
  );
}

export function EventList() {
  const { visible, loadState, fetchEvents, fadingTypes, openEvent, openReport, resetFilters, events } = useApp();

  if (loadState === 'loading') {
    return (
      <div className="list" aria-busy="true">
        <p className="sr-only">Se încarcă evenimentele din zonă…</p>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-row">
            <span className="skel skel--tile" />
            <div className="skel-lines">
              <span className="skel" style={{ width: '40%' }} />
              <span className="skel skel--lg" style={{ width: '85%' }} />
              <span className="skel" style={{ width: '60%' }} />
              <span className="skel-badges">
                <span className="skel skel--pill" style={{ width: 70 }} />
                <span className="skel skel--pill" style={{ width: 90 }} />
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="list list--state">
        <div className="state" role="alert">
          <span className="state__icon is-crit">
            <Icon name="alert" size={28} />
          </span>
          <strong>Nu am putut încărca evenimentele</strong>
          <span className="muted">Serverul nu răspunde. Verifică conexiunea și încearcă din nou.</span>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => void fetchEvents()}>
            <Icon name="refresh" size={16} />
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }

  if (visible.length === 0) {
    const nothingAtAll = events.every((e) => e.status !== 'oficial' && e.status !== 'confirmat');
    return (
      <div className="list list--state">
        <div className="state">
          <span className="state__icon">
            <Icon name="check" size={30} strokeWidth={1.8} />
          </span>
          <strong>{nothingAtAll ? 'Nicio problemă raportată în zona ta' : 'Niciun eveniment pentru filtrele alese'}</strong>
          <span className="muted">
            {nothingAtAll ? 'Totul funcționează normal. Te anunțăm dacă apare ceva la adresele tale.' : 'Încearcă alte categorii sau altă rază din Setări.'}
          </span>
          {nothingAtAll ? (
            <button type="button" className="btn btn--secondary btn--lg" onClick={openReport}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
              Raportează o problemă
            </button>
          ) : (
            <button type="button" className="btn btn--secondary btn--lg" onClick={resetFilters}>
              Resetează filtrele
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ul className="list">
      {visible.map((e) => (
        <li key={e.id}>
          <EventRow e={e} fading={!!fadingTypes[e.subtype]} onOpen={() => openEvent(e.id)} />
        </li>
      ))}
    </ul>
  );
}

function EventRow({ e, fading, onOpen }: { e: DerivedEvent; fading: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={`event-row ${fading ? 'is-fading' : ''}`} style={{ transitionDuration: `${CONFIG.FADE_MS}ms` }} onClick={onOpen}>
      <EventTile e={e} />
      <span className="event-row__body">
        <span className="event-row__top">
          <span className="event-row__cat" style={{ color: typeVar(e.subtype) }}>
            {categoryLine(e)}
          </span>
          {e.affects.length > 0 && (
            <span className="tag-home">
              <Icon name="home" size={11} strokeWidth={2.4} />
              {e.affects.join(', ')}
            </span>
          )}
        </span>
        <span className="event-row__title">{e.title}</span>
        <span className="event-row__meta">{metaLine(e)}</span>
        <span className="badges">
          <StatusBadge e={e} />
          <SeverityBadge e={e} />
          <SourceBadge e={e} />
        </span>
      </span>
    </button>
  );
}
