import { useState, type CSSProperties } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, TYPES, toneFg, toneLine, toneTint, toneVar, type Tone } from '@/config/categories';
import { Icon, type IconName } from '@/lib/icons';
import { stripes } from '@/lib/status';
import { useApp } from '@/state/AppContext';
import { t } from '@/i18n';
import { Dialog } from '@/components/ui/Dialog';

export const ONBOARDED_KEY = 'wip.onboarded';
/** Crește când ghidul se schimbă (ex. noile culori ale statusurilor): cine l-a văzut îl primește din nou, o dată. */
export const ONBOARDING_VERSION = 3;

/** Ghidul de la prima vizită (redeschis din „?” sau din Setări): culorile gravității, cum citești harta, cum ajuți. */
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
      sample: <Sample tone="full" badge="shield" icon="bolt" />,
      title: 'Întrerupere totală · roșu',
      text: 'Nu ai apă, curent sau gaz la adresele din anunț.',
    },
    {
      sample: <Sample tone="partial" badge="shield" icon="droplet" />,
      title: 'Parțial · galben',
      text: 'Doar o parte din adrese sau presiune/tensiune slabă: posibil afectat.',
    },
    {
      sample: <Sample tone="full" striped badge="3" icon="flame" />,
      title: 'Raportat de vecini · cu dungi',
      text: 'Aceleași culori, cu dungi oblice: problema vine de la oameni, nu de la furnizor. Cifra arată câți au confirmat.',
    },
  ];
  return (
    <>
      <p className="body-text">
        {t('Harta arată deconectările de apă, energie electrică și gaz din Chișinău: anunțurile oficiale ale furnizorilor și problemele raportate de vecini.')}
      </p>
      <h3 className="h3">{t('Culoarea arată cât de grav e')}</h3>
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

/** Un marcaj de exemplu, desenat ca pe hartă: culoarea gravității, cu dungi pentru raportările vecinilor. */
function Sample({ tone, striped, dashed, badge, icon = 'bolt' }: { tone: Tone; striped?: boolean; dashed?: boolean; badge?: string | IconName; icon?: IconName }) {
  const style: CSSProperties = {
    width: 40,
    height: 40,
    background: toneVar(tone),
    backgroundImage: striped ? stripes(toneFg(tone)) : undefined,
    color: toneFg(tone),
    borderColor: toneLine(tone),
    borderStyle: dashed ? 'dashed' : 'solid',
  };
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
    { sample: <Sample tone="full" striped dashed icon="droplet" />, title: 'Neconfirmat', text: 'Raportat recent, așteaptă confirmări. Expiră singur dacă nu le primește.' },
    { sample: <Sample tone="closed" />, title: 'Rezolvat sau expirat', text: 'Problema s-a încheiat; dispare de pe hartă.' },
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
          <span className="onb__circle" style={{ borderColor: toneLine('full'), background: toneTint('full') }} />
          <span className="stack">
            <strong>{t('Cercul din jurul marcajului')}</strong>
            <span className="muted small">{t('Zona afectată: câte un cerc mic (25–55 m) pentru fiecare adresă. Linie continuă = anunț oficial, punctată = raportare a vecinilor.')}</span>
          </span>
        </li>
        <li>
          <span className="onb__circle" style={{ borderColor: toneVar('partial'), background: toneVar('full'), borderWidth: 4 }} />
          <span className="stack">
            <strong>{t('Cercul mare cu număr')}</strong>
            <span className="muted small">{t('Mai multe evenimente apropiate. Inelul arată câte sunt totale (roșu) și parțiale (galben); apasă ca să le vezi separat.')}</span>
          </span>
        </li>
      </ul>
    </>
  );
}

function HowToHelp() {
  const rows: { icon: IconName; title: string; text: string; vars?: Record<string, number> }[] = [
    { icon: 'plus', title: 'Raportează o problemă', text: 'Butonul „Raportează o problemă”: alegi tipul, pui pinul pe hartă și trimiți.' },
    { icon: 'check', title: 'Confirmă ce vezi', text: 'Dacă ai cont și ești la cel mult {m} m de o raportare, te întrebăm dacă o ai și tu. Un răspuns pe dispozitiv.', vars: { m: CONFIG.PROMPT_RADIUS_M } },
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
