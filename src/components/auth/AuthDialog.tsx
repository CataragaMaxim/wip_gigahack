import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
import { StreetInput } from '@/components/ui/StreetInput';

type Field = 'name' | 'email' | 'password' | 'address' | 'terms' | 'phone' | 'code';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type AuthTab = 'email' | 'phone';

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
  const [address, setAddress] = useState('');
  const [streetId, setStreetId] = useState<string | null>(null);
  const [number, setNumber] = useState('');
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
    if (mode === 'signup' && name.trim().length < 2) e.name = 'Introdu numele tău.';
    if (tab === 'email') {
      if (!email.trim()) e.email = 'Introdu adresa de email.';
      else if (!EMAIL_RE.test(email.trim())) e.email = 'Adresa de email nu pare corectă.';
      if ((mode === 'signup' || mode === 'login') && password.length < 8) e.password = 'Parola trebuie să aibă cel puțin 8 caractere.';
    }
    if (tab === 'phone') {
      if (!/^\+\d{10,15}$/.test(phone.replace(/\s/g, ''))) e.phone = 'Introdu numărul în format internațional, ex. +37369123456.';
      if (codeSent && !/^\d{4,8}$/.test(code)) e.code = 'Introdu codul din SMS.';
    }
    if (mode === 'signup' && tab === 'email') {
      if (!address.trim()) e.address = 'Alege adresa ta din listă.';
      else if (!streetId) e.address = 'Alege strada din sugestii.';
      if (!terms) e.terms = 'Pentru a crea contul, acceptă termenii.';
    }
    return e;
  }, [mode, tab, name, email, password, address, streetId, terms, phone, code, codeSent]);

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
      if (mode === 'signup' && streetId) await signUp(name, email, password, streetId, number);
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
        ? 'Creează un cont ca să raportezi'
        : 'Creează cont'
      : mode === 'login'
        ? 'Intră în cont'
        : 'Resetează parola';

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
    >
      {/* Container pentru Recaptcha invizibil (phone) */}
      <div id={`${id}-recaptcha`} ref={recaptchaRef} />

      {mode === 'sent' ? (
        <div className="stack gap-10" role="status">
          <span className="done__icon done__icon--sm">
            <Icon name="check" size={22} strokeWidth={2.4} />
          </span>
          <strong>Verifică emailul</strong>
          <span className="muted">Dacă există un cont pentru {email}, vei primi un link de resetare.</span>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => switchMode('login')}>
            Înapoi la autentificare
          </button>
        </div>
      ) : (
        <form className="stack gap-16" onSubmit={onSubmit} noValidate>
          {/* Tab-uri email / phone */}
          {(mode === 'signup' || mode === 'login') && (
            <div className="seg seg--2" role="tablist" aria-label="Metodă de autentificare">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'email'}
                className="seg__btn"
                onClick={() => { setTab('email'); setSubmitted(false); setCodeSent(false); }}
              >
                <Icon name="user" size={16} />
                Email
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'phone'}
                className="seg__btn"
                onClick={() => { setTab('phone'); setSubmitted(false); setCodeSent(false); }}
              >
                <Icon name="phone" size={16} />
                Telefon
              </button>
            </div>
          )}

          {/* Google — doar signup/login, nu forgot */}
          {(mode === 'signup' || mode === 'login') && (
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => void logInGoogle()}>
              <Icon name="external" size={18} />
              Continuă cu Google
            </button>
          )}

          {tab === 'email' && (
            <>
              {mode === 'signup' && (
                <div className="field">
                  <label htmlFor={`${id}-name`} className="field__label">Nume</label>
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
                <label htmlFor={`${id}-email`} className="field__label">Email</label>
                <input
                  id={`${id}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nume@exemplu.md"
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
                    <label htmlFor={`${id}-pw`} className="field__label">Parolă</label>
                    {mode === 'login' && (
                      <button type="button" className="link small" onClick={() => switchMode('forgot')}>
                        Am uitat parola
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
                      aria-label={showPw ? 'Ascunde parola' : 'Arată parola'}
                      onClick={() => setShowPw(!showPw)}
                    >
                      <Icon name={showPw ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                  {err('password') ?? (mode === 'signup' && <span className="field__hint">Minimum 8 caractere.</span>)}
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div className="field">
                    <label htmlFor={`${id}-addr`} className="field__label">
                      Adresă <span className="muted normal">— devine locația „Acasă”</span>
                    </label>
                    <div className="row gap-8 align-start">
                      <div className="grow min0">
                        <StreetInput
                          id={`${id}-addr`}
                          value={address}
                          streetId={streetId}
                          invalid={!!show('address')}
                          onChange={(t, s) => { setAddress(t); setStreetId(s); }}
                          onBlur={() => touch('address')}
                        />
                      </div>
                      <input
                        className="input input--nr"
                        placeholder="Nr."
                        inputMode="numeric"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                      />
                    </div>
                    {err('address')}
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} />
                    <span>Accept <a href="#termeni">Termenii</a> și <a href="#confidentialitate">Politica de confidențialitate</a>.</span>
                  </label>
                  {err('terms')}
                  <label className="check">
                    <input type="checkbox" checked={notify} onChange={() => setNotify(!notify)} />
                    <span>Vreau notificări când apare o problemă la adresele mele.</span>
                  </label>
                </>
              )}
            </>
          )}

          {tab === 'phone' && (
            <>
              <div className="field">
                <label htmlFor={`${id}-phone`} className="field__label">Număr de telefon</label>
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
                {err('phone')}
              </div>
              {codeSent && (
                <div className="field">
                  <label htmlFor={`${id}-code`} className="field__label">Cod SMS</label>
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
            </>
          )}

          {submitted && Object.keys(errors).length > 0 && (
            <p className="text-crit small strong" role="alert">
              Verifică câmpurile marcate.
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--xl">
            {tab === 'phone'
              ? codeSent ? 'Verifică codul' : 'Trimite codul SMS'
              : mode === 'signup'
                ? 'Creează cont'
                : mode === 'login'
                  ? 'Intră în cont'
                  : 'Trimite linkul de resetare'}
          </button>

          {mode === 'signup' && (
            <button type="button" className="btn btn--ghost" onClick={() => switchMode('login')}>
              Am deja cont
            </button>
          )}
          {mode === 'login' && (
            <button type="button" className="btn btn--ghost" onClick={() => switchMode('signup')}>
              Nu ai cont? Creează unul
            </button>
          )}
        </form>
      )}
    </Dialog>
  );
}