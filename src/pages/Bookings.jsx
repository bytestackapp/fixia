import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useBookings, useCounts, useAct } from '../lib/queries.js';
import { ago } from '../lib/format.js';
import { bumpAd } from '../lib/ads.jsx';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/ui/Button.jsx';
import Dialog, { Confirm } from '../components/ui/Dialog.jsx';
import { Tabs, Status, StarPicker } from '../components/ui/Kit.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';

const LABEL = { pending: ['Pending', 'warn'], active: ['Active', 'ok'], done: ['Marked done', 'signal'], completed: ['Completed', 'ok'], cancelled: ['Cancelled', 'neutral'], disputed: ['Disputed', 'danger'] };
const TABS = [['all', 'All'], ['pending', 'Pending'], ['active', 'Active'], ['done', 'Done'], ['completed', 'Completed']];

export default function Bookings() {
  const { user } = useAuth(); const isPro = user.role === 'provider';
  const { data, error, isLoading, refetch } = useBookings();
  const counts = useCounts().data?.unread || 0;
  const [tab, setTab] = useState('all'), [ask, setAsk] = useState(null), [rate, setRate] = useState(null);
  const base = { invalidate: ['bookings', 'counts', 'notifications'], onSuccess: () => { setAsk(null); setRate(null); } };
  const cancel = useAct(isPro ? 'bookings.providerCancel' : 'bookings.cancel', { ...base, ok: 'Booking cancelled.' });
  const done = useAct('bookings.done', { ...base, ok: 'Job marked as done. The customer was asked to confirm.' });
  const dispute = useAct('bookings.dispute', { ...base, ok: 'Job disputed.' });
  const complete = useAct('bookings.complete', { ...base, ok: 'Thank you! Booking completed.', onSuccess: () => { base.onSuccess(); bumpAd(); } });

  const list = (data?.items || []).filter((b) => tab === 'all' || b.status === tab);
  return (
    <>
      <header className="page-head"><h1>{isPro ? 'Jobs' : 'Bookings'}</h1>
        <p>{isPro ? 'Requests from customers and work in progress.' : 'Track your service requests.'} <Link to="/notifications">Updates{counts ? ` (${counts} new)` : ''}</Link></p></header>
      <Tabs items={TABS} value={tab} onChange={setTab} label="Filter by status" />
      {isLoading ? <RowsSkeleton rows={3} /> : error ? <ErrorState error={error} retry={refetch} /> : !list.length ? (
        <Empty title={tab === 'all' ? 'No bookings yet' : 'Nothing here'} action={!isPro && tab === 'all' && <Link className="btn btn--secondary btn--sm" to="/browse">Find a provider</Link>}>
          {isPro ? 'New requests from customers appear here.' : 'Open a provider and tap Book to start.'}
        </Empty>
      ) : (
        <ul className="rows rows--even">
          {list.map((b) => {
            const [text, kind] = LABEL[b.status] || [b.status, 'neutral'];
            const open = ['pending', 'active'].includes(b.status);
            return (
              <li key={b.id} className="row booking">
                <div className="booking__top">
                  <Avatar name={b.with.name} url={b.with.avatarUrl} size={40} />
                  <div className="prow__main">
                    {b.with.id ? <Link to={`/p/${b.with.id}`} className="prow__name" style={{ textDecoration: 'none' }}>{b.with.name}</Link> : <span className="prow__name">{b.with.name}</span>}
                    {b.service && <span className="prow__services">{b.service}</span>}
                    {b.with.location && <span className="prow__where">{b.with.location}</span>}
                  </div>
                  <div className="booking__state">
                    <Status kind={kind}>{text}</Status>
                    {b.rating && <span className="stars-chip" aria-label={`Rated ${b.rating.stars} out of 5`}>{b.rating.stars}<Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" /></span>}
                    {b.unread && <span className="tag" style={{ marginLeft: 0 }}>New</span>}
                    <span className="prow__where">{ago(b.updatedAt)}</span>
                  </div>
                </div>
                <p className="booking__note">{b.message || 'No job details.'}</p>
                <div className="cluster">
                  {b.with.phone && <><a className="btn btn--secondary btn--sm" href={`tel:${b.with.phone}`}>Call</a><a className="btn btn--secondary btn--sm" href={`sms:${b.with.phone}`}>SMS</a></>}
                  {isPro && open && <Button size="sm" onClick={() => setAsk({ kind: 'done', b })}>Mark job done</Button>}
                  {!isPro && b.status === 'done' && <Button size="sm" onClick={() => setRate(b)}>Confirm and rate</Button>}
                  {!isPro && b.status === 'completed' && !b.rating && <Button size="sm" variant="secondary" onClick={() => setRate(b)}>Leave a rating</Button>}
                  {!isPro && b.status === 'done' && <Button size="sm" variant="quiet" onClick={() => setAsk({ kind: 'dispute', b })}>Dispute</Button>}
                  {open && <Button size="sm" variant="quiet" onClick={() => setAsk({ kind: 'cancel', b })}>Cancel</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Confirm open={ask?.kind === 'cancel'} title="Cancel this booking?" confirmLabel="Yes, cancel" danger busy={cancel.isPending} onClose={() => setAsk(null)} onConfirm={() => cancel.mutate({ id: ask.b.id })}>The other person will be notified.</Confirm>
      <Confirm open={ask?.kind === 'done'} title="Mark this job as done?" confirmLabel="Mark done" busy={done.isPending} onClose={() => setAsk(null)} onConfirm={() => done.mutate({ id: ask.b.id })}>The customer is asked to confirm and rate. Only do this when the work is finished.</Confirm>
      <Confirm open={ask?.kind === 'dispute'} title="Dispute this job?" confirmLabel="Dispute" danger busy={dispute.isPending} onClose={() => setAsk(null)} onConfirm={() => dispute.mutate({ id: ask.b.id })}>This closes the booking as disputed. Talk to the provider to sort it out, then book again if needed.</Confirm>
      <RateDialog b={rate} user={user} busy={complete.isPending} onClose={() => setRate(null)} onSubmit={(p) => complete.mutate({ id: rate.id, ...p })} />
    </>
  );
}

function RateDialog({ b, user, busy, onClose, onSubmit }) {
  const [stars, setStars] = useState(0), [comment, setComment] = useState(''), [anon, setAnon] = useState(false);
  const mask = (s) => `${s.slice(0, 3)}***`;
  return (
    <Dialog open={!!b} onClose={onClose} title={`Rate ${b?.with.name || ''}`}>
      <p className="muted small">{b?.status === 'done' ? 'Confirming means the work was completed to your satisfaction.' : 'Share how it went.'}</p>
      <StarPicker value={stars} onChange={setStars} />
      <label className="field"><span className="field__label">Comment (optional)</span><textarea className="input input--area" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><span>Hide my name <small className="muted">— shown as {anon ? `${mask(user.firstName)} ${mask(user.lastName)}` : `${user.firstName} ${user.lastName}`}</small></span></label>
      <div className="dlg__actions"><Button loading={busy} onClick={() => onSubmit({ stars, comment, anonymous: anon })}>{b?.status === 'done' ? 'Confirm job' : 'Submit rating'}</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></div>
    </Dialog>
  );
}
