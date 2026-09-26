import { useEffect, useMemo, useState } from 'react';
import { CONFIG } from '@/config/constants';
import { SUBTYPES, typeTint, typeVar } from '@/config/categories';
import { fmtAgo } from '@/lib/format';
import { distance } from '@/lib/geo';
import { Icon } from '@/lib/icons';
import { load, save } from '@/lib/storage';
import { useApp } from '@/state/AppContext';
import { t } from '@/i18n';
import { eventTitle } from '@/lib/status';

const DISMISSED_KEY = 'wip.promptDismissed';

/**
 * „Ai și tu problema asta?” — apare când ești la cel mult PROMPT_RADIUS_M de o raportare a vecinilor
 * activă, pe care n-ai votat-o și n-ai închis-o. Una singură odată, cea mai apropiată.
 */
export function ProximityPrompt() {
  const { events, userPos, userAccuracy, votes, vote, user, online, modal, openEvent } = useApp();
  const [dismissed, setDismissed] = useState<Record<string, true>>(() => load(DISMISSED_KEY, {}));
  useEffect(() => save(DISMISSED_KEY, dismissed), [dismissed]);

  const target = useMemo(() => {
    if (!userPos || !online) return null;
    let best = null;
    let bd = Infinity;
    for (const e of events) {
      if (e.sourceType !== 'citizen' || (e.status !== 'raportat' && e.status !== 'confirmat')) continue;
      if (votes[e.id] || dismissed[e.id] || (user && e.authorId === user.uid)) continue;
      const d = distance(userPos, e.location);
      // 50 m + eroarea GPS (plafonată), ca un vecin aflat chiar lângă raportare să fie întrebat și cu GPS imprecis.
      if (d <= CONFIG.PROMPT_RADIUS_M + Math.min(userAccuracy, CONFIG.PROMPT_ACCURACY_MAX_M) && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }, [events, userPos, userAccuracy, votes, dismissed, user, online]);

  if (!target || modal) return null;
  const sub = SUBTYPES[target.subtype];
  const close = () => setDismissed((d) => ({ ...d, [target.id]: true }));

  return (
    <div className="nearby" role="dialog" aria-live="polite" aria-labelledby="nearby-title" key={target.id}>
      <span className="nearby__pulse" style={{ background: typeVar(target.subtype) }} aria-hidden="true" />
      <div className="nearby__head">
        <span className="nearby__icon" style={{ background: typeTint(target.subtype), color: typeVar(target.subtype) }}>
          <Icon name={sub.icon} size={22} />
        </span>
        <span className="stack grow">
          <strong id="nearby-title">{t('Ai și tu problema asta?')}</strong>
          <span className="muted small">
            {eventTitle(target)}
            {target.streets[0] ? ` · ${target.streets[0]}` : ''}
            {target.reportedAt ? ` · ${t('raportat {ago}', { ago: fmtAgo(new Date(target.reportedAt)) })}` : ''}
          </span>
        </span>
        <button type="button" className="icon-btn icon-btn--muted" aria-label={t('Închide')} onClick={close}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="xsmall muted">
        {t('Un vecin a raportat-o chiar lângă tine.')}{' '}
        {target.conf > 0
          ? t('{n} din {total} confirmări până acum.', { n: target.conf, total: CONFIG.CONFIRM_THRESHOLD })
          : t('Sunt necesare {total} confirmări.', { total: CONFIG.CONFIRM_THRESHOLD })}
      </p>
      <div className="row gap-8">
        <button type="button" className="btn btn--primary grow" onClick={() => void vote(target.id, 'yes')}>
          <Icon name="check" size={18} strokeWidth={2.4} />
          {t('Da, confirm')}
        </button>
        <button type="button" className="btn btn--secondary grow" onClick={() => void vote(target.id, 'no')}>
          {t('Nu, la mine merge')}
        </button>
      </div>
      <button type="button" className="link small nearby__more" onClick={() => openEvent(target.id)}>
        {t('Vezi detalii')}
      </button>
    </div>
  );
}
