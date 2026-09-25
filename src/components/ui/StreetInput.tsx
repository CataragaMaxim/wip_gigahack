import { useMemo, useState } from 'react';
import { STREETS } from '@/data/streets';
import { normalize } from '@/lib/format';
import { Icon } from '@/lib/icons';

interface Props {
  id: string;
  value: string;
  streetId: string | null;
  onChange: (text: string, streetId: string | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}

/** Câmp de adresă cu sugestii din străzile Chișinăului. */
export function StreetInput({ id, value, streetId, onChange, onBlur, invalid, describedBy, placeholder = 'Începe să scrii strada' }: Props) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => {
    const q = normalize(value.trim());
    if (streetId || q.length < 2) return [];
    return STREETS.filter((s) => normalize(s.name).includes(q)).slice(0, 5);
  }, [value, streetId]);
  const open = focused && suggestions.length > 0;
  return (
    <div className="street-input">
      <input
        id={id}
        className={`input ${invalid ? 'is-invalid' : ''}`}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
      />
      {open && (
        <ul role="listbox" className="street-input__menu fade-in">
          {suggestions.map((s) => (
            <li
              key={s.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(`${s.name}, ${s.district}`, s.id);
              }}
            >
              <Icon name="pin" size={15} />
              <strong>{s.name}</strong>
              <span>{s.district}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
