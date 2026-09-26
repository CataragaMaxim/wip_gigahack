import { useEffect, useId, useState } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, catTint, catVar, typeTint, typeVar } from '@/config/categories';
import { fmtAt, initials } from '@/lib/format';
import { Icon, type IconName } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import type { Theme } from '@/types';
import { StatusBadge } from '@/components/events/EventBits';
import { DeleteConfirm } from '@/components/events/EventDetail';
import { AddressInput } from '@/components/ui/AddressInput';
import type { GeoResult } from '@/services/geocoding';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { roleLabel, type HistoryEntry } from '@/types/user';
import { listUserHistory } from '@/services/userService';

const THEMES: { key: Theme; label: string; icon: IconName }[] = [
  { key: 'light', label: 'Luminoasă', icon: 'sun' },
  { key: 'dark', label: 'Întunecată', icon: 'moon' },
  { key: 'system', label: 'Sistem', icon: 'monitor' },
];
const KIND_ICON = { home: 'home', work: 'briefcase', person: 'user', other: 'pin' } as const;
const HISTORY_ICON = { created: 'plus', confirmed: 'check', denied: 'x' } as const;
const HISTORY_LABEL = { created: 'Ai raportat', confirmed: 'Ai confirmat', denied: 'Ai negat' } as const;

