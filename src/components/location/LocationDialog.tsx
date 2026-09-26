import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
import { searchAddress, type GeoResult } from '@/services/geocoding';

/**
 * Cere adresa exactă când locația live nu e disponibilă (refuzată / nesuportată).
 * Obligatoriu cât timp nu avem nicio poziție; altfel se poate închide.
 */
export function LocationDialog() {
  const { userPos, gps, manualPlace, setManualLocation, setModal, locateMe } = useApp();
  const required = !userPos;
  const id = useId();
  const [query, setQuery] = useState(manualPlace?.label ?? '');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
  const [active, setActive] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const close = useCallback(() => setModal(null), [setModal]);

  // Căutare cu debounce (Nominatim permite max. 1 cerere/secundă).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || q === manualPlace?.label) {
      setResults([]);
      setState('idle');
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setState('loading');
      try {
        const r = await searchAddress(q, ctrl.signal);
        setResults(r);
        setActive(0);
        setState(r.length ? 'idle' : 'empty');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState('error');
      }
    }, 700);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query, manualPlace?.label]);

  const choose = (r: GeoResult) => {
    const label = r.detail ? `${r.label}, ${r.detail}` : r.label;
    // La prima alegere, harta încadrează raza inițială de 5 km (MapView); la schimbare, zburăm la adresă.
    setManualLocation({ label, location: r.location }, { fly: !required });
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (results[active]) choose(results[active]);
  };

  const retryGps = async () => {
    setRetrying(true);
    await locateMe();
    setRetrying(false);
  };

  const denied = gps === 'denied' || gps === 'unsupported';

  return (
    <Dialog
      title={required ? 'Unde te afli?' : 'Schimbă locația'}
      subtitle="Avem nevoie de locația ta ca să-ți arătăm ce se întâmplă în apropiere."
      onClose={required ? undefined : close}
      width={480}
    >
      <form className="stack gap-16" onSubmit={onSubmit} noValidate>
        {denied && (
          <div className="card card--sunk row gap-10 align-start small" role="status">
            <Icon name="locate" />
            <span>
              {gps === 'unsupported'
                ? 'Browserul tău nu oferă acces la locație.'
                : 'Accesul la locația live este blocat. Îl poți permite din setările browserului sau poți introduce adresa manual.'}
            </span>
          </div>
        )}

        <div className="field">
          <label htmlFor={`${id}-q`} className="field__label">
            Adresa ta
          </label>
          <div className="street-input">
            <input
              id={`${id}-q`}
              className={`input ${state === 'error' ? 'is-invalid' : ''}`}
              autoComplete="street-address"
              autoFocus
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={`${id}-list`}
              aria-describedby={`${id}-hint`}
              placeholder="Ex.: Bd. Dacia 23"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                }
              }}
            />
            {results.length > 0 && (
              <ul id={`${id}-list`} role="listbox" className="street-input__menu fade-in">
                {results.map((r, i) => (
                  <li
                    key={r.id}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'is-active' : undefined}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(r);
                    }}
                  >
                    <Icon name="pin" size={15} />
                    <strong>{r.label}</strong>
                    {r.detail && <span>{r.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span id={`${id}-hint`} className={state === 'error' ? 'field__error' : 'field__hint'} role={state === 'error' ? 'alert' : undefined}>
            {state === 'loading' && 'Căutăm adresa…'}
            {state === 'empty' && 'Nu am găsit adresa în Chișinău. Verifică strada și numărul.'}
            {state === 'error' && 'Căutarea nu a funcționat. Verifică conexiunea și încearcă din nou.'}
            {state === 'idle' && 'Scrie strada și numărul casei, apoi alege adresa din listă. După aceea poți muta marcajul pe hartă.'}
          </span>
        </div>

        {gps !== 'unsupported' && (
          <button type="button" className="btn btn--secondary" onClick={() => void retryGps()} disabled={retrying}>
            <Icon name="locate" size={18} />
            {retrying ? 'Se caută locația…' : 'Folosește locația live'}
          </button>
        )}
      </form>
    </Dialog>
  );
}
