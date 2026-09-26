import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, firebaseConfigured, firebaseProjectId } from '@/services/firebase';
import './telegram-link.css';

type Mode = 'login' | 'signup';
type PageState = 'ready' | 'linking' | 'linked';

const LINK_FUNCTION_URL = `https://europe-west1-${firebaseProjectId}.cloudfunctions.net/linkTelegramAccount`;

function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Emailul sau parola nu este corectă.';
  }
  if (code === 'auth/email-already-in-use') return 'Există deja un cont cu acest email. Intră în cont.';
  if (code === 'auth/weak-password') return 'Parola trebuie să aibă cel puțin 6 caractere.';
  if (code === 'auth/invalid-email') return 'Adresa de email nu pare corectă.';
  if (code === 'auth/operation-not-allowed') return 'Această metodă de autentificare nu este activată în Firebase Authentication.';
  if (code === 'auth/popup-closed-by-user') return 'Fereastra Google a fost închisă înainte de autentificare.';
  if (code === 'auth/popup-blocked') return 'Browserul a blocat fereastra Google. Permite ferestrele pop-up și încearcă din nou.';
  return 'Autentificarea nu a reușit. Verifică datele și încearcă din nou.';
}

export function TelegramLinkPage() {
  const tokenRef = useRef<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [pageState, setPageState] = useState<PageState>('ready');
  const [error, setError] = useState('');
  const [notificationSent, setNotificationSent] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    const urlToken = url.searchParams.get('token');
    if (urlToken) tokenRef.current = urlToken;
    setHasToken(Boolean(tokenRef.current));
    if (url.searchParams.has('token')) {
      url.searchParams.delete('token');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (!tokenRef.current) setError('Linkul lipsește sau a fost deja deschis. Cere un link nou cu /login în Telegram.');
    return onAuthStateChanged(auth, setUser);
  }, []);

  const linkCurrentUser = async (firebaseUser: User) => {
    if (!tokenRef.current) {
      setError('Linkul Telegram nu mai este disponibil. Cere un link nou cu /login.');
      return;
    }
    setPending(true);
    setPageState('linking');
    setError('');
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(LINK_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenRef.current, idToken }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        notificationSent?: boolean;
      };
      if (!response.ok || result.ok !== true) {
        if (response.status === 410) {
          throw new Error('Linkul a expirat sau a fost deja folosit. Cere unul nou cu /login în Telegram.');
        }
        if (response.status === 503) {
          throw new Error('Serviciul de conectare nu este disponibil încă. Încearcă din nou mai târziu.');
        }
        throw new Error('Nu am putut conecta contul. Încearcă din nou.');
      }
      tokenRef.current = null;
      setHasToken(false);
      setNotificationSent(result.notificationSent !== false);
      setPageState('linked');
    } catch (cause) {
      setPageState('ready');
      setError(
        cause instanceof TypeError
          ? 'Nu am putut contacta serviciul de conectare. Verifică dacă funcția Telegram este instalată și configurată.'
          : cause instanceof Error
            ? cause.message
            : 'Nu am putut conecta contul. Încearcă din nou.',
      );
    } finally {
      setPending(false);
    }
  };

  const submitEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const credential =
        mode === 'signup'
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);
      if (mode === 'signup' && name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }
      setUser(credential.user);
      await linkCurrentUser(credential.user);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    setPending(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      setUser(credential.user);
      await linkCurrentUser(credential.user);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  if (!firebaseConfigured) {
    return (
      <main className="telegram-link-page">
        <section className="telegram-link-card" aria-labelledby="telegram-link-title">
          <div className="telegram-link-brand">WIP <span>· Chișinău</span></div>
          <h1 id="telegram-link-title">Conectează Telegram</h1>
          <p className="telegram-link-muted">Configurația aplicației Firebase pentru web nu este setată.</p>
          <p className="telegram-link-error" role="alert">Adaugă valorile VITE_FIREBASE_* în configurația locală și în mediul de hosting.</p>
        </section>
      </main>
    );
  }

  if (pageState === 'linked') {
    return (
      <main className="telegram-link-page">
        <section className="telegram-link-card" aria-labelledby="telegram-link-title">
          <div className="telegram-link-brand">WIP <span>· Chișinău</span></div>
          <div className="telegram-link-status" aria-hidden="true">✓</div>
          <h1 id="telegram-link-title">Cont conectat</h1>
          <p className="telegram-link-muted">Contul {user?.email ? ` ${user.email}` : ''} este conectat la bot.</p>
          {notificationSent ? (
            <p className="telegram-link-note">Ți-am trimis confirmarea în Telegram. Poți reveni în chat și folosi botul.</p>
          ) : (
            <p className="telegram-link-note">Conectarea a reușit. Revino în Telegram; confirmarea automată nu a putut fi trimisă.</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="telegram-link-page">
      <section className="telegram-link-card" aria-labelledby="telegram-link-title">
        <div className="telegram-link-brand">WIP <span>· Chișinău</span></div>
        <h1 id="telegram-link-title">Conectează Telegram</h1>
        <p className="telegram-link-muted">Autentifică-te sau creează un cont pentru a-l asocia cu botul WIPNotifier.</p>

        {!hasToken && <p className="telegram-link-error" role="alert">Cere un link nou cu /login în Telegram.</p>}
        {user ? (
          <div className="telegram-link-stack">
            <p className="telegram-link-account">Autentificat ca <strong>{user.email ?? user.displayName ?? 'cont Firebase'}</strong></p>
            {error && <p className="telegram-link-error" role="alert">{error}</p>}
            <button className="telegram-link-primary" type="button" disabled={pending || !hasToken} onClick={() => void linkCurrentUser(user)}>
              {pending ? 'Se conectează…' : 'Conectează acest cont'}
            </button>
            <button className="telegram-link-secondary" type="button" disabled={pending} onClick={() => void signOut(auth)}>
              Folosește alt cont
            </button>
          </div>
        ) : (
          <>
            <button className="telegram-link-google" type="button" disabled={pending || !hasToken} onClick={() => void signInWithGoogle()}>
              {pending ? 'Se autentifică…' : 'Continuă cu Google'}
            </button>
            <div className="telegram-link-divider"><span>sau cu email</span></div>
            <form className="telegram-link-stack" onSubmit={(event) => void submitEmailAuth(event)}>
              {mode === 'signup' && (
                <label className="telegram-link-field">
                  Nume
                  <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
                </label>
              )}
              <label className="telegram-link-field">
                Email
                <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="telegram-link-field">
                Parolă
                <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
              </label>
              {error && <p className="telegram-link-error" role="alert">{error}</p>}
              <button className="telegram-link-primary" type="submit" disabled={pending || !hasToken}>
                {pending ? 'Se conectează…' : mode === 'signup' ? 'Creează cont și conectează' : 'Intră și conectează'}
              </button>
            </form>
            <p className="telegram-link-switch">
              {mode === 'login' ? 'Nu ai cont?' : 'Ai deja un cont?'}{' '}
              <button type="button" disabled={pending} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
                {mode === 'login' ? 'Creează unul' : 'Intră în cont'}
              </button>
            </p>
          </>
        )}
        {!hasToken && <p className="telegram-link-note">Linkurile de conectare sunt personale și expiră după 10 minute.</p>}
      </section>
    </main>
  );
}
