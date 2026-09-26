import { useEffect } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EventList, EventListHeader, ListNotices, useSheetSummary } from '@/components/events/EventList';
import { EventActions, EventDetail } from '@/components/events/EventDetail';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { BottomSheet } from './BottomSheet';

/** Panoul lateral (desktop) / bottom sheet cu 3 stări (mobil) cu lista, detaliul sau setările. */
export function Panel() {
  const { modal, report } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;
  if (pinMode) return null;
  return isMobile ? <MobileSheet /> : <DesktopPanel />;
}

function DesktopPanel() {
  const { mode, selected, backToList, panelOpen, setPanelOpen, visible } = useApp();

  if (!panelOpen) {
    return (
      <button type="button" className="btn btn--float panel-reopen" onClick={() => setPanelOpen(true)}>
        <Icon name="list" size={18} strokeWidth={1.8} />
        Listă · {visible.length}
      </button>
    );
  }

  const label = mode === 'detail' ? 'Detalii eveniment' : mode === 'settings' ? 'Setări' : 'Lista evenimentelor';

  return (
    <section className="panel" aria-label={label}>
      {mode === 'list' && (
        <>
          <div className="panel__head">
            <EventListHeader />
            <button type="button" className="icon-btn" aria-label="Ascunde lista" onClick={() => setPanelOpen(false)}>
              <Icon name="panel" strokeWidth={1.8} />
            </button>
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

function MobileSheet() {
  const { mode, selected, backToList, sheetSnap, setSheetSnap, user, loadState, visible, online, gps, userPos, gpsNotice, setGpsNotice } = useApp();
  const summary = useSheetSummary();

  // „Locația mea” eșuată cu lista strânsă: avizul GPS stă acum în listă, deci o aducem la jumătate.
  useEffect(() => {
    if (gpsNotice && mode === 'list' && sheetSnap === 'mini') setSheetSnap('mid');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsNotice]);

  const focusSearch = () => {
    setGpsNotice(false);
    setSheetSnap('mini');
    window.setTimeout(() => (document.querySelector('.overlay__search .search__input') as HTMLInputElement | null)?.focus(), 60);
  };

  if (mode === 'detail' && selected) {
    const official = selected.sourceType === 'official';
    const sub = official
      ? `Anunț oficial${selected.source ? ` · ${selected.source}` : ''}`
      : selected.conf > 0
        ? `Raportat de vecini · confirmat de ${selected.conf}`
        : 'Raportare cetățean';
    const tall = sheetSnap === 'tall';
    return (
      <BottomSheet
        label="Detalii eveniment"
        pageKey={`detail-${selected.id}`}
        header={{ title: selected.title, subtitle: sub, onBack: backToList, backLabel: 'Înapoi la listă' }}
        miniAria={`${selected.title}, ${sub}`}
        padBody
        footer={<EventActions e={selected} short />}
      >
        <EventDetail key={selected.id} e={selected} showActions={!tall} />
      </BottomSheet>
    );
  }

  if (mode === 'settings') {
    return (
      <BottomSheet
        label="Setări"
        pageKey="settings"
        header={{
          title: 'Setări',
          subtitle: user?.name,
          onBack: () => {
            backToList();
            setSheetSnap('mini');
          },
          backLabel: 'Înapoi la hartă',
        }}
        miniLine={user?.name ?? 'Cont, adrese, temă, rază'}
        padBody
      >
        <SettingsPanel />
      </BottomSheet>
    );
  }

  const hasNotices = !online || (!userPos && gps !== 'pending') || gpsNotice;
  const center = !hasNotices && (loadState === 'error' || (loadState === 'ready' && visible.length === 0));
  return (
    <BottomSheet
      label="Lista evenimentelor"
      pageKey="list"
      header={{ title: 'Evenimente în zonă', subtitle: summary.subtitle }}
      miniLine={summary.mini}
      miniAria={summary.miniAria}
      live={summary.live}
      centerBody={center}
    >
      <ListNotices onSearch={focusSearch} />
      <EventList />
    </BottomSheet>
  );
}
