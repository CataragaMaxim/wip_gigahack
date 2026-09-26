import { useMemo, useState } from 'react';
import { SUBTYPES, catTint, catVar } from '@/config/categories';
import { fmtDistance, hm, plural } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import type { DerivedEvent, SubtypeKey } from '@/types';
import { SeverityBadge } from '@/components/events/EventBits';

const WEEKDAYS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
const WEEKDAY_NAMES = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const MONTH_NAMES = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

/** Cheia zilei locale: „2026-09-28”. */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Filtrul calendarului: toate sau un singur tip de deconectare. */
type Kind = 'all' | Extract<SubtypeKey, 'apa' | 'electricitate'>;
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Toate' },
  { key: 'apa', label: 'Apă' },
  { key: 'electricitate', label: 'Energie' },
];

/** Deconectările planificate din raza aleasă (ca în listă: fără locație, nu filtrăm după distanță). */
function usePlannedOutages(kind: Kind) {
  const { events, radius } = useApp();
  return useMemo(
    () =>
      events
        .filter((e) => e.planned && e.startAt && e.status !== 'rezolvat')
        .filter((e) => kind === 'all' || e.subtype === kind)
        .filter((e) => radius === 'all' || e.distanceM == null || e.distanceM <= radius)
        .sort((a, b) => a.startAt!.localeCompare(b.startAt!)),
    [events, radius, kind],
  );
}

/** Zilele (locale) acoperite de fiecare deconectare → lista deconectărilor din fiecare zi. */
function groupByDay(list: DerivedEvent[]) {
  const map = new Map<string, DerivedEvent[]>();
  for (const e of list) {
    const start = new Date(e.startAt!);
    const end = e.endAt ? new Date(e.endAt) : start;
    for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
      const k = dayKey(d);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
  }
  return map;
}

/** Intervalul din ziua respectivă: „09:00 – 21:00”, „de la 09:00”, „până la 15:00”, „toată ziua”. */
function hoursOnDay(e: DerivedEvent, day: Date): string {
  const start = new Date(e.startAt!);
  const end = e.endAt ? new Date(e.endAt) : null;
  const k = dayKey(day);
  const startsToday = dayKey(start) === k;
  const endsToday = !!end && dayKey(end) === k;
  if (startsToday && endsToday) return `${hm(start)} – ${hm(end!)}`;
  if (startsToday) return end ? `de la ${hm(start)}` : hm(start);
  if (endsToday) return `până la ${hm(end!)}`;
  return 'toată ziua';
}

