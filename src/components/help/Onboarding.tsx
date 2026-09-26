import { useState, type CSSProperties } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, TYPES, typeTint, typeVar } from '@/config/categories';
import { Icon, type IconName } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { t } from '@/i18n';
import { Dialog } from '@/components/ui/Dialog';

export const ONBOARDED_KEY = 'wip.onboarded';

/** Ghidul de la prima vizită (redeschis din Setări): tipurile și culorile, cum citești harta, cum ajuți. */
export function Onboarding() {
  const { setModal } = useApp();
  const [step, setStep] = useState(0);
  const close = () => setModal(null);
  const steps = [<Welcome key="w" />, <ReadTheMap key="m" />, <HowToHelp key="h" />];
  const last = step === steps.length - 1;

  return (
    <Dialog
      title={[t('Bun venit!'), t('Cum citești harta'), t('Cum ajuți')][step]}
      subtitle={t('Pasul {n} din {total}', { n: step + 1, total: steps.length })}
      onClose={close}
      width={520}
      footer={
        <div className="row gap-8 grow">
          {step > 0 ? (
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => setStep(step - 1)}>
              {t('Înapoi')}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--lg" onClick={close}>
              {t('Sari peste')}
            </button>
          )}
          <span className="onb__dots grow" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={i === step ? 'is-on' : ''} />
            ))}
          </span>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? t('Am înțeles') : t('Mai departe')}
          </button>
        </div>
      }
    >
      <div className="onb fade-in" key={step}>
        {steps[step]}
      </div>
    </Dialog>
  );
}

function Welcome() {
  return (
    <>
      <p className="body-text">
        {t('Harta arată deconectările de apă, energie electrică și gaz din Chișinău: anunțurile oficiale ale furnizorilor și problemele raportate de vecini.')}
      </p>
      <h3 className="h3">{t('Fiecare tip are culoarea lui')}</h3>
      <ul className="onb__list">
        {TYPES.map((k) => (
          <li key={k}>
            <span className="tile" style={{ width: 40, height: 40, background: typeVar(k), color: 'var(--on-cat)', borderColor: typeVar(k), borderStyle: 'solid' }}>
              <Icon name={SUBTYPES[k].icon} size={20} />
            </span>
            <span className="stack">
              <strong>{SUBTYPES[k].label}</strong>
              <span className="muted small">{t(TYPE_SOURCES[k])}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const TYPE_SOURCES = {
  apa: 'Albastru · anunțuri Apă-Canal Chișinău și raportări',
  electricitate: 'Galben · lucrări Premier Energy și raportări',
  gaz: 'Portocaliu · anunțuri Energocom, Chișinău-Gaz și raportări',
} as const;

/** Un marcaj de exemplu, desenat ca pe hartă. */
function Sample({ bg, fg, border, dashed, badge, icon = 'bolt' }: { bg: string; fg: string; border: string; dashed?: boolean; badge?: string | IconName; icon?: IconName }) {
  const style: CSSProperties = { width: 40, height: 40, background: bg, color: fg, borderColor: border, borderStyle: dashed ? 'dashed' : 'solid' };
  return (
    <span className="onb__sample">
      <span className="tile" style={style}>
        <Icon name={icon} size={20} />
      </span>
      {badge && <span className="onb__badge">{badge === 'shield' ? <Icon name="shield" size={11} strokeWidth={2.6} /> : badge}</span>}
    </span>
  );
}

function ReadTheMap() {
  const c = typeVar('electricitate');
  const tint = typeTint('electricitate');
  const rows: { sample: JSX.Element; title: string; text: string }[] = [
    { sample: <Sample bg={c} fg="var(--on-cat)" border={c} badge="shield" />, title: 'Oficial', text: 'Anunț al furnizorului (Apă-Canal, Premier Energy, Energocom, Chișinău-Gaz). Plin = întrerupere totală.' },
    { sample: <Sample bg={c} fg="var(--on-cat)" border={c} badge="3" />, title: 'Confirmat', text: 'Raportat de un vecin și confirmat de cel puțin 3 oameni din apropiere.' },
    { sample: <Sample bg="var(--surface)" fg={c} border={c} dashed />, title: 'Neconfirmat', text: 'Raportat recent, așteaptă confirmări. Expiră singur dacă nu le primește.' },
    { sample: <Sample bg={tint} fg={c} border={c} />, title: 'Parțial', text: 'Doar o parte din adrese sau presiune/tensiune slabă: posibil afectat.' },
    { sample: <Sample bg="var(--resolved)" fg="var(--surface)" border="var(--resolved)" />, title: 'Rezolvat sau expirat', text: 'Problema s-a încheiat; dispare de pe hartă.' },
  ];
  return (
    <>
      <ul className="onb__list">
        {rows.map((r) => (
          <li key={r.title}>
            {r.sample}
            <span className="stack">
              <strong>{t(r.title)}</strong>
              <span className="muted small">{t(r.text)}</span>
            </span>
          </li>
        ))}
        <li>
          <span className="onb__circle" style={{ borderColor: c, background: tint }} />
          <span className="stack">
            <strong>{t('Cercul din jurul marcajului')}</strong>
            <span className="muted small">{t('Zona afectată: câte un cerc mic (25–55 m) pentru fiecare adresă din anunț.')}</span>
          </span>
        </li>
      </ul>
    </>
  );
}

function HowToHelp() {
  const rows: { icon: IconName; title: string; text: string; vars?: Record<string, number> }[] = [
    { icon: 'plus', title: 'Raportează o problemă', text: 'Butonul „Raportează o problemă”: alegi tipul, pui pinul pe hartă și trimiți.' },
    { icon: 'check', title: 'Confirmă ce vezi', text: 'Când ești la cel mult {m} m de o raportare, te întrebăm dacă o ai și tu. Un răspuns pe dispozitiv.', vars: { m: CONFIG.PROMPT_RADIUS_M } },
    { icon: 'calendar', title: 'Calendarul', text: 'Butonul calendar din bara de sus arată deconectările planificate, pe zile.' },
    { icon: 'home', title: 'Adresele tale', text: 'În Setări salvezi adresa de acasă și încă 5 adrese; alertele care le ating apar primele.' },
    { icon: 'settings', title: 'Limba și tema', text: 'Română, rusă sau engleză, temă luminoasă sau întunecată, din bara de sus sau din Setări.' },
  ];
  return (
    <ul className="onb__list">
      {rows.map((r) => (
        <li key={r.title}>
          <span className="onb__icon">
            <Icon name={r.icon} size={20} />
          </span>
          <span className="stack">
            <strong>{t(r.title)}</strong>
            <span className="muted small">{t(r.text, r.vars)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
