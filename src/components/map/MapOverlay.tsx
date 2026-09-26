import { hm } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { SearchBox } from '@/components/layout/SearchBox';
import { t } from '@/i18n';
import { addDays, dayKey, dayTag, fmtDayLong, fmtWeek, fromKey, startOfDay, weekStart } from '@/lib/days';
import { activeOnDay } from '@/lib/status';

/** Stratul de deasupra hărții: căutarea (mobil), butonul „Listă”, avertismente. Filtrele sunt în panou. */
export function MapOverlay() {
  const { online, syncedAt, gpsNotice, setGpsNotice, panelOpen, setPanelOpen, visible, report, modal, sheetSnap } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;

  const focusSearch = () => {
    setGpsNotice(false);
    (document.querySelector('.search__input') as HTMLInputElement | null)?.focus();
  };

  return (
    <div
      className={`overlay ${!isMobile && panelOpen && !pinMode ? 'overlay--beside-panel' : ''} ${isMobile && sheetSnap === 'tall' && !pinMode ? 'is-hidden' : ''}`}>
      {isMobile && <SearchBox className="overlay__search" />}
      <DayPreviewBanner />
      <div className="overlay__row">
        {!isMobile && !panelOpen && !pinMode && (
          <button type="button" className="btn btn--float panel-reopen" onClick={() => setPanelOpen(true)}>
            <Icon name="list" size={18} strokeWidth={1.8} />
            Listă · {visible.length}
          </button>
        )}
      </div>
      {/* Pe mobil, avizele stau în capul listei (vezi ListNotices). */}
      {!isMobile && !online && (
        <div className="notice fade-in" role="status">
          <Icon name="wifiOff" size={18} />
          <span>
            <strong>{t('Ești offline.')}</strong> {syncedAt ? t('Afișăm datele salvate la {time}.', { time: hm(syncedAt) }) : t('Afișăm datele salvate.')}
          </span>
        </div>
      )}
      {!isMobile && gpsNotice && (
        <div className="notice notice--card fade-in" role="status">
          <Icon name="locate" size={20} />
          <div className="notice__body">
            <strong>{t('Locația nu este disponibilă')}</strong>
            <span>{t('Ai blocat accesul la locație. Îl poți permite din setările browserului sau poți căuta o adresă.')}</span>
            <div className="row gap-8">
              <button type="button" className="btn btn--primary btn--sm" onClick={focusSearch}>
                {t('Caută o adresă')}
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setGpsNotice(false)}>
                {t('Închide')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Zoom, „Locația mea” și butonul principal „Raportează o problemă”. */
export function MapControls() {
  const { mapRef, locateMe, openReport, online, report, modal, sheetSnap } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;
  if (pinMode) return null;
  // Pe mobil, controalele stau deasupra bottom sheet-ului în 'mini' și 'mid' și se ascund în 'tall'.
  const hidden = isMobile && sheetSnap === 'tall';
  return (
    <>
      <div className={`controls ${hidden ? 'is-hidden' : ''}`}>
        {!isMobile && (
          <div className="zoom">
            <button type="button" className="icon-btn" aria-label={t('Mărește harta')} onClick={() => mapRef.current?.zoomIn()}>
              <Icon name="plus" />
            </button>
            <span className="zoom__sep" />
            <button type="button" className="icon-btn" aria-label={t('Micșorează harta')} onClick={() => mapRef.current?.zoomOut()}>
              <Icon name="minus" />
            </button>
          </div>
        )}
        <button type="button" className="btn btn--float controls__locate" aria-label={t('Locația mea')} onClick={() => void locateMe()}>
          <Icon name="locate" size={18} strokeWidth={1.8} />
          <span className="btn__label">{t('Locația mea')}</span>
        </button>
        {isMobile && (
          <button type="button" className="btn btn--primary btn--fab" onClick={openReport} aria-disabled={!online}>
            <Icon name="plus" size={20} strokeWidth={2.2} />
            {t('Raportează o problemă')}
          </button>
        )}
      </div>
      {!isMobile && (
        <div className="fab-wrap">
          <button type="button" className="btn btn--primary btn--fab" onClick={openReport} aria-disabled={!online}>
            <Icon name="plus" size={20} strokeWidth={2.2} />
            {t('Raportează o problemă')}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Previzualizarea din calendar: o zi sau o săptămână (luni–duminică). În modul săptămână, zilele apar ca etichete
 * cu numărul de evenimente; clic pe o zi = harta acelei zile. ‹ › = ziua / săptămâna vecină.
 */
function DayPreviewBanner() {
  const { preview, setPreview, visible } = useApp();
  if (!preview) return null;
  const start = fromKey(preview.start);
  const week = preview.days === 7;
  const monday = weekStart(start);
  const shift = (n: number) => setPreview({ start: dayKey(addDays(start, week ? 7 * n : n)), days: preview.days });
  const today = startOfDay(new Date());
  const inWeek = today >= monday && today < addDays(monday, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className="day-preview fade-in" role="status">
      <div className="day-preview__row">
        <button type="button" className="icon-btn" aria-label={week ? t('Săptămâna anterioară') : t('Ziua anterioară')} onClick={() => shift(-1)}>
          <Icon name="chevL" />
        </button>
        <span className="stack grow day-preview__text">
          <span className="xsmall muted">
            {week ? t('Harta săptămânii') : t('Harta pentru')} · {t('{n} evenimente', { n: visible.length })}
          </span>
          <strong>{week ? fmtWeek(monday) : fmtDayLong(start).replace(/^./, (c) => c.toUpperCase())}</strong>
        </span>
        <button type="button" className="icon-btn" aria-label={week ? t('Săptămâna următoare') : t('Ziua următoare')} onClick={() => shift(1)}>
          <Icon name="chevR" />
        </button>
        <div className="seg seg--2 day-preview__mode" role="group" aria-label={t('Interval')}>
          <button
            type="button"
            className="seg__btn"
            aria-pressed={!week}
            onClick={() => setPreview({ start: dayKey(week ? (inWeek ? today : monday) : start), days: 1 })}
          >
            {t('Zi')}
          </button>
          <button type="button" className="seg__btn" aria-pressed={week} onClick={() => setPreview({ start: dayKey(monday), days: 7 })}>
            {t('Săptămână')}
          </button>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setPreview(null)}>
          {t('Înapoi la acum')}
        </button>
      </div>
      {week && (
        <div className="day-preview__days" role="group" aria-label={t('Zilele săptămânii')}>
          {days.map((d) => {
            const n = visible.filter((e) => activeOnDay(e, d)).length;
            return (
              <button
                key={dayKey(d)}
                type="button"
                className={`day-chip ${n ? 'has-events' : ''} ${dayKey(d) === dayKey(today) ? 'is-today' : ''}`}
                aria-label={`${fmtDayLong(d)}, ${t('{n} evenimente', { n })}`}
                onClick={() => setPreview({ start: dayKey(d), days: 1 })}
              >
                <span>{dayTag(d)}</span>
                <strong>{n}</strong>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
