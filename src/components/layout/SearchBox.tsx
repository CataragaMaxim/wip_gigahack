import { useId, useMemo, useState } from 'react';
import { STREETS } from '@/data/streets';
import { midpoint } from '@/lib/geo';
import { normalize } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import type { Street } from '@/types';

export function SearchBox({ className = '' }: { className?: string }) {
  const { search, setSearch, flyTo, backToList, flash } = useApp();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();

  const suggestions = useMemo(() => {
    const q = normalize(search.trim());
    if (q.length < 2) return [];
    return STREETS.filter((s) => normalize(`${s.name} ${s.district}`).includes(q)).slice(0, 5);
  }, [search]);
  const open = focused && suggestions.length > 0;

  const pick = (s: Street) => {
    setSearch('');
    setFocused(false);
    backToList();
    flyTo(midpoint(s.path), 15);
    flash(`Harta centrată pe ${s.name}`);
  };

  return (
    <div className={`search ${className}`}>
      <label htmlFor={id} className="sr-only">
        Caută stradă sau adresă
      </label>
      <Icon name="search" size={20} strokeWidth={1.8} className="search__icon" />
      <input
        id={id}
        type="search"
        className="search__input"
        placeholder="Caută stradă sau adresă"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && suggestions[active]) {
            pick(suggestions[active]);
          } else if (e.key === 'Escape') {
            setSearch('');
          }
        }}
      />
      {search && (
        <button type="button" className="icon-btn search__clear" aria-label="Șterge căutarea" onClick={() => setSearch('')}>
          <Icon name="x" size={18} />
        </button>
      )}
      {open && (
        <ul id={`${id}-list`} role="listbox" className="search__menu fade-in">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`search__item ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
            >
              <Icon name="pin" size={16} strokeWidth={1.8} />
              <strong>{s.name}</strong>
              <span>{s.district}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
