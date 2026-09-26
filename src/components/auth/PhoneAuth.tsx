import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { SocialAuthError, socialAuth, type AuthIntent, type PhoneVerification, type SocialProfile } from '@/services/socialAuth';

/** După cât timp se poate cere un cod nou (s). */
const RESEND_S = 30;
const CODE_LEN = 6;

/** Cifrele naționale ale unui număr moldovenesc (fără +373 / 0 la început). */
export function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('373')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}
/** Mobil în Moldova: 8 cifre, începe cu 6 sau 7 (ex. 69 123 456, 78 123 456). */
const isValidMobile = (d: string) => /^[67]\d{7}$/.test(d);
export const formatPhone = (d: string) => `+373 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`.trim();

function errorText(e: unknown, step: 'number' | 'code'): string {
  const code = e instanceof SocialAuthError ? e.code : 'failed';
  if (code === 'invalid-phone') return 'Numărul nu pare corect. Exemplu: 69 123 456';
  if (code === 'too-many-requests') return 'Prea multe încercări. Așteaptă câteva minute și încearcă din nou.';
  if (code === 'invalid-code') return 'Codul nu este corect. Verifică SMS-ul și încearcă din nou.';
  if (code === 'code-expired') return 'Codul a expirat. Cere unul nou.';
  return step === 'number'
    ? 'Nu am putut trimite codul. Verifică conexiunea și încearcă din nou.'
    : 'Nu am putut verifica codul. Verifică conexiunea și încearcă din nou.';
}

interface Props {
  intent: AuthIntent;
  onVerified: (profile: SocialProfile) => void;
}

/** Intrarea cu telefonul: numărul → cod SMS de 6 cifre. */
export function PhoneAuth({ intent, onVerified }: Props) {
  const id = useId();
  const [step, setStep] = useState<'number' | 'code'>('number');
  const [raw, setRaw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<PhoneVerification | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const open = useRef(true);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (open.current = false), []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);
  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const digits = nationalDigits(raw);

  const sendCode = async () => {
    if (busy) return;
    if (!isValidMobile(digits)) {
      setError('Numărul nu pare corect. Exemplu: 69 123 456');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const v = await socialAuth.sendPhoneCode(`+373${digits}`);
      if (!open.current) return;
      setVerification(v);
      setCode('');
      setStep('code');
      setResendIn(RESEND_S);
    } catch (e) {
      if (open.current) setError(errorText(e, 'number'));
    } finally {
      if (open.current) setBusy(false);
    }
  };

  const confirm = async (value = code) => {
    if (busy || !verification) return;
    if (value.length !== CODE_LEN) {
      setError(`Introdu codul de ${CODE_LEN} cifre din SMS.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const profile = await socialAuth.confirmPhoneCode(verification, value, intent);
      if (open.current) onVerified(profile);
    } catch (e) {
      if (!open.current) return;
      setError(errorText(e, 'code'));
      setCode('');
      codeRef.current?.focus();
    } finally {
      if (open.current) setBusy(false);
    }
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (step === 'number') void sendCode();
    else void confirm();
  };

  const errorEl = error && (
    <span id={`${id}-err`} className="field__error" role="alert">
      <Icon name="alert" size={14} strokeWidth={2.2} />
      {error}
    </span>
  );

  return (
    <form className="stack gap-16" onSubmit={onSubmit} noValidate>
      {step === 'number' ? (
        <>
          <p className="muted small">Îți trimitem prin SMS un cod de {CODE_LEN} cifre. Nu e nevoie de parolă.</p>
          <div className="field">
            <label htmlFor={`${id}-tel`} className="field__label">
              Număr de telefon
            </label>
            <div className="phone-input">
              <span className="phone-input__prefix" aria-hidden="true">
                MD +373
              </span>
              <input
                id={`${id}-tel`}
                className={`input ${error ? 'is-invalid' : ''}`}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus
                placeholder="69 123 456"
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={`${id}-err`}
              />
            </div>
            {errorEl}
          </div>
          <button type="submit" className="btn btn--primary btn--xl" disabled={busy} aria-busy={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? 'Se trimite codul…' : 'Trimite codul'}
          </button>
        </>
      ) : (
        <>
          <div className="stack gap-4">
            <span className="muted small">Am trimis codul prin SMS la</span>
            <div className="row gap-8">
              <strong>{formatPhone(digits)}</strong>
              <button
                type="button"
                className="link small"
                onClick={() => {
                  setStep('number');
                  setError(null);
                }}
              >
                Schimbă numărul
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${id}-code`} className="field__label">
              Codul din SMS
            </label>
            <input
              id={`${id}-code`}
              ref={codeRef}
              className={`input input--code ${error ? 'is-invalid' : ''}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LEN}
              placeholder="······"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, CODE_LEN);
                setCode(v);
                setError(null);
                // Codul complet (tastat sau completat automat din SMS) se verifică imediat.
                if (v.length === CODE_LEN) void confirm(v);
              }}
              aria-invalid={!!error}
              aria-describedby={`${id}-err`}
            />
            {errorEl}
          </div>
          <button type="submit" className="btn btn--primary btn--xl" disabled={busy} aria-busy={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? 'Se verifică…' : 'Confirmă'}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
            {resendIn > 0 ? `Retrimite codul în 0:${String(resendIn).padStart(2, '0')}` : 'Retrimite codul'}
          </button>
        </>
      )}
      {/* Pentru reCAPTCHA-ul invizibil cerut de Firebase la autentificarea prin telefon. */}
      <div id="recaptcha-container" />
    </form>
  );
}
