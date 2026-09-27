import { useEffect, useId, useState } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, catTint, catVar } from '@/config/categories';
import { fmtAt, initials } from '@/lib/format';
import { Icon, type IconName } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { districtName, eventColor, eventTint, eventTitle } from '@/lib/status';
import type { Theme } from '@/types';
import { StatusBadge } from '@/components/events/EventBits';
import { DeleteConfirm } from '@/components/events/EventDetail';
import { AddressInput } from '@/components/ui/AddressInput';
import type { GeoResult } from '@/services/geocoding';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { roleLabel, type HistoryEntry } from '@/types/user';
import { effectiveCredibility, getReportBlock, getUserProfile, listUserHistory } from '@/services/userService';
import { LANGS, t } from '@/i18n';

const THEMES: { key: Theme; label: string; icon: IconName }[] = [
  { key: 'light', label: t('Luminoasă'), icon: 'sun' },
  { key: 'dark', label: t('Întunecată'), icon: 'moon' },
  { key: 'system', label: t('Sistem'), icon: 'monitor' },
];
const KIND_ICON = { home: 'home', work: 'briefcase', person: 'user', other: 'pin' } as const;
const HISTORY_ICON = { created: 'plus', confirmed: 'check', denied: 'x' } as const;
const HISTORY_LABEL = { created: t('Ai raportat'), confirmed: t('Ai confirmat'), denied: t('Ai negat') } as const;

