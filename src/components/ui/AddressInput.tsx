import { useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';
import { searchAddress, type GeoResult } from '@/services/geocoding';

interface Props {
  id: string;
  /** Adresa aleasă (null = încă nealeasă din sugestii). */
  value: GeoResult | null;
  onChange: (place: GeoResult | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Textul afișat al unei adrese: „Str. Ismail 88, Centru, Chișinău”. */
export const placeLabel = (p: GeoResult) => (p.detail ? `${p.label}, ${p.detail}` : p.label);

/**
 * Adresă reală din Chișinău (OpenStreetMap / Nominatim), cu numărul casei.
 * Sugestiile apar după 3 litere; adresa e validă doar după ce e aleasă din listă.
 */
export function AddressInput({ id, value, onChange, onBlur, invalid, describedBy, placeholder = 'Stradă și număr, ex.: Ismail 88', autoFocus }: Props) {
  const [query, setQuery] = useState(value ? placeLabel(value) : '');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  // Căutare cu debounce (Nominatim permite max. 1 cerere/secundă).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || (value && q === placeLabel(value))) {
      setResults([]);
      setState('idle');
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setState('loading');
      try {
        // Nominatim întoarce aceeași adresă de mai multe ori (clădire, scări, intrări): o păstrăm o dată.
        const seen = new Set<string>();
        const r = (await searchAddress(q, ctrl.signal)).filter((x) => !seen.has(placeLabel(x)) && seen.add(placeLabel(x)));
        setResults(r);
        setActive(0);
        setState(r.length ? 'idle' : 'empty');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState('error');
      }
    }, 600);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query, value]);

  const choose = (r: GeoResult) => {
    onChange(r);
    setQuery(placeLabel(r));
    setResults([]);
  };
  const open = focused && (results.length > 0 || state !== 'idle');

  return (
    <div className="street-input">
      <div className="input-wrap">
        <input
          id={id}
          className={`input ${invalid ? 'is-invalid' : ''}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={placeholder}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(results[active]);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
        />
        {value && (
          <span className="input-wrap__btn address-input__ok" aria-hidden="true">
            <Icon name="check" size={18} strokeWidth={2.4} />
          </span>
        )}
      </div>
      {open && (
        <ul role="listbox" className="street-input__menu fade-in">
          {state === 'loading' && <li className="muted">Se caută…</li>}
          {state === 'empty' && <li className="muted">Nicio adresă găsită. Încearcă doar strada și numărul.</li>}
          {state === 'error' && <li className="muted">Căutarea nu răspunde. Încearcă din nou.</li>}
          {state === 'idle' &&
            results.map((r, i) => (
              <li
                key={r.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'is-active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
              >
                <Icon name="pin" size={15} />
                <strong>{r.label}</strong>
                <span>{r.detail}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
