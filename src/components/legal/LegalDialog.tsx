import { useApp } from '@/state/AppContext';
import { cookiePolicy, privacyPolicy } from '@/legal/policies';
import { t } from '@/i18n';
import { Dialog } from '@/components/ui/Dialog';

/** Politica de confidențialitate / de cookie-uri, în limba interfeței; se deschide peste orice alt dialog. */
export function LegalDialog() {
  const { legal, setLegal, lang } = useApp();
  if (!legal) return null;
  const doc = legal === 'privacy' ? privacyPolicy(lang) : cookiePolicy(lang);
  return (
    <div className="legal-layer">
      <Dialog
        title={doc.title}
        subtitle={doc.updated}
        onClose={() => setLegal(null)}
        width={640}
        footer={
          <div className="row gap-8 grow">
            <button type="button" className="btn btn--ghost" onClick={() => setLegal(legal === 'privacy' ? 'cookies' : 'privacy')}>
              {legal === 'privacy' ? t('Politica de cookie-uri') : t('Politica de confidențialitate')}
            </button>
            <span className="grow" />
            <button type="button" className="btn btn--primary" onClick={() => setLegal(null)}>
              {t('Închide')}
            </button>
          </div>
        }
      >
        <article className="legal" lang={lang}>
          <p>{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h3>{s.h}</h3>
              {s.p?.map((p) => <p key={p}>{p}</p>)}
              {s.list && (
                <ul>
                  {s.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </Dialog>
    </div>
  );
}
