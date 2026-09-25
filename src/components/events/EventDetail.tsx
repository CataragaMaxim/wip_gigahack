import { CONFIG } from '@/config/constants';
import { catTint, catVar } from '@/config/categories';
import { fmtAgo, fmtAt, fmtDistance, plural } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { categoryLine, countdown, isClosed } from '@/lib/status';
import { useApp } from '@/state/AppContext';
import type { DerivedEvent } from '@/types';
import { EventTile, SeverityBadge, SourceBadge, StatusBadge } from './EventBits';

const AVATAR_POOL = ['AM', 'IC', 'DR', 'VP', 'EL', 'NS', 'OT', 'MG', 'CB', 'LS'];

export function EventDetail({ e }: { e: DerivedEvent }) {
  const { votes, vote, online, userPos, following, toggleFollow, flash, user, deleteAsk, setDeleteAsk, deleteEvent } = useApp();
  const official = e.sourceType === 'official';
  const closed = isClosed(e.status);
  const cd = countdown(e);
  const myVote = votes[e.id];
  const near = e.distanceM != null && e.distanceM <= CONFIG.VOTE_RADIUS_M;
  const isMine = !!user && e.authorId === user.id;

  let voteBlocked = '';
  if (!myVote) {
    if (!online) voteBlocked = 'Confirmarea necesită conexiune la internet.';
    else if (!userPos) voteBlocked = 'Poți confirma doar dacă ești în apropiere. Activează locația pentru a vota.';
    else if (!near)
      voteBlocked = `Poți confirma doar dacă ești în apropiere (până la ${CONFIG.VOTE_RADIUS_M / 1000} km). Acum ești la ${fmtDistance(e.distanceM!)}.`;
  }

  const share = async () => {
    const url = `${window.location.origin}/?e=${encodeURIComponent(e.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: e.title, url });
      else {
        await navigator.clipboard.writeText(url);
        flash('Linkul evenimentului a fost copiat');
      }
    } catch {
      /* partajare anulată */
    }
  };

  const hash = [...e.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const avatars = Array.from({ length: Math.min(3, e.conf) }, (_, i) =>
    myVote === 'yes' && i === 0 ? 'Tu' : AVATAR_POOL[(hash + i * 3) % AVATAR_POOL.length],
  );

  return (
    <div className="detail fade-in">
      <div className="detail__head">
        <EventTile e={e} size={52} />
        <div className="stack gap-4">
          <span className="detail__cat" style={{ color: catVar(e.category) }}>
            {categoryLine(e)}
          </span>
          <h2 className="detail__title">{e.title}</h2>
          <span className="muted small">
            {e.district}
            {e.distanceM != null ? ` · la ${fmtDistance(e.distanceM)} de tine` : ''}
          </span>
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
            Afectează locația ta: <strong>{e.affects.join(', ')}</strong>
          </span>
        </div>
      )}

      {cd && (
        <div className="countdown" style={{ background: catTint(e.category) }}>
          <span style={{ color: catVar(e.category) }}>
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
            {e.conf === 1 ? '1 vecin a confirmat' : `${plural(e.conf, 'vecin', 'vecini')} au confirmat`}
            {myVote === 'yes' ? ', inclusiv tu' : ''}
          </strong>
        </div>
      )}

      {closed && (
        <div className="closed-note">
          <Icon name="history" />
          <span className="stack">
            <strong>{e.status === 'rezolvat' && e.resolvedAt ? `Rezolvat ${fmtAt(new Date(e.resolvedAt))}` : 'Expirat'}</strong>
            <span className="muted small">Evenimentul nu mai apare pe hartă.</span>
          </span>
        </div>
      )}

      {official ? (
        <>
          <dl className="facts">
            <div>
              <dt>Sursa</dt>
              <dd>{e.source}</dd>
            </div>
            <div>
              <dt>Ultima actualizare</dt>
              <dd>{e.updatedAt ? fmtAt(new Date(e.updatedAt)) : '—'}</dd>
            </div>
            <div>
              <dt>Început oficial</dt>
              <dd>{e.startAt ? fmtAt(new Date(e.startAt)) : '—'}</dd>
            </div>
            <div>
              <dt>Sfârșit oficial</dt>
              <dd className="strong">{e.endAt ? fmtAt(new Date(e.endAt)) : '—'}</dd>
            </div>
          </dl>
          <section className="stack gap-8">
            <h3 className="h3">Străzi afectate</h3>
            <ul className="streets">
              {e.streets.map((s) => (
                <li key={s}>
                  <span className="streets__dot" style={{ background: catVar(e.category) }} />
                  {s}
                </li>
              ))}
            </ul>
          </section>
          <a className="link" href="#anunt-original" onClick={(ev) => ev.preventDefault()}>
            Vezi anunțul original
            <Icon name="external" size={14} />
          </a>
        </>
      ) : (
        <>
          <dl className="facts">
            <div>
              <dt>Raportat</dt>
              <dd>{e.reportedAt ? `${fmtAt(new Date(e.reportedAt))} (${fmtAgo(new Date(e.reportedAt))})` : '—'}</dd>
            </div>
            <div>
              <dt>Distanța față de tine</dt>
              <dd>{e.distanceM != null ? fmtDistance(e.distanceM) : 'Locație indisponibilă'}</dd>
            </div>
          </dl>
          <div className="stack gap-8">
            <div className="row between small">
              <strong>
                {plural(e.conf, 'vecin confirmă', 'vecini confirmă')} · {e.den} nu
              </strong>
              <span className="muted">Prag: {CONFIG.CONFIRM_THRESHOLD} confirmări</span>
            </div>
            <div className="meter">
              <span style={{ width: `${Math.min(100, Math.round((e.conf / Math.max(CONFIG.CONFIRM_THRESHOLD, e.conf + e.den)) * 100))}%` }} />
            </div>
          </div>
          {e.description && <p className="body-text">{e.description}</p>}
          {e.photo && (
            <div className="photo-placeholder">
              <Icon name="camera" size={22} strokeWidth={1.8} />
              Fotografie atașată de autor
            </div>
          )}
          {e.status === 'raportat' && e.reportedAt && (
            <p className="muted small row gap-6">
              <Icon name="clock" size={14} />
              Expiră automat {fmtAt(new Date(new Date(e.reportedAt).getTime() + CONFIG.REPORT_EXPIRY_H * 36e5))} dacă nu o confirmă {CONFIG.CONFIRM_THRESHOLD} vecini.
            </p>
          )}
        </>
      )}

      {!closed && !isMine && (
        <section className="vote">
          <h3 className="h3">Ai și tu această problemă?</h3>
          {(myVote || !voteBlocked) && (
            <div className="grid-2">
              <button type="button" className={`btn btn--vote ${myVote === 'yes' ? 'is-chosen' : ''} ${myVote === 'no' ? 'is-dim' : ''}`} disabled={!!myVote} aria-pressed={myVote === 'yes'} onClick={() => vote(e.id, 'yes')}>
                Da, și la mine
              </button>
              <button type="button" className={`btn btn--vote btn--vote-no ${myVote === 'no' ? 'is-chosen' : ''} ${myVote === 'yes' ? 'is-dim' : ''}`} disabled={!!myVote} aria-pressed={myVote === 'no'} onClick={() => vote(e.id, 'no')}>
                Nu, la mine funcționează
              </button>
            </div>
          )}
          {myVote && (
            <p className="row gap-8 small" role="status">
              <Icon name="check" size={18} strokeWidth={2.2} />
              <span>
                <strong>{myVote === 'yes' ? 'Ai confirmat problema.' : 'Ai răspuns că la tine funcționează.'}</strong> {e.conf} confirmă · {e.den} nu
              </span>
            </p>
          )}
          {voteBlocked && (
            <p className="row gap-8 small">
              <Icon name="pin" size={18} />
              {voteBlocked}
            </p>
          )}
          <span className="muted xsmall">Un singur răspuns pe dispozitiv. Nu ai nevoie de cont.</span>
        </section>
      )}

      <div className="grid-2">
        <button type="button" className="btn btn--secondary" aria-pressed={!!following[e.id]} onClick={() => toggleFollow(e.id)}>
          <Icon name="bookmark" fill={following[e.id] ? 'currentColor' : 'none'} />
          {following[e.id] ? 'Urmărești' : 'Salvează / urmărește'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => void share()}>
          <Icon name="share" />
          Distribuie
        </button>
      </div>

      {isMine &&
        (deleteAsk === e.id ? (
          <DeleteConfirm onCancel={() => setDeleteAsk(null)} onConfirm={() => deleteEvent(e.id)} />
        ) : (
          <button type="button" className="btn btn--danger-ghost" onClick={() => setDeleteAsk(e.id)}>
            <Icon name="trash" size={16} />
            Șterge raportarea mea
          </button>
        ))}
    </div>
  );
}

export function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="danger-box fade-in" role="alertdialog" aria-label="Confirmă ștergerea">
      <strong>Ștergi raportarea?</strong>
      <span className="muted small">Dispare de pe hartă pentru toți, iar confirmările vecinilor se pierd. Acțiunea nu poate fi anulată.</span>
      <div className="grid-2">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Anulează
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm}>
          Șterge
        </button>
      </div>
    </div>
  );
}
