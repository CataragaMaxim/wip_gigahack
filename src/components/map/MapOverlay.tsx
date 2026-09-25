import { CATEGORIES } from '@/config/categories';
import { hm } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { SearchBox } from '@/components/layout/SearchBox';

/** Stratul de deasupra hărții: căutarea (mobil), filtrele pe categorii, avertismente. */
export function MapOverlay() {
  const { cats, toggleCategory, online, syncedAt, gpsNotice, setGpsNotice, panelOpen, report, modal } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;

  const focusSearch = () => {
    setGpsNotice(false);
    (document.querySelector('.search__input') as HTMLInputElement | null)?.focus();
  };

  return (
    <div className={`overlay ${!isMobile && panelOpen && !pinMode ? 'overlay--beside-panel' : ''}`}>
      {isMobile && <SearchBox className="overlay__search" />}
      <div className="chips" role="group" aria-label="Filtrează după categorie">
        {CATEGORIES.map((c) => {
          const on = cats[c.key];
          return (
            <button
              key={c.key}
              type="button"
              className={`chip ${on ? 'is-on' : ''}`}
              style={{ ['--cat' as string]: `var(--c-${c.key})`, ['--cat-t' as string]: `var(--c-${c.key}-t)` }}
              aria-pressed={on}
              onClick={() => toggleCategory(c.key)}
            >
              <Icon name={c.icon} size={18} />
              {c.short}
              {on && <Icon name="check" size={14} strokeWidth={2.6} />}
            </button>
          );
        })}
      </div>
      {!online && (
        <div className="notice fade-in" role="status">
          <Icon name="wifiOff" size={18} />
          <span>
            <strong>Ești offline.</strong> Afișăm date salvate{syncedAt ? ` · Date din ${hm(syncedAt)}` : ''}
          </span>
        </div>
      )}
      {gpsNotice && (
        <div className="notice notice--card fade-in" role="status">
          <Icon name="locate" size={20} />
          <div className="notice__body">
            <strong>Locația nu este disponibilă</strong>
            <span>Ai blocat accesul la locație. Îl poți permite din setările browserului sau poți căuta o adresă.</span>
            <div className="row gap-8">
              <button type="button" className="btn btn--primary btn--sm" onClick={focusSearch}>
                Caută o adresă
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setGpsNotice(false)}>
                Închide
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
  const { mapRef, locateMe, openReport, online, report, modal, mode, sheetExpanded } = useApp();
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;
  if (pinMode) return null;
  if (isMobile && (sheetExpanded || mode !== 'list')) return null;
  return (
    <>
      <div className="controls">
        {!isMobile && (
          <div className="zoom">
            <button type="button" className="icon-btn" aria-label="Mărește harta" onClick={() => mapRef.current?.zoomIn()}>
              <Icon name="plus" />
            </button>
            <span className="zoom__sep" />
            <button type="button" className="icon-btn" aria-label="Micșorează harta" onClick={() => mapRef.current?.zoomOut()}>
              <Icon name="minus" />
            </button>
          </div>
        )}
        <button type="button" className="btn btn--float" onClick={() => void locateMe()}>
          <Icon name="locate" size={18} strokeWidth={1.8} />
          Locația mea
        </button>
        {isMobile && (
          <button type="button" className="btn btn--primary btn--fab" onClick={openReport} aria-disabled={!online}>
            <Icon name="plus" size={20} strokeWidth={2.2} />
            Raportează o problemă
          </button>
        )}
      </div>
      {!isMobile && (
        <div className="fab-wrap">
          <button type="button" className="btn btn--primary btn--fab" onClick={openReport} aria-disabled={!online}>
            <Icon name="plus" size={20} strokeWidth={2.2} />
            Raportează o problemă
          </button>
        </div>
      )}
    </>
  );
}
