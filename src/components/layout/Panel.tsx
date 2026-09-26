import { useEffect } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EventList, EventListHeader, FocusBanner, LaterNote, ListNotices, TypeFilter, useSheetSummary } from '@/components/events/EventList';
import { EventActions, EventDetail } from '@/components/events/EventDetail';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { OutageCalendar } from '@/components/calendar/OutageCalendar';
import { BottomSheet } from './BottomSheet';
import { t } from '@/i18n';
import { eventTitle } from '@/lib/status';

/** Panoul lateral (desktop) / bottom sheet cu 3 stări (mobil) cu lista, detaliul sau setările. */
export function Panel() {
  const { modal, report } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;
  if (pinMode) return null;
  return isMobile ? <MobileSheet /> : <DesktopPanel />;
}

function DesktopPanel() {
  const { mode, selected, backToList, closeDetail, detailFrom, panelOpen, setPanelOpen } = useApp();

  // Panoul închis: butonul „Listă” stă în rândul filtrelor (MapOverlay), ca să nu se suprapună cu ele.
  if (!panelOpen) return null;

  const label =
    mode === 'detail' ? t('Detalii eveniment') : mode === 'settings' ? t('Setări') : mode === 'calendar' ? t('Calendarul evenimentelor') : t('Lista evenimentelor');

  return (
    <section className="panel" aria-label={label}>
      {mode === 'list' && (
        <>
          <div className="panel__head">
            <EventListHeader />
            <button type="button" className="icon-btn" aria-label={t('Ascunde lista')} onClick={() => setPanelOpen(false)}>
              <Icon name="panel" strokeWidth={1.8} />
            </button>
          </div>
          <div className="panel__filters">
            <TypeFilter />
            <FocusBanner />
            <LaterNote />
          </div>
          <div className="panel__body">
            <EventList />
          </div>
        </>
      )}

      {mode === 'detail' && selected && (
        <>
          <div className="panel__bar">
            <button type="button" className="btn btn--ghost btn--sm" onClick={closeDetail}>
              <Icon name="chevL" />
              {detailFrom === 'calendar' ? t('Înapoi la calendar') : t('Înapoi la listă')}
            </button>
            <span className="muted xsmall">{selected.sourceType === 'official' ? t('Anunț oficial') : t('Raportare cetățean')}</span>
          </div>
          <div className="panel__body panel__body--pad" key={selected.id}>
            <EventDetail e={selected} />
          </div>
        </>
      )}

      {mode === 'calendar' && (
        <>
          <div className="panel__bar panel__bar--start">
            <button type="button" className="icon-btn" aria-label={t('Înapoi la listă')} onClick={backToList}>
              <Icon name="chevL" />
            </button>
            <h2 className="panel__title">{t('Calendar evenimente')}</h2>
          </div>
          <div className="panel__body panel__body--pad">
            <OutageCalendar />
          </div>
        </>
      )}

      {mode === 'settings' && (
        <>
          <div className="panel__bar panel__bar--start">
            <button type="button" className="icon-btn" aria-label={t('Înapoi la hartă')} onClick={backToList}>
              <Icon name="chevL" />
            </button>
            <h2 className="panel__title">{t('Setări')}</h2>
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
  const { mode, selected, backToList, closeDetail, detailFrom, sheetSnap, setSheetSnap, user, loadState, visible, online, gps, userPos, gpsNotice, setGpsNotice } = useApp();
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
      ? `${t('Anunț oficial')}${selected.source ? ` · ${selected.source}` : ''}`
      : selected.conf > 0
        ? t('Raportat de vecini · confirmat de {n}', { n: selected.conf })
        : t('Raportare cetățean');
    const tall = sheetSnap === 'tall';
    return (
      <BottomSheet
        label={t('Detalii eveniment')}
        pageKey={`detail-${selected.id}`}
        header={{ title: eventTitle(selected), subtitle: sub, onBack: closeDetail, backLabel: detailFrom === 'calendar' ? t('Înapoi la calendar') : t('Înapoi la listă') }}
        miniAria={`${eventTitle(selected)}, ${sub}`}
        padBody
        footer={<EventActions e={selected} short />}
      >
        <EventDetail key={selected.id} e={selected} showActions={!tall} />
      </BottomSheet>
    );
  }

  if (mode === 'calendar') {
    return (
      <BottomSheet
        label={t('Calendarul evenimentelor')}
        pageKey="calendar"
        header={{
          title: t('Calendar evenimente'),
          subtitle: t('Deconectări și lucrări programate'),
          onBack: () => {
            backToList();
            setSheetSnap('mini');
          },
          backLabel: t('Înapoi la hartă'),
        }}
        miniLine={t('Calendar evenimente planificate')}
        padBody
      >
        <OutageCalendar />
      </BottomSheet>
    );
  }

  if (mode === 'settings') {
    return (
      <BottomSheet
        label={t('Setări')}
        pageKey="settings"
        header={{
          title: t('Setări'),
          subtitle: user?.name,
          onBack: () => {
            backToList();
            setSheetSnap('mini');
          },
          backLabel: t('Înapoi la hartă'),
        }}
        miniLine={user?.name ?? t('Cont, adrese, temă, rază')}
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
      label={t('Lista evenimentelor')}
      pageKey="list"
      header={{ title: t('Evenimente în zonă'), subtitle: summary.subtitle }}
      miniLine={summary.mini}
      miniAria={summary.miniAria}
      live={summary.live}
      centerBody={center}
    >
      <div className="panel__filters panel__filters--sheet">
        <TypeFilter />
        <FocusBanner />
        <LaterNote />
      </div>
      <ListNotices onSearch={focusSearch} />
      <EventList />
    </BottomSheet>
  );
}
