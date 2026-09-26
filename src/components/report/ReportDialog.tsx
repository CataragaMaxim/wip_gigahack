import { useEffect, useId, useState } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, TYPES, typeTint, typeVar } from '@/config/categories';
import { fmtAt } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { categoryLine, metaLine, statusBadge } from '@/lib/status';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
import { matchStreet, type StreetMatch } from '@/services/streetMatch';
import { EventTile, StatusBadge } from '@/components/events/EventBits';

const STEPS = ['Categorie', 'Locație', 'Verificare', 'Detalii', 'Trimite'];

export function ReportDialog() {
  const app = useApp();
  const { report: r, patchReport, closeReport, goToPinStep, confirmDuplicate, submitReport, viewReportResult, byId } = app;
  const id = useId();
  if (r.step === 2) return null;
  const idx = r.step === 'done' ? 6 : r.step;
  const dup = r.duplicateId ? byId[r.duplicateId] : null;
  const result = r.resultId ? byId[r.resultId] : null;

  const stepper = r.step !== 'done' && (
    <ol className="stepper" aria-label="Pașii raportării">
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={i + 1 < idx ? 'is-done' : i + 1 === idx ? 'is-current' : ''}
          aria-current={i + 1 === idx ? 'step' : undefined}
        >
          <span />
          {s}
        </li>
      ))}
    </ol>
  );

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  // ---------- Pas 1: tipul (apă, gaz, electricitate) ----------
  if (r.step === 1) {
    body = (
      <>
        <h3 className="h3">Ce ai observat?</h3>
        <div className="stack gap-8">
          {TYPES.map((k) => {
            const on = r.subtype === k;
            return (
              <button
                key={k}
                type="button"
                className={`cat-tile ${on ? 'is-on' : ''}`}
                style={{ ['--cat' as string]: typeVar(k), ['--cat-t' as string]: typeTint(k) }}
                aria-pressed={on}
                onClick={() => patchReport({ category: 'utilitati', subtype: k })}
              >
                <span className="cat-tile__icon">
                  <Icon name={SUBTYPES[k].icon} size={20} />
                </span>
                <span className="stack">
                  <strong>{SUBTYPES[k].label}</strong>
                  <span className="muted xsmall">{SUBTYPES[k].hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
    footer = (
      <>
        <button type="button" className="btn btn--secondary btn--lg" onClick={closeReport}>
          Anulează
        </button>
        <button type="button" className="btn btn--primary btn--lg grow" disabled={!r.subtype} onClick={goToPinStep}>
          Continuă
        </button>
      </>
    );
  }

  // ---------- Pas 3: Duplicat ----------
  if (r.step === 3 && dup) {
    const d = r.duplicateDistanceM ?? 0;
    const dist = `${Math.max(10, Math.round(d / 10) * 10)} m`;
    body = (
      <>
        <div className="stack gap-6">
          <h3 className="h3">Poate a fost deja semnalată</h3>
          <p className="body-text">
            {dup.sourceType === 'official'
              ? `Există deja un anunț oficial similar la ${dist}. Confirmă-l în loc să creezi o raportare nouă.`
              : `Există deja o raportare similară la ${dist}. Confirm-o în loc să creezi una nouă.`}
          </p>
        </div>
        <div className="card card--outline row gap-12 align-start">
          <EventTile e={dup} />
          <span className="stack gap-4 min0">
            <span className="xsmall strong" style={{ color: typeVar(dup.subtype) }}>
              {categoryLine(dup)}
            </span>
            <strong>{dup.title}</strong>
            <span className="muted small">{metaLine(dup)}</span>
            <span>
              <StatusBadge e={dup} />
            </span>
          </span>
        </div>
      </>
    );
    footer = (
      <>
        <button type="button" className="btn btn--secondary btn--lg grow" onClick={() => patchReport({ step: 4 })}>
          Este altă problemă
        </button>
        <button type="button" className="btn btn--primary btn--lg grow" onClick={confirmDuplicate}>
          Confirmă
        </button>
      </>
    );
  }

  // ---------- Pas 4: Detalii (severitate, descriere, foto) ----------
  if (r.step === 4) {
    body = (
      <>
        {r.noDuplicate && (
          <p className="row gap-8 muted small">
            <Icon name="check" size={16} strokeWidth={2.2} />
            Nu există raportări similare în apropiere.
          </p>
        )}

        <div className="stack gap-8">
          <h3 className="h3">Cât de gravă este?</h3>
          <div className="grid-2" role="group" aria-label="Gravitate">
            {([
              ['total', 'Nu funcționează deloc', 'Întrerupere totală'],
              ['partial', 'Funcționează parțial', 'Posibil afectat'],
            ] as const).map(([k, l, h]) => (
              <button
                key={k}
                type="button"
                className={`option ${r.severity === k ? 'is-on' : ''}`}
                aria-pressed={r.severity === k}
                onClick={() => patchReport({ severity: k })}
              >
                <strong>{l}</strong>
                <span className="muted xsmall">{h}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="row between">
            <label htmlFor={`${id}-desc`} className="field__label">
              Descriere <span className="muted normal">(opțional)</span>
            </label>
            <span
              className={`xsmall ${r.description.length > CONFIG.DESCRIPTION_MAX - 20 ? 'text-crit' : 'muted'}`}
              aria-live="polite"
            >
              {r.description.length} / {CONFIG.DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id={`${id}-desc`}
            className="input textarea"
            rows={4}
            maxLength={CONFIG.DESCRIPTION_MAX}
            placeholder="Ce se întâmplă? De exemplu: fără curent în tot blocul de la ora 12."
            value={r.description}
            onChange={(e) => patchReport({ description: e.target.value.slice(0, CONFIG.DESCRIPTION_MAX) })}
          />
        </div>

        {/* Fotografie ca URL — fără Firebase Storage */}
        <div className="stack gap-8">
          <span className="field__label">
            Fotografie <span className="muted normal">(opțional)</span>
          </span>
          {r.photo ? (
            <div className="card card--outline row gap-12">
              <img
                src={r.photo}
                alt="Previzualizare"
                style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
              />
              <span className="stack grow min0">
                <strong className="small">Fotografie atașată</strong>
                <span className="muted xsmall" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.photo}
                </span>
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => patchReport({ photo: null })}
              >
                Elimină
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--dashed btn--lg"
              onClick={() => {
                const url = window.prompt('URL-ul imaginii (fără Firebase Storage pentru demo):');
                if (url && /^https?:\/\//i.test(url)) patchReport({ photo: url });
              }}
            >
              <Icon name="camera" />
              Adaugă o fotografie (URL)
            </button>
          )}
        </div>
      </>
    );
    footer = (
      <>
        <button
          type="button"
          className="btn btn--secondary btn--lg"
          onClick={() => (r.duplicateId ? patchReport({ step: 3 }) : goToPinStep())}
        >
          Înapoi
        </button>
        <button type="button" className="btn btn--primary btn--lg grow" onClick={() => patchReport({ step: 5 })}>
          Continuă
        </button>
      </>
    );
  }

  // ---------- Pas 5: Review + trimite ----------
  if (r.step === 5 && r.category && r.subtype) {
    const rows: [string, string][] = [
      ['Tip', SUBTYPES[r.subtype].label],
      ['Locație', r.street ? [r.street.label, r.street.district].filter(Boolean).join(', ') : 'Punct pe hartă, fără stradă în apropiere'],
      ['Gravitate', r.severity === 'total' ? 'Întrerupere totală' : 'Parțial — posibil afectat'],
      ['Descriere', r.description.trim() || 'Fără descriere'],
      ['Fotografie', r.photo ? '1 fotografie' : 'Fără fotografie'],
    ];
    body = (
      <>
        <h3 className="h3">Verifică și trimite</h3>
        <dl className="review">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="card card--sunk row gap-10 align-start small">
          <Icon name="info" />
          <span>
            Semnalarea devine publică pe hartă după {CONFIG.CONFIRM_THRESHOLD} confirmări din apropiere. Până atunci o vezi doar tu și vecinii care raportează aceeași
            problemă. Fără confirmări, expiră automat după {CONFIG.REPORT_EXPIRY_H} ore.
          </span>
        </div>
      </>
    );
    footer = (
      <>
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => patchReport({ step: 4 })}>
          Înapoi
        </button>
        <button type="button" className="btn btn--primary btn--lg grow" onClick={() => void submitReport()}>
          Trimite semnalarea
        </button>
      </>
    );
  }

  // ---------- Done ----------
  if (r.step === 'done') {
    const expires = new Date(Date.now() + CONFIG.REPORT_EXPIRY_H * 36e5);
    body = (
      <div className="done" role="status">
        <span className="done__icon">
          <Icon name="check" size={30} strokeWidth={2.4} />
        </span>
        <h3>{r.confirmedDuplicate ? 'Mulțumim! Ai confirmat raportarea existentă.' : 'Raportarea ta a fost trimisă.'}</h3>
        <p>
          {r.confirmedDuplicate
            ? 'Fiecare confirmare ajută vecinii să știe că problema e reală.'
            : `Vecinii din zonă o pot confirma. Apare public pe hartă după ${CONFIG.CONFIRM_THRESHOLD} confirmări.`}
        </p>
        <p className="muted small">
          {r.confirmedDuplicate
            ? result
              ? `Status actual: ${statusBadge(result).label}.`
              : ''
            : `Dacă nu o confirmă cel puțin ${CONFIG.CONFIRM_THRESHOLD} vecini în ${CONFIG.REPORT_EXPIRY_H} ore, expiră automat (${fmtAt(expires)}).`}
        </p>
      </div>
    );
    footer = (
      <>
        <button type="button" className="btn btn--secondary btn--lg grow" onClick={closeReport}>
          Închide
        </button>
        <button type="button" className="btn btn--primary btn--lg grow" onClick={viewReportResult}>
          Vezi pe hartă
        </button>
      </>
    );
  }

  return (
    <Dialog
      title="Semnalează o avarie"
      subtitle="Un semnal rapid îi avertizează pe vecini din timp."
      onClose={closeReport}
      header={stepper}
      footer={footer}
    >
      {body}
    </Dialog>
  );
}

/** Pasul 2: harta devine selector — utilizatorul o trage sub pinul fix din centru. */
export function PinCard() {
  const {
    report: r, patchReport, closeReport, confirmPin, userPos, locations,
    flyTo, mapRef, visibleCenter, setGpsNotice,
  } = useApp();
  const [where, setWhere] = useState<{ state: 'moving' | 'loading' | 'done'; match: StreetMatch | null }>({
    state: 'moving',
    match: null,
  });

  useEffect(() => {
    const m = mapRef.current;
    if (!m || r.step !== 2) return;
    let timer = 0;
    let seq = 0;
    const onMove = () => {
      window.clearTimeout(timer);
      seq++;
      setWhere((w) => (w.state === 'moving' ? w : { state: 'moving', match: null }));
    };
    const onEnd = () => {
      window.clearTimeout(timer);
      const mine = ++seq;
      timer = window.setTimeout(async () => {
        const c = visibleCenter();
        if (!c) return;
        setWhere({ state: 'loading', match: null });
        const match = await matchStreet(c);
        if (mine === seq) setWhere({ state: 'done', match });
      }, 600);
    };
    m.on('movestart', onMove);
    m.on('moveend', onEnd);
    onEnd();
    return () => {
      window.clearTimeout(timer);
      seq++;
      m.off('movestart', onMove);
      m.off('moveend', onEnd);
    };
  }, [mapRef, r.step, visibleCenter]);

  if (r.step !== 2) return null;
  const ns = where.match;
  const choices = [
    ...(userPos ? [{ id: 'gps', label: 'Locația mea', icon: 'locate' as const, pos: userPos }] : []),
    ...locations.map((l) => ({
      id: l.id,
      label: l.name,
      icon: (l.kind === 'home' ? 'home' : l.kind === 'work' ? 'briefcase' : 'user') as 'home',
      pos: l.location,
    })),
  ];

  return (
    <section className="pin-card fade-up" aria-label="Alege locația problemei">
      <div className="row between">
        <span className="eyebrow">Pasul 2 din 5 · Locație</span>
        <button type="button" className="icon-btn" aria-label="Renunță la raportare" onClick={closeReport}>
          <Icon name="x" />
        </button>
      </div>
      <div className="stack gap-4">
        <h2 className="h2">Unde este problema?</h2>
        <span className="muted">Trage harta ca pinul să ajungă exact în locul potrivit.</span>
      </div>
      <div className="address-row" aria-live="polite">
        <Icon name="pin" />
        <span className="stack">
          <strong>
            {where.state !== 'done'
              ? where.state === 'moving'
                ? 'Mută harta pentru a alege locul'
                : 'Se identifică strada…'
              : ns
                ? [ns.label, ns.district].filter(Boolean).join(', ')
                : 'Nicio stradă în apropiere'}
          </strong>
          {where.state === 'done' && (
            <span className="muted xsmall">
              {ns
                ? !ns.onStreet
                  ? `La circa ${Math.round(ns.distanceM / 10) * 10} m de stradă`
                  : ns.distanceM <= 15
                    ? 'Pe stradă'
                    : `Pinul va fi mutat pe stradă (circa ${Math.round(ns.distanceM / 5) * 5} m)`
                : 'Apropie pinul de strada unde este problema'}
            </span>
          )}
        </span>
      </div>
      <div className="row wrap gap-6">
        {choices.map((ch) => (
          <button
            key={ch.id}
            type="button"
            className={`pill ${r.pinChoice === ch.id ? 'is-on' : ''}`}
            aria-pressed={r.pinChoice === ch.id}
            onClick={() => {
              patchReport({ pinChoice: ch.id });
              flyTo(ch.pos, 16);
            }}
          >
            <Icon name={ch.icon} size={15} />
            {ch.label}
          </button>
        ))}
        {!userPos && (
          <button type="button" className="pill" onClick={() => setGpsNotice(true)}>
            <Icon name="locate" size={15} />
            Locația mea
          </button>
        )}
      </div>
      <div className="row gap-8">
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => patchReport({ step: 1 })}>
          Înapoi
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg grow"
          onClick={() => void confirmPin()}
          disabled={r.locating}
          aria-busy={r.locating}
        >
          {r.locating ? 'Se verifică strada…' : 'Confirmă locația'}
        </button>
      </div>
    </section>
  );
}