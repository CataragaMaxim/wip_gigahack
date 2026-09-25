import type { CSSProperties } from 'react';
import { SUBTYPES } from '@/config/categories';
import { Icon } from '@/lib/icons';
import { severityLabel, sourceLabel, statusBadge, tileStyle } from '@/lib/status';
import type { DerivedEvent } from '@/types';

/** Plăcuța cu iconița subtipului, stilizată ca markerul de pe hartă. */
export function EventTile({ e, size = 40 }: { e: DerivedEvent; size?: number }) {
  const t = tileStyle(e);
  const style: CSSProperties = {
    width: size,
    height: size,
    background: t.bg,
    color: t.fg,
    borderColor: t.border,
    borderStyle: t.dashed ? 'dashed' : 'solid',
    opacity: t.faded ? 0.5 : 1,
  };
  return (
    <span className="tile" style={style}>
      <Icon name={SUBTYPES[e.subtype].icon} size={Math.round(size / 2)} />
    </span>
  );
}

export function StatusBadge({ e, large = false }: { e: DerivedEvent; large?: boolean }) {
  const b = statusBadge(e);
  return (
    <span className={`${b.className} ${large ? 'badge--lg' : ''}`}>
      <Icon name={b.icon} size={large ? 14 : 12} strokeWidth={2.4} />
      {b.label}
    </span>
  );
}

export function SeverityBadge({ e, large = false }: { e: DerivedEvent; large?: boolean }) {
  const s = severityLabel(e);
  return (
    <span className={`badge badge--outline ${large ? 'badge--lg' : ''}`}>
      <span className={`sev-dot ${e.severity === 'total' ? 'is-full' : ''}`} />
      {large ? s.label : s.short}
    </span>
  );
}

export function SourceBadge({ e, large = false }: { e: DerivedEvent; large?: boolean }) {
  const s = sourceLabel(e);
  return (
    <span className={`badge badge--outline badge--muted ${large ? 'badge--lg' : ''}`}>
      {large && <Icon name={s.icon} size={14} />}
      {s.label}
    </span>
  );
}
