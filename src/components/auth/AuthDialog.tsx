import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
import { AddressInput } from '@/components/ui/AddressInput';
import type { GeoResult } from '@/services/geocoding';
import { GoogleIcon } from './ProviderIcons';
import { t } from '@/i18n';

type Field = 'name' | 'email' | 'password' | 'terms' | 'phone' | 'code';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type AuthTab = 'email' | 'phone';
const METHODS: { key: AuthTab; label: string; hint: string; icon: 'mail' | 'phone' }[] = [
  { key: 'email', label: 'Email', hint: 'cu parolă', icon: 'mail' },
  { key: 'phone', label: 'Telefon', hint: 'cod prin SMS', icon: 'phone' },
];

export function AuthDialog() {
  const app = useApp();
  const {
    authMode: mode, setAuthMode, authAfter, setModal,
    signUp, logIn, logInGoogle, requestPhoneCode, verifyPhoneCode,
  } = app;
  const id = useId();

  const [tab, setTab] = useState<AuthTab>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  /** Adresa „Acasă” (opțională la înregistrare; se poate seta și din Setări). */
  const [home, setHome] = useState<GeoResult | null>(null);
  const [terms, setTerms] = useState(false);
  const [notify, setNotify] = useState(true);
  const [phone, setPhone] = useState('+373');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    if (mode === 'signup' && name.trim().length < 2) e.name = t('Introdu numele tău.');
    if (tab === 'email') {
      if (!email.trim()) e.email = t('Introdu adresa de email.');
      else if (!EMAIL_RE.test(email.trim())) e.email = t('Adresa de email nu pare corectă.');
      if ((mode === 'signup' || mode === 'login') && password.length < 8) e.password = t('Parola trebuie să aibă cel puțin 8 caractere.');
    }
    if (tab === 'phone') {
      if (!/^\+\d{10,15}$/.test(phone.replace(/\s/g, ''))) e.phone = t('Introdu numărul în format internațional, ex. +37369123456.');
      if (codeSent && !/^\d{4,8}$/.test(code)) e.code = t('Introdu codul din SMS.');
    }
    if (mode === 'signup' && !terms) e.terms = t('Pentru a crea contul, acceptă termenii.');
    return e;
  }, [mode, tab, name, email, password, terms, phone, code, codeSent]);

  const show = (f: Field) => (submitted || touched[f] ? errors[f] : undefined);
  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const switchMode = (m: typeof mode) => {
    setAuthMode(m);
    setSubmitted(false);
    setTouched({});
    setCodeSent(false);
    setCode('');
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;

    if (mode === 'forgot') return switchMode('sent');

    if (tab === 'email') {
      if (mode === 'signup') await signUp(name, email, password, home);
      if (mode === 'login') await logIn(email, password);
      return;
    }

    // phone
    if (!codeSent) {
      await requestPhoneCode(phone, `${id}-recaptcha`);
      setCodeSent(true);
      return;
    }
    await verifyPhoneCode(code);
  };

  const title =
    mode === 'signup'
      ? authAfter === 'report'
        ? t('Creează un cont ca să raportezi')
        : t('Creează cont')
      : mode === 'login'
        ? t('Intră în cont')
        : t('Resetează parola');

  const err = (f: Field) =>
    show(f) ? (
      <span id={`${id}-${f}-err`} className="field__error">
        <Icon name="alert" size={14} strokeWidth={2.2} />
        {show(f)}
      </span>
    ) : null;

  return (
    <Dialog
      title={title}
      onClose={() => setModal(null)}
      onBack={mode === 'forgot' || mode === 'sent' ? () => switchMode('login') : undefined}
      width={480}
      footer={
        mode === 'sent' ? undefined : (
          <div className="stack gap-4 grow">
            <button type="submit" form={`${id}-form`} className="btn btn--primary btn--xl">
              {tab === 'phone' && mode !== 'forgot'
                ? codeSent ? t('Verifică codul') : t('Trimite codul SMS')
                : mode === 'signup'
                  ? t('Creează cont')
                  : mode === 'login'
                    ? t('Intră în cont')
                    : t('Trimite linkul de resetare')}
            </button>
            {mode === 'signup' && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => switchMode('login')}>
                {t('Am deja cont')}
              </button>
            )}
            {mode === 'login' && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => switchMode('signup')}>
                {t('Nu ai cont? Creează unul')}
              </button>
            )}
          </div>
        )
      }
    >
      {/* Container pentru Recaptcha invizibil (phone) */}
      <div id={`${id}-recaptcha`} ref={recaptchaRef} style={{ position: 'absolute' }} />

      {mode === 'sent' ? (
        <div className="stack gap-10" role="status">
          <span className="done__icon done__icon--sm">
            <Icon name="check" size={22} strokeWidth={2.4} />
          </span>
          <strong>{t('Verifică emailul')}</strong>
          <span className="muted">Dacă există un cont pentru {email}, vei primi un link de resetare.</span>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => switchMode('login')}>
            {t('Înapoi la autentificare')}
          </button>
        </div>
      ) : (
        <form id={`${id}-form`} className="stack gap-12" onSubmit={onSubmit} noValidate>
          {/* Google — doar signup/login, nu forgot */}
          {(mode === 'signup' || mode === 'login') && (
            <>
              <button type="button" className="btn btn--secondary btn--lg" onClick={() => void logInGoogle()}>
                <GoogleIcon size={18} />
                {t('Continuă cu Google')}
              </button>
              <div className="divider" role="separator">
                {mode === 'signup' ? t('sau creează contul cu') : t('sau intră cu')}
              </div>
              {/* Metoda: două carduri, cel ales e marcat clar; câmpurile lui stau în cadrul de dedesubt. */}
              <div className="method" role="tablist" aria-label={t('Metodă de autentificare')}>
                {METHODS.map((m) => {
                  const on = tab === m.key;
                  return (
                    <button
                      key={m.key}
                      id={`${id}-tab-${m.key}`}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      aria-controls={`${id}-panel`}
                      className={`method__card ${on ? 'is-on' : ''}`}
                      onClick={() => {
                        setTab(m.key);
                        setSubmitted(false);
                        setCodeSent(false);
                      }}
                    >
                      <span className="method__icon">
                        <Icon name={m.icon} size={18} />
                      </span>
                      <span className="stack">
                        <strong>{t(m.label)}</strong>
                        <span className="xsmall muted">{t(m.hint)}</span>
                      </span>
                      <span className="method__check" aria-hidden="true">
                        {on && <Icon name="check" size={14} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div
            id={`${id}-panel`}
            className={mode === 'signup' || mode === 'login' ? 'method__panel stack gap-12' : 'stack gap-12'}
            role={mode === 'signup' || mode === 'login' ? 'tabpanel' : undefined}
            aria-labelledby={mode === 'signup' || mode === 'login' ? `${id}-tab-${tab}` : undefined}
          >
            {tab === 'email' && (
              <>
                {mode === 'signup' && (
                  <div className="field">
                    <label htmlFor={`${id}-name`} className="field__label">{t('Nume')}</label>
                    <input
                      id={`${id}-name`}
                      className={`input ${show('name') ? 'is-invalid' : ''}`}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => touch('name')}
                    />
                    {err('name')}
                  </div>
                )}

                <div className="field">
                  <label htmlFor={`${id}-email`} className="field__label">{t('Email')}</label>
                  <input
                    id={`${id}-email`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t('nume@exemplu.md')}
                    className={`input ${show('email') ? 'is-invalid' : ''}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => touch('email')}
                  />
                  {err('email')}
                </div>

                {(mode === 'signup' || mode === 'login') && (
                  <div className="field">
                    <div className="row between">
                      <label htmlFor={`${id}-pw`} className="field__label">{t('Parolă')}</label>
                      {mode === 'login' && (
                        <button type="button" className="link small" onClick={() => switchMode('forgot')}>
                          {t('Am uitat parola')}
                        </button>
                      )}
                    </div>
                    <div className="input-wrap">
                      <input
                        id={`${id}-pw`}
                        type={showPw ? 'text' : 'password'}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        className={`input ${show('password') ? 'is-invalid' : ''}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => touch('password')}
                      />
                      <button
                        type="button"
                        className="icon-btn input-wrap__btn"
                        aria-label={showPw ? t('Ascunde parola') : t('Arată parola')}
                        onClick={() => setShowPw(!showPw)}
                      >
                        <Icon name={showPw ? 'eyeOff' : 'eye'} />
                      </button>
                    </div>
                    {err('password') ?? (mode === 'signup' && <span className="field__hint">{t('Minimum 8 caractere.')}</span>)}
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="field">
                    <label htmlFor={`${id}-addr`} className="field__label">
                      Adresa de acasă <span className="muted normal">{t('— opțional')}</span>
                    </label>
                    <AddressInput id={`${id}-addr`} value={home} onChange={setHome} />
                    <span className="field__hint">{t('Te anunțăm când apare o problemă aici. Mai poți adăuga 5 adrese din Setări.')}</span>
                  </div>
                )}
              </>
            )}

            {tab === 'phone' && (
              <>
                <div className="field">
                  <label htmlFor={`${id}-phone`} className="field__label">{t('Număr de telefon')}</label>
                  <input
                    id={`${id}-phone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+37369123456"
                    className={`input ${show('phone') ? 'is-invalid' : ''}`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => touch('phone')}
                    disabled={codeSent}
                  />
                  {err('phone') ?? <span className="field__hint">{t('Îți trimitem un cod prin SMS.')}</span>}
                </div>
                {codeSent && (
                  <div className="field">
                    <label htmlFor={`${id}-code`} className="field__label">{t('Cod SMS')}</label>
                    <input
                      id={`${id}-code`}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className={`input ${show('code') ? 'is-invalid' : ''}`}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => touch('code')}
                    />
                    {err('code')}
                  </div>
                )}
                {mode === 'signup' && (
                  <span className="field__hint">{t('Adresa de acasă și încă 5 adrese le poți seta după, din Setări.')}</span>
                )}
              </>
            )}
          </div>

          {mode === 'signup' && (
            <>
              <label className="check">
                <input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} />
                <span>{t('Accept')} <a href="#termeni">{t('Termenii')}</a> {t('și')} <a href="#confidentialitate">{t('Politica de confidențialitate')}</a>.</span>
              </label>
              {err('terms')}
              <label className="check">
                <input type="checkbox" checked={notify} onChange={() => setNotify(!notify)} />
                <span>{t('Vreau notificări când apare o problemă la adresele mele.')}</span>
              </label>
            </>
          )}

          {submitted && Object.keys(errors).length > 0 && (
            <p className="text-crit small strong" role="alert">
              {t('Verifică câmpurile marcate.')}
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}