export function SettingsPanel() {
  const app = useApp();
  const {
    user, theme, setTheme, lang, setLang, setModal, consent, setConsentOpen, setLegal, radius, setRadius, events, openAuth,
    logOut, deleteAccount, openEvent, deleteAsk, setDeleteAsk, deleteEvent,
    anchors, fitRadius, setSheetSnap,
  } = app;
  const isMobile = useIsMobile();
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const myReports = user
    ? events
        .filter((e) => e.authorId === user.uid)
        .sort((a, b) => (b.reportedAt ?? '').localeCompare(a.reportedAt ?? ''))
    : [];

  // Credibilitatea se schimbă pe server (voturile altora): o citim din nou la fiecare deschidere a Setărilor.
  const [cred, setCred] = useState<{ score: number; blockedUntil: Date | null } | null>(null);
  useEffect(() => {
    if (!user) {
      setCred(null);
      return;
    }
    let cancelled = false;
    void Promise.all([getUserProfile(user.uid), getReportBlock(user.uid)])
      .then(([p, until]) => {
        if (!cancelled) setCred({ score: effectiveCredibility(p ?? user), blockedUntil: until });
      })
      .catch(() => {
        if (!cancelled) setCred({ score: effectiveCredibility(user), blockedUntil: null });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const score = cred?.score ?? (user ? effectiveCredibility(user) : CONFIG.CRED_START);

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
                  {t('Credibilitate: {n}', { n: Number.isInteger(score) ? score : score.toFixed(1) })}
                </span>
              </div>
              <span className="muted xsmall">
                {t('Fiecare „Da, și la mine” la raportările tale: +{yes}. Fiecare „Nu, la mine funcționează”: −{no}. Sub {min}, nu poți raporta {days} zile.', {
                  yes: CONFIG.CRED_YES,
                  no: CONFIG.CRED_NO,
                  min: CONFIG.CRED_MIN,
                  days: CONFIG.REPORT_BLOCK_DAYS,
                })}
              </span>
              {cred?.blockedUntil && (
                <span className="small strong">{t('Poți raporta din nou pe {date}.', { date: fmtAt(cred.blockedUntil) })}</span>
              )}
            </div>
          </div>

          <section className="stack gap-8">
            <div className="stack">
              <h3 className="h3">{t('Adresele mele')}</h3>
              <span className="muted small">{t('Alertele care le afectează apar primele în listă.')}</span>
            </div>
            <AddressBook />
          </section>
        </>
      ) : (
        <div className="card card--sunk stack gap-10">
          <strong>{t('Cont')}</strong>
          <span className="muted small">{t('Contul e necesar doar pentru a raporta. Poți vedea harta fără cont.')}</span>
          <div className="grid-2">
            <button type="button" className="btn btn--primary" onClick={() => openAuth('signup')}>
              {t('Creează cont')}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => openAuth('login')}>
              {t('Intră în cont')}
            </button>
          </div>
        </div>
      )}

      <section className="stack gap-8">
        <h3 className="h3">{t('Cookie-uri și confidențialitate')}</h3>
        <span className="muted small">
          {consent?.preferences ? t('Preferințele se păstrează pe acest dispozitiv.') : t('Preferințele nu se păstrează pe acest dispozitiv.')}
        </span>
        <div className="stack gap-6">
          <button type="button" className="btn btn--secondary" onClick={() => setConsentOpen(true)}>
            <Icon name="shield" size={18} />
            {t('Setări cookie-uri')}
          </button>
          <div className="row wrap gap-8 small">
            <button type="button" className="link" onClick={() => setLegal('privacy')}>
              {t('Politica de confidențialitate')}
            </button>
            <span className="muted">·</span>
            <button type="button" className="link" onClick={() => setLegal('cookies')}>
              {t('Politica de cookie-uri')}
            </button>
          </div>
        </div>
      </section>

      <button type="button" className="btn btn--secondary" onClick={() => setModal('help')}>
        <Icon name="info" size={18} />
        {t('Cum funcționează aplicația')}
      </button>

      <section className="stack gap-8">
        <h3 className="h3">{t('Limbă')}</h3>
        <div className="seg seg--3" role="group" aria-label={t('Limbă')}>
          {LANGS.map((l) => (
            <button key={l.key} type="button" lang={l.key} className="seg__btn" aria-pressed={lang === l.key} onClick={() => setLang(l.key)}>
              {l.name}
            </button>
          ))}
        </div>
      </section>

      <section className="stack gap-8">
        <h3 className="h3">{t('Temă')}</h3>
        <div className="seg seg--3" role="group" aria-label={t('Temă')}>
          {THEMES.map((th) => (
            <button key={th.key} type="button" className="seg__btn" aria-pressed={theme === th.key} onClick={() => setTheme(th.key)}>
              <Icon name={th.icon} size={16} />
              {t(th.label)}
            </button>
          ))}
        </div>
      </section>

      <section className="stack gap-8">
        <div className="stack">
          <h3 className="h3">{t('Rază afișată')}</h3>
          <span className="muted small">
            {anchors.length > 1
              ? t('Ce evenimente vezi în jurul locației tale și al fiecărei adrese salvate. Cercurile de pe hartă arată raza aleasă.')
              : anchors.length
                ? t('Ce evenimente vezi în jurul locației tale. Cercul de pe hartă arată raza aleasă.')
                : t('Ce evenimente vezi în jurul locației tale.')}
          </span>
        </div>
        <div className="seg seg--4" role="group" aria-label={t('Rază afișată')}>
          {CONFIG.RADIUS_OPTIONS.map((r) => (
            <button
              key={String(r)}
              type="button"
              className="seg__btn"
              aria-pressed={radius === r}
              onClick={() => {
                setRadius(r);
                if (r === 'all' || !anchors.length) return;
                const radiusM: number = r;
                if (isMobile) setSheetSnap('mid');
                window.setTimeout(() => fitRadius(anchors, radiusM), isMobile ? 350 : 0);
              }}
            >
              {r === 'all' ? t('Tot orașul') : t('{km} km', { km: r / 1000 })}
            </button>
          ))}
        </div>
      </section>

      {user && (
        <>
          <section className="stack gap-8">
            <h3 className="h3">{t('Raportările mele')}</h3>
            {myReports.length === 0 && <span className="muted small">{t('Nu ai trimis încă nicio raportare.')}</span>}
            {myReports.map((e) => (
              <div key={e.id} className="stack gap-8">
                <div className="row gap-6">
                  <button type="button" className="report-row" onClick={() => openEvent(e.id)}>
                    <span
                      className="tile tile--sm"
                      style={{ background: eventTint(e), color: eventColor(e), borderColor: 'transparent' }}
                    >
                      <Icon name={SUBTYPES[e.subtype].icon} size={18} />
                    </span>
                    <span className="stack grow min0">
                      <strong className="small">{eventTitle(e)}</strong>
                      <span className="muted xsmall">
                        {districtName(e.district)} · {e.reportedAt ? fmtAt(new Date(e.reportedAt)) : ''}
                      </span>
                      <span className="badges">
                        <StatusBadge e={e} />
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger icon-btn--boxed"
                    aria-label={t('Șterge raportarea: {title}', { title: eventTitle(e) })}
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
              <h3 className="h3">{t('Istoricul meu')}</h3>
              {/* Istoricul e doar pentru citit: evenimentele vechi pot să nu mai existe, deci nu se deschid. */}
              {history.map((h) => (
                <div key={`${h.eventId}-${h.kind}`} className="report-row report-row--static">
                  <span
                    className="tile tile--sm"
                    style={{ background: catTint(h.category), color: catVar(h.category), borderColor: 'transparent' }}
                  >
                    <Icon name={HISTORY_ICON[h.kind]} size={16} />
                  </span>
                  <span className="stack grow min0">
                    <strong className="small">{h.title}</strong>
                    <span className="muted xsmall">
                      {t(HISTORY_LABEL[h.kind])} · {h.at ? fmtAt(h.at.toDate()) : ''}
                    </span>
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="stack gap-10 pb-12">
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => void logOut()}>
              <Icon name="logout" />
              {t('Ieși din cont')}
            </button>
            {confirmAccount ? (
              <div className="danger-box fade-in" role="alertdialog" aria-label={t('Confirmă ștergerea contului')}>
                <strong>{t('Ștergi contul definitiv?')}</strong>
                <span className="muted small">
                  {t('Se șterg adresele salvate și setările. Raportările trimise rămân anonime. Acțiunea nu poate fi anulată.')}
                </span>
                <div className="grid-2">
                  <button type="button" className="btn btn--secondary" onClick={() => setConfirmAccount(false)}>
                    {t('Anulează')}
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => void deleteAccount()}>
                    {t('Șterge definitiv')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirmAccount(true)}>
                <Icon name="trash" size={16} />
                {t('Șterge contul')}
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
            <span className="muted xsmall">{t('Acasă')}</span>
            <strong className="small">{home.address}</strong>
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing('home')}>
            {t('Schimbă')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--dashed" onClick={() => setEditing('home')}>
          <Icon name="home" size={16} />
          {t('Setează adresa de acasă')}
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
            aria-label={t('Șterge adresa {name}', { name: l.name })}
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
          {full
            ? t('Ai salvat {max} adrese (maximum)', { max: CONFIG.MAX_EXTRA_ADDRESSES })
            : t('Adaugă o adresă ({n} din {max})', { n: extras.length, max: CONFIG.MAX_EXTRA_ADDRESSES })}
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
      <strong className="small">{kind === 'home' ? t('Adresa de acasă') : t('Adresă nouă')}</strong>
      {kind === 'extra' && (
        <div className="field">
          <label htmlFor={`${id}-n`} className="field__label">
            {t('Cum o numești?')}
          </label>
          <input
            id={`${id}-n`}
            className="input"
            placeholder={t('ex.: Serviciu, Părinți, Grădinița')}
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-a`} className="field__label">
          {t('Adresă')}
        </label>
        <AddressInput id={`${id}-a`} value={place} onChange={setPlace} autoFocus={kind === 'home'} />
        <span className="field__hint">{t('Alege adresa din sugestii.')}</span>
      </div>
      <div className="grid-2">
        <button type="button" className="btn btn--secondary" onClick={onDone}>
          {t('Anulează')}
        </button>
        <button type="button" className="btn btn--primary" disabled={!ok || saving} onClick={() => void save()}>
          {saving ? t('Se salvează…') : t('Salvează')}
        </button>
      </div>
    </div>
  );
}
