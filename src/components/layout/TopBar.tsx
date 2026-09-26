import { initials } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { SearchBox } from './SearchBox';
import { LANGS, t } from '@/i18n';

export function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <rect x="7" y="13.5" width="18" height="5" rx="2.5" fill="var(--on-ink)" opacity=".3" />
      <rect x="7" y="13.5" width="11" height="5" rx="2.5" fill="var(--on-ink)" />
    </svg>
  );
}

export function TopBar() {
  const { user, mode, openSettings, openCalendar, openAuth, backToList, mapRef } = useApp();
  const isMobile = useIsMobile();
  const goHome = () => {
    backToList();
    mapRef.current?.flyTo([47.0165, 28.842], 13, { duration: 0.6 });
  };
  return (
    <header className="topbar">
      <button type="button" className="topbar__brand" onClick={goHome} aria-label={t('Work In Progress — înapoi la hartă')}>
        <Logo />
        <span className="topbar__name">
          <strong>{t('Work In Progress')}</strong>
          <span>{t('Chișinău')}</span>
        </span>
      </button>
      {!isMobile && <SearchBox className="topbar__search" />}
      <div className="topbar__actions">
        <LangSwitch />
        <button
          type="button"
          className={`icon-btn ${mode === 'calendar' ? 'is-active' : ''}`}
          onClick={mode === 'calendar' ? backToList : openCalendar}
          aria-label={t('Calendarul evenimentelor programate')}
          aria-pressed={mode === 'calendar'}
          title={t('Calendar evenimente')}
        >
          <Icon name="calendar" size={20} strokeWidth={1.8} />
        </button>
        {user ? (
          <button
            type="button"
            className={`avatar-btn ${mode === 'settings' ? 'is-active' : ''}`}
            onClick={openSettings}
            aria-label={t('Profil și setări')}
            title={t('Profil și setări')}
          >
            <span className="avatar">{initials(user.name)}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`icon-btn ${mode === 'settings' ? 'is-active' : ''}`}
              onClick={openSettings}
              aria-label={t('Setări')}
              title={t('Setări')}
            >
              <Icon name="settings" size={20} strokeWidth={1.8} />
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => openAuth('login')}>
              <Icon name="user" size={18} />
              {!isMobile && t('Intră în cont')}
              {isMobile && <span className="sr-only">{t('Intră în cont')}</span>}
            </button>
          </>
        )}
      </div>
    </header>
  );
}

/** RO | RU — schimbă limba întregii aplicații (salvată pe dispozitiv). */
export function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <div className="lang-switch" role="group" aria-label={t('Limbă')}>
      {LANGS.map((l) => (
        <button key={l.key} type="button" lang={l.key} aria-pressed={lang === l.key} title={l.name} onClick={() => setLang(l.key)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
