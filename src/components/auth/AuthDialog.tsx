import { useId, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { Dialog } from '@/components/ui/Dialog';
import { StreetInput } from '@/components/ui/StreetInput';

type Field = 'name' | 'email' | 'password' | 'address' | 'terms';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Un singur ecran de cont: creare, autentificare, resetare parolă. */
export function AuthDialog() {
  const { authMode: mode, setAuthMode, authAfter, setModal, signUp, logIn } = useApp();
  const id = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [address, setAddress] = useState('');
  const [streetId, setStreetId] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [terms, setTerms] = useState(false);
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    if (mode === 'signup' && name.trim().length < 2) e.name = 'Introdu numele tău.';
    if (!email.trim()) e.email = 'Introdu adresa de email.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Adresa de email nu pare corectă. Exemplu: nume@exemplu.md';
    if ((mode === 'signup' || mode === 'login') && password.length < 8) e.password = 'Parola trebuie să aibă cel puțin 8 caractere.';
    if (mode === 'signup') {
      if (!address.trim()) e.address = 'Alege adresa ta din listă.';
      else if (!streetId) e.address = 'Alege strada din sugestii, ca să o putem găsi pe hartă.';
      if (!terms) e.terms = 'Pentru a crea contul, acceptă termenii.';
    }
    return e;
  }, [mode, name, email, password, address, streetId, terms]);

  const show = (f: Field) => (submitted || touched[f] ? errors[f] : undefined);
  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const switchMode = (m: typeof mode) => {
    setAuthMode(m);
    setSubmitted(false);
    setTouched({});
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    if (mode === 'forgot') return switchMode('sent');
    if (mode === 'signup' && streetId) signUp(name, email, streetId, number);
    if (mode === 'login') logIn(email);
  };

  const title =
    mode === 'signup' ? (authAfter === 'report' ? 'Creează un cont ca să raportezi' : 'Creează cont') : mode === 'login' ? 'Intră în cont' : 'Resetează parola';
  const nErr = Object.keys(errors).length;

  const err = (f: Field) =>
    show(f) ? (
      <span id={`${id}-${f}-err`} className="field__error">
        <Icon name="alert" size={14} strokeWidth={2.2} />
        {show(f)}
      </span>
    ) : null;

  return (
    <Dialog title={title} onClose={() => setModal(null)} onBack={mode === 'forgot' || mode === 'sent' ? () => switchMode('login') : undefined} width={480}>
      {mode === 'sent' ? (
        <div className="stack gap-10" role="status">
          <span className="done__icon done__icon--sm">
            <Icon name="check" size={22} strokeWidth={2.4} />
          </span>
          <strong>Verifică emailul</strong>
          <span className="muted">Dacă există un cont pentru {email}, vei primi un link de resetare în câteva minute.</span>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => switchMode('login')}>
            Înapoi la autentificare
          </button>
        </div>
      ) : (
        <form className="stack gap-16" onSubmit={onSubmit} noValidate>
          {mode === 'signup' && (
            <div className="card card--sunk row gap-10 align-start small">
              <Icon name="info" />
              <span>Contul e necesar doar pentru a raporta. Poți vedea harta fără cont.</span>
            </div>
          )}
          {mode === 'forgot' && <p className="muted small">Introdu adresa de email a contului. Îți trimitem un link pentru o parolă nouă.</p>}

          {mode === 'signup' && (
            <div className="field">
              <label htmlFor={`${id}-name`} className="field__label">
                Nume
              </label>
              <input id={`${id}-name`} className={`input ${show('name') ? 'is-invalid' : ''}`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} aria-invalid={!!show('name')} aria-describedby={`${id}-name-err`} />
              {err('name')}
            </div>
          )}

          <div className="field">
            <label htmlFor={`${id}-email`} className="field__label">
              Email
            </label>
            <input id={`${id}-email`} type="email" inputMode="email" autoComplete="email" placeholder="nume@exemplu.md" className={`input ${show('email') ? 'is-invalid' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch('email')} aria-invalid={!!show('email')} aria-describedby={`${id}-email-err`} />
            {err('email')}
          </div>

          {(mode === 'signup' || mode === 'login') && (
            <div className="field">
              <div className="row between">
                <label htmlFor={`${id}-pw`} className="field__label">
                  Parolă
                </label>
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
                  aria-invalid={!!show('password')}
                  aria-describedby={`${id}-password-err`}
                />
                <button type="button" className="icon-btn input-wrap__btn" aria-label={showPw ? 'Ascunde parola' : 'Arată parola'} onClick={() => setShowPw(!showPw)}>
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
                      describedBy={`${id}-address-err`}
                      onChange={(t, s) => {
                        setAddress(t);
                        setStreetId(s);
                      }}
                      onBlur={() => touch('address')}
                    />
                  </div>
                  <label htmlFor={`${id}-nr`} className="sr-only">
                    Număr
                  </label>
                  <input id={`${id}-nr`} className="input input--nr" placeholder="Nr." inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
                {err('address')}
              </div>
              <div className="stack gap-10">
                <label className="check">
                  <input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} aria-describedby={`${id}-terms-err`} />
                  <span>
                    Accept <a href="#termeni">Termenii de utilizare</a> și <a href="#confidentialitate">Politica de confidențialitate</a>.
                  </span>
                </label>
                {err('terms')}
                <label className="check">
                  <input type="checkbox" checked={notify} onChange={() => setNotify(!notify)} />
                  <span>
                    Vreau notificări când apare o problemă la adresele mele. <span className="muted">Opțional, le poți opri oricând.</span>
                  </span>
                </label>
              </div>
            </>
          )}

          {submitted && nErr > 0 && (
            <p className="text-crit small strong" role="alert">
              {nErr === 1 ? 'Verifică câmpul marcat.' : `Verifică cele ${nErr} câmpuri marcate.`}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--xl">
            {mode === 'signup' ? 'Creează cont' : mode === 'login' ? 'Intră în cont' : 'Trimite linkul de resetare'}
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
