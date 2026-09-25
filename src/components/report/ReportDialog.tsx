import { useEffect, useId, useState } from 'react';
import { CONFIG } from '@/config/constants';
import { CATEGORIES, CATEGORY, SUBTYPES, catTint, catVar } from '@/config/categories';
import { STREETS } from '@/data/streets';
import { fmtAt } from '@/lib/format';
import { nearestStreet } from '@/lib/geo';
import { Icon } from '@/lib/icons';
import { categoryLine, metaLine, statusBadge } from '@/lib/status';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
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
  const where = r.pin ? nearestStreet(r.pin, STREETS) : null;

  const stepper = r.step !== 'done' && (
    <ol className="stepper" aria-label="Pașii raportării">
      {STEPS.map((s, i) => (
        <li key={s} className={i + 1 < idx ? 'is-done' : i + 1 === idx ? 'is-current' : ''} aria-current={i + 1 === idx ? 'step' : undefined}>
          <span />
          {s}
        </li>
      ))}
    </ol>
  );

  let body = null;
  let footer = null;

  if (r.step === 1) {
    body = (
      <>
        <h3 className="h3">Ce ai observat?</h3>
        <div className="stack gap-8">
          {CATEGORIES.map((c) => {
            const on = r.category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                className={`cat-tile ${on ? 'is-on' : ''}`}
                style={{ ['--cat' as string]: catVar(c.key), ['--cat-t' as string]: catTint(c.key) }}
                aria-pressed={on}
                onClick={() => patchReport({ category: c.key, subtype: c.subtypes.length === 1 ? c.subtypes[0] : null })}
              >
                <span className="cat-tile__icon">
                  <Icon name={c.icon} size={20} />
                </span>
                <span className="stack">
                  <strong>{c.label}</strong>
                  <span className="muted xsmall">{c.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {r.category && (
          <div className="stack gap-10 fade-in">
            <h3 className="h3">Precizează</h3>
            <div className="row wrap gap-8">
              {CATEGORY[r.category].subtypes.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip chip--lg ${r.subtype === k ? 'is-on' : ''}`}
                  style={{ ['--cat' as string]: catVar(r.category!), ['--cat-t' as string]: catTint(r.category!) }}
                  aria-pressed={r.subtype === k}
                  onClick={() => patchReport({ subtype: k })}
                >
                  <Icon name={SUBTYPES[k].icon} />
                  {SUBTYPES[k].label}
                </button>
              ))}
            </div>
          </div>
        )}
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
            <span className="xsmall strong" style={{ color: catVar(dup.category) }}>
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
            {([['total', 'Nu funcționează deloc', 'Întrerupere totală'], ['partial', 'Funcționează parțial', 'Posibil afectat']] as const).map(([k, l, h]) => (
              <button key={k} type="button" className={`option ${r.severity === k ? 'is-on' : ''}`} aria-pressed={r.severity === k} onClick={() => patchReport({ severity: k })}>
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
            <span className={`xsmall ${r.description.length > CONFIG.DESCRIPTION_MAX - 20 ? 'text-crit' : 'muted'}`} aria-live="polite">
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
        <div className="stack gap-8">
          <span className="field__label">
            Fotografie <span className="muted normal">(opțional)</span>
          </span>
          {r.photo ? (
            <div className="card card--outline row gap-12">
              <span className="photo-thumb" />
              <span className="stack grow">
                <strong className="small">fotografie.jpg</strong>
                <span className="muted xsmall">Încărcarea se conectează la stocare (Firebase Storage)</span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => patchReport({ photo: false })}>
                Elimină
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--dashed btn--lg" onClick={() => patchReport({ photo: true })}>
              <Icon name="camera" />
              Adaugă o fotografie
            </button>
          )}
        </div>
      </>
    );
    footer = (
      <>
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => (r.duplicateId ? patchReport({ step: 3 }) : goToPinStep())}>
          Înapoi
        </button>
        <button type="button" className="btn btn--primary btn--lg grow" onClick={() => patchReport({ step: 5 })}>
          Continuă
        </button>
      </>
    );
  }

  if (r.step === 5 && r.category && r.subtype) {
    const rows: [string, string][] = [
      ['Categorie', `${CATEGORY[r.category].label} · ${SUBTYPES[r.subtype].label}`],
      ['Locație', where ? `Lângă ${where.street.name}, ${where.street.district}` : '—'],
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
    <Dialog title="Semnalează o avarie" subtitle="Un semnal rapid îi avertizează pe vecini din timp." onClose={closeReport} header={stepper} footer={footer}>
      {body}
    </Dialog>
  );
}

/** Pasul 2: harta devine selector — utilizatorul o trage sub pinul fix din centru. */
export function PinCard() {
  const { report: r, patchReport, closeReport, confirmPin, userPos, locations, flyTo, mapRef, visibleCenter, setGpsNotice } = useApp();
  const [, setTick] = useState(0);
  // Actualizează adresa pinului când harta se mișcă.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || r.step !== 2) return;
    const on = () => setTick((t) => t + 1);
    m.on('move', on);
    on();
    return () => {
      m.off('move', on);
    };
  }, [mapRef, r.step]);
  if (r.step !== 2) return null;
  const c = mapRef.current ? visibleCenter() : null;
  const ns = c ? nearestStreet(c, STREETS) : null;
  const choices = [
    ...(userPos ? [{ id: 'gps', label: 'Locația mea', icon: 'locate' as const, pos: userPos }] : []),
    ...locations.map((l) => ({ id: l.id, label: l.name, icon: (l.kind === 'home' ? 'home' : l.kind === 'work' ? 'briefcase' : 'user') as 'home', pos: l.location })),
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
          <strong>{ns ? `Lângă ${ns.street.name}, ${ns.street.district}` : 'Mută harta pentru a alege locul'}</strong>
          {ns && <span className="muted xsmall">{ns.distanceM < 60 ? 'Pe stradă' : `La circa ${Math.round(ns.distanceM / 10) * 10} m de stradă`}</span>}
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
        <button type="button" className="btn btn--primary btn--lg grow" onClick={confirmPin}>
          Confirmă locația
        </button>
      </div>
    </section>
  );
}
