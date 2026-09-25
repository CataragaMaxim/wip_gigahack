import { useId, useState } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, catTint, catVar } from '@/config/categories';
import { fmtAt, initials } from '@/lib/format';
import { Icon, type IconName } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import type { Theme } from '@/types';
import { StatusBadge } from '@/components/events/EventBits';
import { DeleteConfirm } from '@/components/events/EventDetail';
import { StreetInput } from '@/components/ui/StreetInput';

const THEMES: { key: Theme; label: string; icon: IconName }[] = [
  { key: 'light', label: 'Luminoasă', icon: 'sun' },
  { key: 'dark', label: 'Întunecată', icon: 'moon' },
  { key: 'system', label: 'Sistem', icon: 'monitor' },
];
const KIND_ICON = { home: 'home', work: 'briefcase', person: 'user' } as const;

export function SettingsPanel() {
  const app = useApp();
  const { user, theme, setTheme, radius, setRadius, locations, events, openAuth, logOut, deleteAccount, removeLocation, openEvent, deleteAsk, setDeleteAsk, deleteEvent } = app;
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [adding, setAdding] = useState<null | 'work' | 'person'>(null);
  const myReports = user ? events.filter((e) => e.authorId === user.id).sort((a, b) => (b.reportedAt ?? '').localeCompare(a.reportedAt ?? '')) : [];

  return (
    <div className="settings fade-in">
      {user ? (
        <>
          <div className="profile">
            <span className="avatar avatar--lg">{initials(user.name)}</span>
            <div className="stack">
              <strong className="profile__name">{user.name}</strong>
              <span className="muted">{user.email}</span>
            </div>
          </div>

          <section className="stack gap-8">
            <div className="stack">
              <h3 className="h3">Adresele mele</h3>
              <span className="muted small">Alertele care le afectează apar primele în listă.</span>
            </div>
            {locations.map((l) => (
              <div key={l.id} className="address-row">
                <Icon name={KIND_ICON[l.kind]} />
                <span className="stack grow">
                  <span className="muted xsmall">{l.kind === 'home' ? 'Acasă' : l.kind === 'work' ? 'Serviciu' : `${l.name} · persoană dragă`}</span>
                  <strong className="small">{l.address}</strong>
                </span>
                {l.kind !== 'home' && (
                  <button type="button" className="icon-btn icon-btn--muted" aria-label={`Șterge adresa ${l.name}`} onClick={() => removeLocation(l.id)}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            ))}
            {adding ? (
              <AddAddressForm kind={adding} onDone={() => setAdding(null)} />
            ) : (
              <>
                {!locations.some((l) => l.kind === 'work') && (
                  <button type="button" className="btn btn--dashed" onClick={() => setAdding('work')}>
                    <Icon name="briefcase" size={16} />
                    Adaugă adresa de la serviciu
                  </button>
                )}
                <button type="button" className="btn btn--dashed" onClick={() => setAdding('person')}>
                  <Icon name="user" size={16} />
                  Adaugă adresa unei persoane dragi
                </button>
              </>
            )}
          </section>
        </>
      ) : (
        <div className="card card--sunk stack gap-10">
          <strong>Cont</strong>
          <span className="muted small">Contul e necesar doar pentru a raporta. Poți vedea harta fără cont.</span>
          <div className="grid-2">
            <button type="button" className="btn btn--primary" onClick={() => openAuth('signup')}>
              Creează cont
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => openAuth('login')}>
              Intră în cont
            </button>
          </div>
        </div>
      )}

      <section className="stack gap-8">
        <h3 className="h3">Temă</h3>
        <div className="seg seg--3" role="group" aria-label="Temă">
          {THEMES.map((t) => (
            <button key={t.key} type="button" className="seg__btn" aria-pressed={theme === t.key} onClick={() => setTheme(t.key)}>
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="stack gap-8">
        <div className="stack">
          <h3 className="h3">Rază afișată</h3>
          <span className="muted small">Ce evenimente vezi în jurul locației tale.</span>
        </div>
        <div className="seg seg--4" role="group" aria-label="Rază afișată">
          {CONFIG.RADIUS_OPTIONS.map((r) => (
            <button key={String(r)} type="button" className="seg__btn" aria-pressed={radius === r} onClick={() => setRadius(r)}>
              {r === 'all' ? 'Tot orașul' : `${r / 1000} km`}
            </button>
          ))}
        </div>
      </section>

      {user && (
        <>
          <section className="stack gap-8">
            <h3 className="h3">Raportările mele</h3>
            {myReports.length === 0 && <span className="muted small">Nu ai trimis încă nicio raportare.</span>}
            {myReports.map((e) => (
              <div key={e.id} className="stack gap-8">
                <div className="row gap-6">
                  <button type="button" className="report-row" onClick={() => openEvent(e.id)}>
                    <span className="tile tile--sm" style={{ background: catTint(e.category), color: catVar(e.category), borderColor: 'transparent' }}>
                      <Icon name={SUBTYPES[e.subtype].icon} size={18} />
                    </span>
                    <span className="stack grow min0">
                      <strong className="small">{e.title}</strong>
                      <span className="muted xsmall">
                        {e.district} · {e.reportedAt ? fmtAt(new Date(e.reportedAt)) : ''}
                      </span>
                      <span className="badges">
                        <StatusBadge e={e} />
                      </span>
                    </span>
                  </button>
                  <button type="button" className="icon-btn icon-btn--danger icon-btn--boxed" aria-label={`Șterge raportarea: ${e.title}`} onClick={() => setDeleteAsk(e.id)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                {deleteAsk === e.id && <DeleteConfirm onCancel={() => setDeleteAsk(null)} onConfirm={() => deleteEvent(e.id)} />}
              </div>
            ))}
          </section>

          <section className="stack gap-10 pb-12">
            <button type="button" className="btn btn--secondary btn--lg" onClick={logOut}>
              <Icon name="logout" />
              Ieși din cont
            </button>
            {confirmAccount ? (
              <div className="danger-box fade-in" role="alertdialog" aria-label="Confirmă ștergerea contului">
                <strong>Ștergi contul definitiv?</strong>
                <span className="muted small">Se șterg adresele salvate și setările. Raportările trimise rămân anonime. Acțiunea nu poate fi anulată.</span>
                <div className="grid-2">
                  <button type="button" className="btn btn--secondary" onClick={() => setConfirmAccount(false)}>
                    Anulează
                  </button>
                  <button type="button" className="btn btn--danger" onClick={deleteAccount}>
                    Șterge definitiv
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirmAccount(true)}>
                <Icon name="trash" size={16} />
                Șterge contul
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AddAddressForm({ kind, onDone }: { kind: 'work' | 'person'; onDone: () => void }) {
  const { addLocation } = useApp();
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [streetId, setStreetId] = useState<string | null>(null);
  const id = useId();
  const ok = !!streetId && (kind === 'work' || name.trim().length > 0);
  return (
    <div className="card card--outline stack gap-12 fade-in">
      <strong className="small">{kind === 'work' ? 'Adresa de la serviciu' : 'Adresa unei persoane dragi'}</strong>
      {kind === 'person' && (
        <div className="field">
          <label htmlFor={`${id}-n`} className="field__label">
            Cine locuiește aici?
          </label>
          <input id={`${id}-n`} className="input" placeholder="ex.: Mama, Bunicii" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-a`} className="field__label">
          Adresă
        </label>
        <StreetInput
          id={`${id}-a`}
          value={addr}
          streetId={streetId}
          onChange={(t, s) => {
            setAddr(t);
            setStreetId(s);
          }}
        />
      </div>
      <div className="grid-2">
        <button type="button" className="btn btn--secondary" onClick={onDone}>
          Anulează
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ok}
          onClick={() => {
            if (!streetId) return;
            addLocation(kind, name, streetId);
            onDone();
          }}
        >
          Salvează
        </button>
      </div>
    </div>
  );
}
