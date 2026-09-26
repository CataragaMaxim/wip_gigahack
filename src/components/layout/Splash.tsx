import { useEffect, useState } from 'react';
import { useApp } from '@/state/AppContext';
import { t } from '@/i18n';

/** Cât timp așteptăm cel mult harta înainte să o arătăm oricum (ms). */
const MAX_WAIT_MS = 15000;
/** Condițiile trebuie să rămână îndeplinite atât timp, ca să nu ascundem ecranul chiar înainte ca harta să se mute pe utilizator. */
const SETTLE_MS = 350;

/**
 * Ecranul de pornire: rămâne până când avem alertele, locația (sau știm că lipsește)
 * și toate dalele hărții Chișinăului din zona vizibilă. Apare o singură dată, la deschidere.
 */
export function Splash() {
  const { loadState, gps, tilesReady } = useApp();
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const dataReady = loadState !== 'loading';
  const locationReady = gps !== 'pending';
  const ready = (dataReady && locationReady && tilesReady) || timedOut;

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready || hidden) return;
    const t = window.setTimeout(() => setHidden(true), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [ready, hidden]);
  // După animația de ieșire, ecranul dispare din DOM.
  useEffect(() => {
    if (!hidden) return;
    const t = window.setTimeout(() => setGone(true), 400);
    return () => window.clearTimeout(t);
  }, [hidden]);

  if (gone) return null;
  const status = !locationReady ? t('Căutăm locația ta…') : !tilesReady ? t('Se încarcă harta Chișinăului…') : !dataReady ? t('Se încarcă alertele…') : t('Gata');

  return (
    <div className={`splash ${hidden ? 'is-hidden' : ''}`} role="status" aria-live="polite" aria-busy={!hidden}>
      <div className="splash__logo" aria-hidden="true">
        <span className="splash__track">
          <span className="splash__bar" />
        </span>
      </div>
      <strong className="splash__name">{t('Work In Progress')}</strong>
      <span className="splash__loading">{t('Se încarcă…')}</span>
      <span className="splash__status">{status}</span>
    </div>
  );
}
