import { useMemo, useState } from 'react';
import { SUBTYPES, TYPES } from '@/config/categories';
import { hm, plural } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { DerivedEvent, SubtypeKey } from '@/types';
import { SeverityBadge } from '@/components/events/EventBits';
import { getLang, t } from '@/i18n';
import { CAL, addDays, dayKey, fromKey, startOfDay } from '@/lib/days';
import { districtName, eventColor, eventTint, eventTitle, streetLine } from '@/lib/status';



/** Cheia zilei locale: „2026-09-28”. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Filtrul calendarului: toate sau un singur tip. */
type Kind = 'all' | SubtypeKey;
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Toate' },
  ...TYPES.map((k) => ({ key: k, label: k === 'electricitate' ? 'Energie' : SUBTYPES[k].label })),
];
const matchesKind = (e: DerivedEvent, kind: Kind) => kind === 'all' || e.subtype === kind;

/**
 * În calendar: deconectările importate (`planned`) și orice anunț oficial cu dată de început
 * (inclusiv cele adăugate manual în Firestore). Raportările cetățenilor nu au program, deci nu apar.
 */
const isScheduled = (e: DerivedEvent) => !!e.startAt && (e.planned || e.sourceType === 'official');

/** Evenimentele programate din raza și categoriile alese (ca în listă: fără locație, nu filtrăm după distanță). */
function useScheduledEvents(kind: Kind) {
  const { events, radius, types } = useApp();
  return useMemo(
    () =>
      events
        .filter((e) => isScheduled(e) && e.status !== 'rezolvat' && types[e.subtype])
        .filter((e) => matchesKind(e, kind))
        .filter((e) => radius === 'all' || e.nearM == null || e.nearM <= radius)
        // Un anunț cu mai multe adrese apare o singură dată (prima lui adresă din rază).
        .filter((e, i, all) => !e.parentId || all.findIndex((x) => x.parentId === e.parentId) === i)
        .sort((a, b) => a.startAt!.localeCompare(b.startAt!)),
    [events, radius, types, kind],
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
  if (startsToday) return end ? t('de la {time}', { time: hm(start) }) : hm(start);
  if (endsToday) return t('până la {time}', { time: hm(end!) });
  return t('toată ziua');
}

export function OutageCalendar() {
  const cal = CAL[getLang()];
  const { radius, anchors, gps, openSettings, openEvent, loadState, previewDay, setPreviewDay, setSheetSnap } = useApp();
  const isMobile = useIsMobile();
  /** Clic pe o zi = harta acelei zile, imediat (calendarul rămâne deschis; pe telefon foaia coboară la jumătate). */
  const pickDay = (day: string) => {
    setPicked(day);
    setPreviewDay(day);
    if (isMobile) setSheetSnap('mid');
  };
  const [kind, setKind] = useState<Kind>('all');
  const outages = useScheduledEvents(kind);
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
  // Ziua afișată pe hartă rămâne selectată și când redeschizi calendarul.
  const selected = picked ?? previewDay ?? firstDay;
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
  // Fără locație și fără adrese salvate nu avem față de ce aplica raza.
  const noGps = !anchors.length && gps !== 'pending';
  const upcoming = outages.filter((e) => new Date(e.endAt ?? e.startAt!) >= new Date()).length;
  const scope = radius === 'all' || noGps ? t('tot orașul') : t('rază {km} km', { km: radius / 1000 });

  return (
    <div className="cal fade-in">
      <p className="muted small">
        {loadState === 'loading' ? t('Se încarcă…') : `${plural(upcoming, 'eveniment programat', 'evenimente programate')} · ${scope}`}
      </p>
      {(radius === 'all' || noGps) && (
        <div className="card card--sunk row gap-10 cal__hint">
          <Icon name="locate" size={18} />
          <span className="small grow">
            {noGps ? t('Locația e dezactivată: afișăm tot orașul.') : t('Alege o rază ca să vezi doar străzile din jurul tău.')}
          </span>
          {!noGps && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={openSettings}>
              {t('Setează raza')}
            </button>
          )}
        </div>
      )}

      <div className="seg seg--4" role="group" aria-label={t('Tipul evenimentului')}>
        {KINDS.map((k) => (
          <button key={k.key} type="button" className="seg__btn" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
            {k.key !== 'all' && <Icon name={SUBTYPES[k.key].icon} size={16} />}
            {t(k.label)}
          </button>
        ))}
      </div>

      <div className="cal__month">
        <button type="button" className="icon-btn" aria-label={t('Luna anterioară')} onClick={() => shiftMonth(-1)}>
          <Icon name="chevL" />
        </button>
        <h3 className="h3" aria-live="polite">
          {capitalize(cal.months[month.getMonth()])} {month.getFullYear()}
        </h3>
        <button type="button" className="icon-btn" aria-label={t('Luna următoare')} onClick={() => shiftMonth(1)}>
          <Icon name="chevR" />
        </button>
      </div>

      <div className="cal__grid" role="grid" aria-label={t('Calendarul evenimentelor programate')}>
        {cal.weekdays.map((w) => (
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
              aria-label={`${d.getDate()} ${cal.monthsOf[d.getMonth()]}${n ? `, ${plural(n, 'eveniment', 'evenimente')}` : ''}`}
              onClick={() => pickDay(k)}
            >
              <span>{d.getDate()}</span>
              {n > 0 && <span className="cal__dot">{n > 1 ? n : ''}</span>}
            </button>
          );
        })}
      </div>

      <section className="stack gap-8" aria-live="polite">
        <div className="row between gap-8">
          <h3 className="h3">
            {capitalize(cal.dayNames[selDate.getDay()])}, {selDate.getDate()} {cal.monthsOf[selDate.getMonth()]}
          </h3>
        </div>

        {dayList.length === 0 ? (
          <div className="card card--sunk stack gap-8">
            <span className="small muted">{t('Nimic programat în această zi.')}</span>
            {next && (
              <button type="button" className="btn btn--ghost btn--sm cal__next" onClick={() => pickDay(next)}>
                {t('Următoarea: {date}', { date: `${fromKey(next).getDate()} ${cal.monthsOf[fromKey(next).getMonth()]}` })}
                <Icon name="chevR" size={16} />
              </button>
            )}
          </div>
        ) : (
          <ul className="cal__agenda">
            {dayList.map((e) => (
              <li key={e.id}>
                <button type="button" className="cal__item" style={{ borderLeftColor: eventColor(e) }} onClick={() => openEvent(e.id, 'calendar')}>
                  <span className="stack gap-6 cal__when">
                    <span className="cal__kind" style={{ background: eventTint(e), color: eventColor(e) }} title={SUBTYPES[e.subtype].label}>
                      <Icon name={SUBTYPES[e.subtype].icon} size={16} />
                    </span>
                    <span className="cal__time">{hoursOnDay(e, selDate)}</span>
                  </span>
                  <span className="stack gap-4 grow">
                    <strong className="small">{eventTitle(e)}</strong>
                    <span className="small">{(e.allStreets ?? e.streets).map(streetLine).join(' · ')}</span>
                    <span className="xsmall muted">
                      {[districtName(e.district), e.source].filter(Boolean).join(' · ')}
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