export function SettingsPanel() {
  const app = useApp();
  const {
    user, theme, setTheme, radius, setRadius, events, openAuth,
    logOut, deleteAccount, openEvent, deleteAsk, setDeleteAsk, deleteEvent,
    userPos, fitRadius, setSheetSnap,
  } = app;
  const isMobile = useIsMobile();
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const myReports = user
    ? events
        .filter((e) => e.authorId === user.uid)
        .sort((a, b) => (b.reportedAt ?? '').localeCompare(a.reportedAt ?? ''))
    : [];

  // Istoricul se încarcă la nevoie.
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    void listUserHistory(user.uid, 50)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="settings fade-in">
      {user ? (
        <>
          <div className="profile">
            <span className="avatar avatar--lg">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                initials(user.name)
              )}
            </span>
            <div className="stack">
              <strong className="profile__name">{user.name}</strong>
              <span className="muted">{user.email ?? user.phone ?? ''}</span>
              <div className="row gap-6 wrap">
                <span className="badge badge--outline">
                  <Icon name="shield" size={12} />
                  {roleLabel(user.userType)}
                </span>
                <span className="badge badge--outline">
                  <Icon name="check" size={12} />
                  Credibilitate: {user.credibilityScore}/100
                </span>
              </div>
            </div>
          </div>

          <section className="stack gap-8">
            <div className="stack">
              <h3 className="h3">Adresele mele</h3>
              <span className="muted small">Alertele care le afectează apar primele în listă.</span>
            </div>
            <AddressBook />
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
          <span className="muted small">
            {userPos
              ? 'Ce evenimente vezi în jurul locației tale. Cercul de pe hartă arată raza aleasă.'
              : 'Ce evenimente vezi în jurul locației tale.'}
          </span>
        </div>
        <div className="seg seg--4" role="group" aria-label="Rază afișată">
          {CONFIG.RADIUS_OPTIONS.map((r) => (
            <button
              key={String(r)}
              type="button"
              className="seg__btn"
              aria-pressed={radius === r}
              onClick={() => {
                setRadius(r);
                if (r === 'all' || !userPos) return;
                const center = userPos;
                const radiusM: number = r;
                if (isMobile) setSheetSnap('mid');
                window.setTimeout(() => fitRadius(center, radiusM), isMobile ? 350 : 0);
              }}
            >
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
                    <span
                      className="tile tile--sm"
                      style={{ background: typeTint(e.subtype), color: typeVar(e.subtype), borderColor: 'transparent' }}
                    >
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
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger icon-btn--boxed"
                    aria-label={`Șterge raportarea: ${e.title}`}
                    onClick={() => setDeleteAsk(e.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                {deleteAsk === e.id && (
                  <DeleteConfirm onCancel={() => setDeleteAsk(null)} onConfirm={() => void deleteEvent(e.id)} />
                )}
              </div>
            ))}
          </section>

          {history.length > 0 && (
            <section className="stack gap-8">
              <h3 className="h3">Istoricul meu</h3>
              {history.map((h) => (
                <button
                  key={`${h.eventId}-${h.kind}`}
                  type="button"
                  className="report-row"
                  onClick={() => openEvent(h.eventId)}
                >
                  <span
                    className="tile tile--sm"
                    style={{ background: catTint(h.category), color: catVar(h.category), borderColor: 'transparent' }}
                  >
                    <Icon name={HISTORY_ICON[h.kind]} size={16} />
                  </span>
                  <span className="stack grow min0">
                    <strong className="small">{h.title}</strong>
                    <span className="muted xsmall">
                      {HISTORY_LABEL[h.kind]} · {h.at ? fmtAt(h.at.toDate()) : ''}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          <section className="stack gap-10 pb-12">
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => void logOut()}>
              <Icon name="logout" />
              Ieși din cont
            </button>
            {confirmAccount ? (
              <div className="danger-box fade-in" role="alertdialog" aria-label="Confirmă ștergerea contului">
                <strong>Ștergi contul definitiv?</strong>
                <span className="muted small">
                  Se șterg adresele salvate și setările. Raportările trimise rămân anonime. Acțiunea nu poate fi anulată.
                </span>
                <div className="grid-2">
                  <button type="button" className="btn btn--secondary" onClick={() => setConfirmAccount(false)}>
                    Anulează
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => void deleteAccount()}>
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

/** „Acasă” + până la CONFIG.MAX_EXTRA_ADDRESSES adrese suplimentare, cu nume date de utilizator. */
function AddressBook() {
  const { locations, removeLocation } = useApp();
  const [editing, setEditing] = useState<null | 'home' | 'extra'>(null);
  const home = locations.find((l) => l.kind === 'home');
  const extras = locations.filter((l) => l.kind !== 'home');
  const full = extras.length >= CONFIG.MAX_EXTRA_ADDRESSES;

  return (
    <>
      {editing === 'home' ? (
        <AddressForm kind="home" onDone={() => setEditing(null)} />
      ) : home ? (
        <div className="address-row">
          <Icon name="home" />
          <span className="stack grow min0">
            <span className="muted xsmall">Acasă</span>
            <strong className="small">{home.address}</strong>
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing('home')}>
            Schimbă
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--dashed" onClick={() => setEditing('home')}>
          <Icon name="home" size={16} />
          Setează adresa de acasă
        </button>
      )}

      {extras.map((l) => (
        <div key={l.id} className="address-row">
          <Icon name={KIND_ICON[l.kind]} />
          <span className="stack grow min0">
            <span className="muted xsmall">{l.name}</span>
            <strong className="small">{l.address}</strong>
          </span>
          <button
            type="button"
            className="icon-btn icon-btn--muted"
            aria-label={`Șterge adresa ${l.name}`}
            onClick={() => void removeLocation(l.id)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}

      {editing === 'extra' ? (
        <AddressForm kind="extra" onDone={() => setEditing(null)} />
      ) : (
        <button type="button" className="btn btn--dashed" disabled={full} onClick={() => setEditing('extra')}>
          <Icon name="plus" size={16} />
          {full ? `Ai salvat ${CONFIG.MAX_EXTRA_ADDRESSES} adrese (maximum)` : `Adaugă o adresă (${extras.length} din ${CONFIG.MAX_EXTRA_ADDRESSES})`}
        </button>
      )}
    </>
  );
}

function AddressForm({ kind, onDone }: { kind: 'home' | 'extra'; onDone: () => void }) {
  const { addLocation, setHomeLocation } = useApp();
  const [name, setName] = useState('');
  const [place, setPlace] = useState<GeoResult | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const ok = !!place && (kind === 'home' || name.trim().length > 0);
  const save = async () => {
    if (!place || !ok) return;
    setSaving(true);
    await (kind === 'home' ? setHomeLocation(place) : addLocation(name, place));
    setSaving(false);
    onDone();
  };
  return (
    <div className="card card--outline stack gap-12 fade-in">
      <strong className="small">{kind === 'home' ? 'Adresa de acasă' : 'Adresă nouă'}</strong>
      {kind === 'extra' && (
        <div className="field">
          <label htmlFor={`${id}-n`} className="field__label">
            Cum o numești?
          </label>
          <input
            id={`${id}-n`}
            className="input"
            placeholder="ex.: Serviciu, Părinți, Grădinița"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-a`} className="field__label">
          Adresă
        </label>
        <AddressInput id={`${id}-a`} value={place} onChange={setPlace} autoFocus={kind === 'home'} />
        <span className="field__hint">Alege adresa din sugestii.</span>
      </div>
      <div className="grid-2">
        <button type="button" className="btn btn--secondary" onClick={onDone}>
          Anulează
        </button>
        <button type="button" className="btn btn--primary" disabled={!ok || saving} onClick={() => void save()}>
          {saving ? 'Se salvează…' : 'Salvează'}
        </button>
      </div>
    </div>
  );
}
