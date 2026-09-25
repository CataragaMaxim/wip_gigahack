import { CONFIG } from '@/config/constants';
import { catVar } from '@/config/categories';
import { plural } from '@/lib/format';
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

export function EventList() {
  const { visible, loadState, fetchEvents, fadingCats, openEvent, openReport, resetFilters, events } = useApp();

  if (loadState === 'loading') {
    return (
      <div className="list" aria-busy="true">
        <p className="muted small list__note">Se încarcă evenimentele din zonă…</p>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-row">
            <span className="skel skel--tile" />
            <div className="skel-lines">
              <span className="skel" style={{ width: '40%' }} />
              <span className="skel skel--lg" style={{ width: '85%' }} />
              <span className="skel" style={{ width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="list">
        <div className="state state--error" role="alert">
          <Icon name="alert" size={24} />
          <strong>Nu am putut încărca evenimentele</strong>
          <span className="muted">Serverul nu răspunde. Verifică conexiunea și încearcă din nou.</span>
          <button type="button" className="btn btn--primary" onClick={() => void fetchEvents()}>
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
      <div className="list">
        <div className="state">
          <span className="state__icon">
            <Icon name="check" size={26} strokeWidth={1.8} />
          </span>
          <strong>{nothingAtAll ? 'Nicio problemă raportată în zona ta' : 'Niciun eveniment pentru filtrele alese'}</strong>
          <span className="muted">
            {nothingAtAll ? 'Totul funcționează normal.' : 'Încearcă alte categorii sau altă rază din Setări.'}
          </span>
          {nothingAtAll ? (
            <button type="button" className="btn btn--secondary" onClick={openReport}>
              Raportează o problemă
            </button>
          ) : (
            <button type="button" className="btn btn--secondary" onClick={resetFilters}>
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
          <EventRow e={e} fading={!!fadingCats[e.category]} onOpen={() => openEvent(e.id)} />
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
          <span className="event-row__cat" style={{ color: catVar(e.category) }}>
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
