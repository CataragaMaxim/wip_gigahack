import { useState } from 'react';
import { Icon } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { t } from '@/i18n';

/**
 * Bannerul de cookie-uri: apare la prima deschidere (și din Setări). „Necesare” sunt mereu active;
 * „Preferințe” se salvează pe dispozitiv doar cu acord. Refuzul e la fel de ușor ca acceptarea.
 */
export function ConsentBanner() {
  const { consent, consentOpen, setConsent, setConsentOpen, setLegal } = useApp();
  const [details, setDetails] = useState(!!consent);
  const [prefs, setPrefs] = useState(consent?.preferences ?? true);
  if (!consentOpen) return null;

  return (
    <div className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-title">
      <div className="consent__head">
        <span className="consent__icon" aria-hidden="true">
          <Icon name="shield" size={20} />
        </span>
        <strong id="consent-title">{t('Cookie-uri și confidențialitate')}</strong>
        {consent && (
          <button type="button" className="icon-btn icon-btn--muted" aria-label={t('Închide')} onClick={() => setConsentOpen(false)}>
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
      <p className="small muted">
        {t('Folosim doar stocarea necesară pentru funcționarea aplicației. Cu acordul tău, păstrăm pe acest dispozitiv și preferințele (limba, tema, raza, adresa introdusă). Fără publicitate și fără analiză.')}
      </p>
      <div className="row wrap gap-8 small">
        <button type="button" className="link" onClick={() => setLegal('cookies')}>
          {t('Politica de cookie-uri')}
        </button>
        <span className="muted">·</span>
        <button type="button" className="link" onClick={() => setLegal('privacy')}>
          {t('Politica de confidențialitate')}
        </button>
      </div>

      {details && (
        <div className="consent__opts fade-in">
          <label className="consent__opt">
            <span className="stack grow">
              <strong className="small">{t('Necesare')}</strong>
              <span className="xsmall muted">{t('Autentificarea, un vot pe dispozitiv, raportările tale. Mereu active.')}</span>
            </span>
            <input type="checkbox" checked disabled aria-describedby="consent-title" />
          </label>
          <label className="consent__opt">
            <span className="stack grow">
              <strong className="small">{t('Preferințe')}</strong>
              <span className="xsmall muted">{t('Limba, tema, raza, adresa introdusă, ghidul văzut.')}</span>
            </span>
            <input type="checkbox" checked={prefs} onChange={() => setPrefs(!prefs)} />
          </label>
        </div>
      )}

      <div className="consent__actions">
        {details ? (
          <button type="button" className="btn btn--primary grow" onClick={() => setConsent(prefs)}>
            {t('Salvează alegerea')}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--secondary grow" onClick={() => setConsent(false)}>
              {t('Doar necesare')}
            </button>
            <button type="button" className="btn btn--primary grow" onClick={() => setConsent(true)}>
              {t('Acceptă toate')}
            </button>
          </>
        )}
      </div>
      {!details && (
        <button type="button" className="link small consent__more" onClick={() => setDetails(true)}>
          {t('Alege ce accepți')}
        </button>
      )}
    </div>
  );
}