export function OutageCalendar() {
  const { radius, userPos, gps, openSettings, openEvent, loadState } = useApp();
  const [kind, setKind] = useState<Kind>('all');
  const outages = usePlannedOutages(kind);
  const byDay = useMemo(() => groupByDay(outages), [outages]);
  const today = startOfDay(new Date());

  // Implicit: azi, dacă are deconectări; altfel prima zi viitoare cu deconectări.
  const firstDay = useMemo(() => {
    const k = dayKey(today);
    if (byDay.has(k)) return k;
    return [...byDay.keys()].sort().find((d) => d > k) ?? k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDay]);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? firstDay;
  const selDate = fromKey(selected);
  // Luna afișată: cea aleasă cu săgețile, altfel luna zilei selectate.
  const [shownMonth, setShownMonth] = useState<Date | null>(null);
  const month = shownMonth ?? new Date(selDate.getFullYear(), selDate.getMonth(), 1);
  const shiftMonth = (n: number) => setShownMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  // Grila lunii, începând cu luni.
  const lead = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const dayList = byDay.get(selected) ?? [];
  const next = [...byDay.keys()].sort().find((d) => d > selected);
  const noGps = !userPos && gps !== 'pending';
  const upcoming = outages.filter((e) => new Date(e.endAt ?? e.startAt!) >= new Date()).length;
  const scope = radius === 'all' || noGps ? 'tot orașul' : `rază ${radius / 1000} km`;

  return (
    <div className="cal fade-in">
      <p className="muted small">
        {loadState === 'loading' ? 'Se încarcă…' : `${plural(upcoming, 'deconectare planificată', 'deconectări planificate')} · ${scope}`}
      </p>
      {(radius === 'all' || noGps) && (
        <div className="card card--sunk row gap-10 cal__hint">
          <Icon name="locate" size={18} />
          <span className="small grow">
            {noGps ? 'Locația e dezactivată: afișăm tot orașul.' : 'Alege o rază ca să vezi doar străzile din jurul tău.'}
          </span>
          {!noGps && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={openSettings}>
              Setează raza
            </button>
          )}
        </div>
      )}

      <div className="seg seg--3" role="group" aria-label="Tipul deconectării">
        {KINDS.map((k) => (
          <button key={k.key} type="button" className="seg__btn" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
            {k.key !== 'all' && <Icon name={SUBTYPES[k.key].icon} size={16} />}
            {k.label}
          </button>
        ))}
      </div>

      <div className="cal__month">
        <button type="button" className="icon-btn" aria-label="Luna anterioară" onClick={() => shiftMonth(-1)}>
          <Icon name="chevL" />
        </button>
        <h3 className="h3" aria-live="polite">
          {capitalize(MONTH_NAMES[month.getMonth()])} {month.getFullYear()}
        </h3>
        <button type="button" className="icon-btn" aria-label="Luna următoare" onClick={() => shiftMonth(1)}>
          <Icon name="chevR" />
        </button>
      </div>

      <div className="cal__grid" role="grid" aria-label="Calendarul deconectărilor planificate">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal__wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const k = dayKey(d);
          const n = byDay.get(k)?.length ?? 0;
          const cls = ['cal__day', n ? 'has-events' : '', k === selected ? 'is-selected' : '', k === dayKey(today) ? 'is-today' : '', d < today ? 'is-past' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={k}
              type="button"
              className={cls}
              aria-pressed={k === selected}
              aria-label={`${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${n ? `, ${plural(n, 'deconectare', 'deconectări')}` : ''}`}
              onClick={() => setPicked(k)}
            >
              <span>{d.getDate()}</span>
              {n > 0 && <span className="cal__dot">{n > 1 ? n : ''}</span>}
            </button>
          );
        })}
      </div>

      <section className="stack gap-8" aria-live="polite">
        <h3 className="h3">
          {capitalize(WEEKDAY_NAMES[selDate.getDay()])}, {selDate.getDate()} {MONTH_NAMES[selDate.getMonth()]}
        </h3>
        {dayList.length === 0 ? (
          <div className="card card--sunk stack gap-8">
            <span className="small muted">Nicio deconectare planificată în această zi.</span>
            {next && (
              <button type="button" className="btn btn--ghost btn--sm cal__next" onClick={() => setPicked(next)}>
                Următoarea: {fromKey(next).getDate()} {MONTH_NAMES[fromKey(next).getMonth()]}
                <Icon name="chevR" size={16} />
              </button>
            )}
          </div>
        ) : (
          <ul className="cal__agenda">
            {dayList.map((e) => (
              <li key={e.id}>
                <button type="button" className="cal__item" onClick={() => openEvent(e.id, 'calendar')}>
                  <span className="stack gap-6 cal__when">
                    <span className="cal__kind" style={{ background: catTint(e.category), color: catVar(e.category) }} title={SUBTYPES[e.subtype].label}>
                      <Icon name={SUBTYPES[e.subtype].icon} size={16} />
                    </span>
                    <span className="cal__time">{hoursOnDay(e, selDate)}</span>
                  </span>
                  <span className="stack gap-4 grow">
                    <strong className="small">{e.title}</strong>
                    <span className="small">{e.streets.join(' · ')}</span>
                    <span className="xsmall muted">
                      {[e.district, e.distanceM != null ? fmtDistance(e.distanceM) : null, e.source].filter(Boolean).join(' · ')}
                    </span>
                    <span className="badges">
                      <SeverityBadge e={e} />
                    </span>
                  </span>
                  <Icon name="chevR" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
