import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EventList, EventListHeader } from '@/components/events/EventList';
import { EventDetail } from '@/components/events/EventDetail';
import { SettingsPanel } from '@/components/settings/SettingsPanel';

/** Panoul lateral (desktop) / bottom sheet (mobil) cu lista, detaliul sau setările. */
export function Panel() {
  const { mode, selected, backToList, panelOpen, setPanelOpen, sheetExpanded, setSheetExpanded, visible, modal, report } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;

  if (pinMode) return null;
  if (!isMobile && !panelOpen) {
    return (
      <button type="button" className="btn btn--float panel-reopen" onClick={() => setPanelOpen(true)}>
        <Icon name="list" size={18} strokeWidth={1.8} />
        Listă · {visible.length}
      </button>
    );
  }

  const sheetState = !isMobile ? '' : mode === 'list' ? (sheetExpanded ? 'is-full' : 'is-peek') : mode === 'detail' ? 'is-detail' : 'is-full';
  const label = mode === 'detail' ? 'Detalii eveniment' : mode === 'settings' ? 'Setări' : 'Lista evenimentelor';

  return (
    <section className={`panel ${isMobile ? 'panel--sheet' : ''} ${sheetState}`} aria-label={label}>
      {isMobile && (
        <button
          type="button"
          className="panel__handle"
          aria-label={mode !== 'list' ? 'Înapoi la listă' : sheetExpanded ? 'Restrânge lista' : 'Extinde lista'}
          onClick={() => (mode !== 'list' ? backToList() : setSheetExpanded(!sheetExpanded))}
        >
          <span />
        </button>
      )}

      {mode === 'list' && (
        <>
          <div className="panel__head">
            <EventListHeader />
            {!isMobile && (
              <button type="button" className="icon-btn" aria-label="Ascunde lista" onClick={() => setPanelOpen(false)}>
                <Icon name="panel" strokeWidth={1.8} />
              </button>
            )}
          </div>
          <div className="panel__body">
            <EventList />
          </div>
        </>
      )}

      {mode === 'detail' && selected && (
        <>
          <div className="panel__bar">
            <button type="button" className="btn btn--ghost btn--sm" onClick={backToList}>
              <Icon name="chevL" />
              Înapoi la listă
            </button>
            <span className="muted xsmall">{selected.sourceType === 'official' ? 'Anunț oficial' : 'Raportare cetățean'}</span>
          </div>
          <div className="panel__body panel__body--pad" key={selected.id}>
            <EventDetail e={selected} />
          </div>
        </>
      )}

      {mode === 'settings' && (
        <>
          <div className="panel__bar panel__bar--start">
            <button type="button" className="icon-btn" aria-label="Înapoi la hartă" onClick={backToList}>
              <Icon name="chevL" />
            </button>
            <h2 className="panel__title">Setări</h2>
          </div>
          <div className="panel__body panel__body--pad">
            <SettingsPanel />
          </div>
        </>
      )}
    </section>
  );
}
