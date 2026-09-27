import { CONFIG } from '@/config/constants';
import { typeTint, typeVar } from '@/config/categories';
import { fmtAgo, fmtAt, initialsInScript, plural } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { categoryLine, countdown, districtName, eventTitle, isClosed, streetLine } from '@/lib/status';
import { useApp } from '@/state/AppContext';
import type { DerivedEvent } from '@/types';
import { EventTile, SeverityBadge, SourceBadge, StatusBadge } from './EventBits';
import { t } from '@/i18n';

const AVATAR_POOL = ['AM', 'IC', 'DR', 'VP', 'EL', 'NS', 'OT', 'MG', 'CB', 'LS'];

/** @param showActions false când „Urmărește / Distribuie” stau în subsolul fix al bottom sheet-ului (mobil, starea 'tall'). */
export function EventDetail({ e, showActions = true }: { e: DerivedEvent; showActions?: boolean }) {
  const { votes, vote, online, userPos, user, deleteAsk, setDeleteAsk, deleteEvent } = useApp();
  const official = e.sourceType === 'official';
  const closed = isClosed(e.status);
  const cd = countdown(e);
  const myVote = votes[e.id];
  const near = e.distanceM != null && e.distanceM <= CONFIG.VOTE_RADIUS_M;
  const isMine = !!user && e.authorId === user.uid;

  let voteBlocked = '';
  if (!myVote) {
    if (!online) voteBlocked = t('Confirmarea necesită conexiune la internet.');
    else if (!userPos) voteBlocked = t('Poți confirma doar dacă ești în apropiere. Activează locația pentru a vota.');
    else if (!near)
      voteBlocked = t('Poți confirma doar dacă ești în apropiere (până la {km} km).', { km: CONFIG.VOTE_RADIUS_M / 1000 });
  }

  const hash = [...e.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const avatars = Array.from({ length: Math.min(3, e.conf) }, (_, i) =>
    myVote === 'yes' && i === 0 ? t('Tu') : initialsInScript(AVATAR_POOL[(hash + i * 3) % AVATAR_POOL.length]),
  );

  return (
    <div className="detail fade-in">
      <div className="detail__head">
        <EventTile e={e} size={52} />
        <div className="stack gap-4">
          <span className="detail__cat" style={{ color: typeVar(e.subtype) }}>
            {categoryLine(e)}
          </span>
          <h2 className="detail__title">{eventTitle(e)}</h2>
          {e.district && <span className="muted small">{districtName(e.district)}</span>}
        </div>
      </div>

      <div className="badges">
        <StatusBadge e={e} large />
        <SeverityBadge e={e} large />
        <SourceBadge e={e} large />
      </div>

      {e.affects.length > 0 && (
        <div className="affects">
          <Icon name="home" />
          <span>
            {t('Afectează locația ta:')} <strong>{e.affects.join(', ')}</strong>
          </span>
        </div>
      )}

      {cd && (
        <div className="countdown" style={{ background: typeTint(e.subtype) }}>
          <span style={{ color: typeVar(e.subtype) }}>
            <Icon name="clock" size={22} />
          </span>
          <span className="stack">
            <strong>{cd.title}</strong>
            <span className="muted small">{cd.sub}</span>
          </span>
        </div>
      )}

      {e.conf > 0 && (
        <div className="confirmers">
          <div className="avatars" aria-hidden="true">
            {avatars.map((a, i) => (
              <span key={i} className={`avatar avatar--sm avatar--tone${i}`}>
                {a}
              </span>
            ))}
            {e.conf > 3 && <span className="avatar avatar--sm avatar--more">+{e.conf - 3}</span>}
          </div>
          <strong>
            {e.conf === 1 ? t('1 vecin a confirmat') : t('{n} au confirmat', { n: plural(e.conf, 'vecin', 'vecini') })}
            {myVote === 'yes' ? ', inclusiv tu' : ''}
          </strong>
        </div>
      )}

      {closed && (
        <div className="closed-note">
          <Icon name="history" />
          <span className="stack">
            <strong>{e.status === 'rezolvat' && e.resolvedAt ? `Rezolvat ${fmtAt(new Date(e.resolvedAt))}` : 'Expirat'}</strong>
            <span className="muted small">{t('Evenimentul nu mai apare pe hartă.')}</span>
          </span>
        </div>
      )}

      {official ? (
        <>
          <dl className="facts">
            <div>
              <dt>{t('Sursa')}</dt>
              <dd>{e.source}</dd>
            </div>
            <div>
              <dt>{t('Ultima actualizare')}</dt>
              <dd>{e.updatedAt ? fmtAt(new Date(e.updatedAt)) : '—'}</dd>
            </div>
            <div>
              <dt>{t('Început oficial')}</dt>
              <dd>{e.startAt ? fmtAt(new Date(e.startAt)) : '—'}</dd>
            </div>
            <div>
              <dt>{t('Sfârșit oficial')}</dt>
              <dd className="strong">{e.endAt ? fmtAt(new Date(e.endAt)) : '—'}</dd>
            </div>
          </dl>
          <section className="stack gap-8">
            <h3 className="h3">{e.parentId ? t('Adresa') : t('Străzi afectate')}</h3>
            <ul className="streets">
              {e.streets.map((s) => (
                <li key={s}>
                  <span className="streets__dot" style={{ background: typeVar(e.subtype) }} />
                  {streetLine(s)}
                </li>
              ))}
            </ul>
          </section>
          {e.allStreets && (
            <section className="stack gap-8">
              <h3 className="h3">{t('Toate adresele din anunț')}</h3>
              <p className="small muted">{e.allStreets.map(streetLine).join(' · ')}</p>
            </section>
          )}
        </>
      ) : (
        <>
          <dl className="facts facts--single">
            <div>
              <dt>{t('Raportat')}</dt>
              <dd>{e.reportedAt ? `${fmtAt(new Date(e.reportedAt))} (${fmtAgo(new Date(e.reportedAt))})` : '—'}</dd>
            </div>
          </dl>
          <div className="stack gap-8">
            <div className="row between small">
              <strong>
                {plural(e.conf, 'vecin confirmă', 'vecini confirmă')} · {t('{n} nu', { n: e.den })}
              </strong>
              <span className="muted">{t('Prag: {n} confirmări', { n: CONFIG.CONFIRM_THRESHOLD })}</span>
            </div>
            <div className="meter">
              <span style={{ width: `${Math.min(100, Math.round((e.conf / Math.max(CONFIG.CONFIRM_THRESHOLD, e.conf + e.den)) * 100))}%` }} />
            </div>
          </div>
          {e.description && <p className="body-text">{e.description}</p>}
          {e.status === 'raportat' && e.reportedAt && (
            <p className="muted small row gap-6">
              <Icon name="clock" size={14} />
              {t('Expiră automat {when} dacă nu o confirmă {n} vecini.', {
                when: fmtAt(new Date(new Date(e.reportedAt).getTime() + CONFIG.REPORT_EXPIRY_H * 36e5)),
                n: CONFIG.CONFIRM_THRESHOLD,
              })}
            </p>
          )}
        </>
      )}

      {!official && !closed && !isMine && (
        <section className="vote">
          <h3 className="h3">{t('Ai și tu această problemă?')}</h3>
          {(myVote || !voteBlocked) && (
            <div className="grid-2">
              <button type="button" className={`btn btn--vote ${myVote === 'yes' ? 'is-chosen' : ''} ${myVote === 'no' ? 'is-dim' : ''}`} disabled={!!myVote} aria-pressed={myVote === 'yes'} onClick={() => vote(e.id, 'yes')}>
                {t('Da, și la mine')}
              </button>
              <button type="button" className={`btn btn--vote btn--vote-no ${myVote === 'no' ? 'is-chosen' : ''} ${myVote === 'yes' ? 'is-dim' : ''}`} disabled={!!myVote} aria-pressed={myVote === 'no'} onClick={() => vote(e.id, 'no')}>
                {t('Nu, la mine funcționează')}
              </button>
            </div>
          )}
          {myVote && (
            <p className="row gap-8 small" role="status">
              <Icon name="check" size={18} strokeWidth={2.2} />
              <span>
                <strong>{myVote === 'yes' ? t('Ai confirmat problema.') : t('Ai răspuns că la tine funcționează.')}</strong> {t('{yes} confirmă · {no} nu', { yes: e.conf, no: e.den })}
              </span>
            </p>
          )}
          {voteBlocked && (
            <p className="row gap-8 small">
              <Icon name="pin" size={18} />
              {voteBlocked}
            </p>
          )}
          <span className="muted xsmall">{t('Un singur răspuns pe dispozitiv. Nu ai nevoie de cont.')}</span>
        </section>
      )}

      {showActions && (
        <div className="grid-2">
          <EventActions e={e} />
        </div>
      )}

      {isMine &&
        (deleteAsk === e.id ? (
          <DeleteConfirm onCancel={() => setDeleteAsk(null)} onConfirm={() => deleteEvent(e.id)} />
        ) : (
          <button type="button" className="btn btn--danger-ghost" onClick={() => setDeleteAsk(e.id)}>
            <Icon name="trash" size={16} />
            {t('Șterge raportarea mea')}
          </button>
        ))}
    </div>
  );
}

/** „Urmărește” și „Distribuie”. `short`: butoane mari, pentru subsolul mobil. */
export function EventActions({ e, short = false }: { e: DerivedEvent; short?: boolean }) {
  const { following, toggleFollow, flash } = useApp();
  const share = async () => {
    const url = `${window.location.origin}/?e=${encodeURIComponent(e.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: eventTitle(e), url });
      else {
        await navigator.clipboard.writeText(url);
        flash(t('Linkul evenimentului a fost copiat'));
      }
    } catch {
      /* partajare anulată */
    }
  };

  const on = !!following[e.id];
  return (
    <>
      <button type="button" className={`btn btn--secondary ${short ? 'btn--lg' : ''}`} aria-pressed={on} onClick={() => toggleFollow(e.id)}>
        <Icon name="bookmark" fill={on ? 'currentColor' : 'none'} />
        {on ? t('Urmărești') : t('Urmărește')}
      </button>
      <button type="button" className={`btn btn--secondary ${short ? 'btn--lg' : ''}`} onClick={() => void share()}>
        <Icon name="share" />
        {t('Distribuie')}
      </button>
    </>
  );
}

export function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="danger-box fade-in" role="alertdialog" aria-label={t('Confirmă ștergerea')}>
      <strong>{t('Ștergi raportarea?')}</strong>
      <span className="muted small">{t('Dispare de pe hartă pentru toți, iar confirmările vecinilor se pierd. Acțiunea nu poate fi anulată.')}</span>
      <div className="grid-2">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          {t('Anulează')}
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm}>
          {t('Șterge')}
        </button>
      </div>
    </div>
  );
}
