import { useId, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
import { AddressInput } from '@/components/ui/AddressInput';
import type { GeoResult } from '@/services/geocoding';
import { GoogleIcon } from './ProviderIcons';
import { t } from '@/i18n';

type Field = 'name' | 'email' | 'password' | 'terms';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Autentificare: Google sau email + parolă. */

export function AuthDialog() {
  const app = useApp();
  const {
    authMode: mode, setAuthMode, authAfter, setModal,
    signUp, logIn, logInGoogle,
  } = app;
  const id = useId();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  /** Adresa „Acasă” (opțională la înregistrare; se poate seta și din Setări). */
  const [home, setHome] = useState<GeoResult | null>(null);
  const [terms, setTerms] = useState(false);
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    if (mode === 'signup' && name.trim().length < 2) e.name = t('Introdu numele tău.');
    if (!email.trim()) e.email = t('Introdu adresa de email.');
    else if (!EMAIL_RE.test(email.trim())) e.email = t('Adresa de email nu pare corectă.');
    if ((mode === 'signup' || mode === 'login') && password.length < 8) e.password = t('Parola trebuie să aibă cel puțin 8 caractere.');
    if (mode === 'signup' && !terms) e.terms = t('Pentru a crea contul, confirmă că ai citit politica de confidențialitate.');
    return e;
  }, [mode, name, email, password, terms]);

  const show = (f: Field) => (submitted || touched[f] ? errors[f] : undefined);
  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const switchMode = (m: typeof mode) => {
    setAuthMode(m);
    setSubmitted(false);
    setTouched({});
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;

    if (mode === 'forgot') return switchMode('sent');

    if (mode === 'signup') await signUp(name, email, password, home);
    if (mode === 'login') await logIn(email, password);
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
              {mode === 'signup'
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
      {mode === 'sent' ? (
        <div className="stack gap-10" role="status">
          <span className="done__icon done__icon--sm">
            <Icon name="check" size={22} strokeWidth={2.4} />
          </span>
          <strong>{t('Verifică emailul')}</strong>
          <span className="muted">{t('Dacă există un cont pentru {email}, vei primi un link de resetare.', { email })}</span>
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
                {mode === 'signup' ? t('sau creează contul cu emailul') : t('sau intră cu emailul')}
              </div>
            </>
          )}

          <div className={mode === 'signup' || mode === 'login' ? 'method__panel stack gap-12' : 'stack gap-12'}>
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
                      {t('Adresa de acasă')} <span className="muted normal">{t('— opțional')}</span>
                    </label>
                    <AddressInput id={`${id}-addr`} value={home} onChange={setHome} />
                    <span className="field__hint">{t('Te anunțăm când apare o problemă aici. Mai poți adăuga 5 adrese din Setări.')}</span>
                  </div>
                )}
          </div>

          {mode === 'signup' && (
            <>
              <label className="check">
                <input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} />
                <span>
                  {t('Am citit')}{' '}
                  <button type="button" className="link" onClick={() => app.setLegal('privacy')}>
                    {t('Politica de confidențialitate')}
                  </button>
                  .
                </span>
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