import { useState, type CSSProperties } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, TYPES } from '@/config/categories';
import { Icon, type IconName } from '@/lib/icons';
import { useApp } from '@/state/AppContext';
import { t } from '@/i18n';
import { Dialog } from '@/components/ui/Dialog';

export const ONBOARDED_KEY = 'wip.onboarded';
/** Crește când ghidul se schimbă (ex. noile culori ale statusurilor): cine l-a văzut îl primește din nou, o dată. */
export const ONBOARDING_VERSION = 2;

/** Ghidul de la prima vizită (redeschis din Setări): culorile statusurilor, cum citești harta, cum ajuți. */
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
  const rows: { sample: JSX.Element; title: string; text: string }[] = [
    {
      sample: <Sample bg="var(--s-official)" fg="var(--on-cat)" border="var(--s-official)" badge="shield" icon="droplet" />,
      title: 'Oficial · albastru',
      text: 'Anunț al furnizorului: Apă-Canal, Premier Energy, Energocom sau Chișinău-Gaz.',
    },
    {
      sample: <Sample bg="var(--s-confirmed)" fg="var(--on-cat)" border="var(--s-confirmed)" badge="3" icon="bolt" />,
      title: 'Confirmat · verde',
      text: 'Raportat de un vecin și confirmat de cel puțin 3 oameni din apropiere.',
    },
    {
      sample: <Sample bg="var(--s-partial)" fg="var(--on-cat)" border="var(--s-partial)" icon="flame" />,
      title: 'Parțial · galben',
      text: 'Doar o parte din adrese sau presiune/tensiune slabă: posibil afectat.',
    },
  ];
  return (
    <>
      <p className="body-text">
        {t('Harta arată deconectările de apă, energie electrică și gaz din Chișinău: anunțurile oficiale ale furnizorilor și problemele raportate de vecini.')}
      </p>
      <h3 className="h3">{t('Culoarea arată statusul')}</h3>
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
      </ul>
      <p className="muted small row gap-6 wrap">
        {t('Iconița arată tipul:')}
        {TYPES.map((k) => (
          <span key={k} className="row gap-4">
            <Icon name={SUBTYPES[k].icon} size={16} />
            {SUBTYPES[k].label}
          </span>
        ))}
      </p>
    </>
  );
}

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
  const rows: { sample: JSX.Element; title: string; text: string }[] = [
    { sample: <Sample bg="var(--surface)" fg="var(--s-reported)" border="var(--s-reported)" dashed />, title: 'Neconfirmat', text: 'Raportat recent, așteaptă confirmări. Expiră singur dacă nu le primește.' },
    { sample: <Sample bg="var(--s-closed)" fg="var(--surface)" border="var(--s-closed)" />, title: 'Rezolvat sau expirat', text: 'Problema s-a încheiat; dispare de pe hartă.' },
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
          <span className="onb__circle" style={{ borderColor: 'var(--s-official)', background: 'var(--s-official-t)' }} />
          <span className="stack">
            <strong>{t('Cercul din jurul marcajului')}</strong>
            <span className="muted small">{t('Zona afectată, în culoarea statusului: câte un cerc mic (25–55 m) pentru fiecare adresă din anunț.')}</span>
          </span>
        </li>
        <li>
          <span className="onb__circle" style={{ borderColor: 'var(--s-confirmed)', background: 'var(--s-official)', borderWidth: 4 }} />
          <span className="stack">
            <strong>{t('Cercul mare cu număr')}</strong>
            <span className="muted small">{t('Mai multe evenimente apropiate. Inelul arată câte sunt oficiale, confirmate sau parțiale; apasă ca să le vezi separat.')}</span>
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
