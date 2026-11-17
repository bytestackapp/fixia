import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Share2, Star, Flag } from 'lucide-react';
import { useProvider, useToggleSave } from '../lib/queries.js';
import { call } from '../lib/api.js';
import { catLabel } from '../lib/categories.js';
import { useAuth } from '../lib/auth.jsx';
import Avatar from '../components/Avatar.jsx';
import Rating from '../components/Rating.jsx';
import Button from '../components/ui/Button.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import Field from '../components/ui/Field.jsx';
import { useAct } from '../lib/queries.js';
import { bumpAd } from '../lib/ads.jsx';

const month = (d) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
const day = (d) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

export default function Provider() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, isLoading, refetch } = useProvider(id);
  const save = useToggleSave(id);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [contactError, setContactError] = useState('');
  const [shared, setShared] = useState('');
  const [dlg, setDlg] = useState(null), [form, setForm] = useState({ listing: '', text: '', reason: '', details: '' }), [note, setNote] = useState(null);
  useEffect(() => { if (data) bumpAd(); }, [data?.provider.id]);   // eslint-disable-line
  const refetchAll = { invalidate: ['bookings', 'counts', 'provider'] };
  const book = useAct('bookings.create', { ...refetchAll, onSuccess: () => { setDlg(null); setNote('Booking sent. The provider has been notified, track it under Bookings.'); bumpAd(); } });
  const report = useAct('report.submit', { ...refetchAll, onSuccess: () => { setDlg(null); setNote('Report received. Our team will review it within 24–48 hours.'); } });

  const back = <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}>← Back</button>;
  if (isLoading) return <>{back}<RowsSkeleton rows={2} /></>;
  if (error) return <>{back}<ErrorState error={error} retry={error.status === 404 ? undefined : refetch} /></>;

  const { provider: p, listings, reviews, saved, isOwn } = data;
  const where = [p.barangay, p.city, p.province].filter(Boolean).join(', ');

  async function reveal() {
    setBusy(true); setContactError('');
    try { setPhone((await call('providers.contact', { id })).phone); }
    catch (e) { setContactError(e.message); }
    setBusy(false);
  }
  async function share() {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: p.name, url }); } catch { /* cancelled */ } return; }
    await navigator.clipboard?.writeText(url); setShared('Link copied'); setTimeout(() => setShared(''), 2500);
  }

  return (
    <>
      {back}
      <header className="profile-head">
        <Avatar name={p.name} url={p.avatarUrl} size={88} />
        <div>
          <h1>{p.name}{p.isElite && <span className="tag">Elite</span>}</h1>
          <div className="meta">
            <Rating value={p.rating} count={p.reviews} />
            {where && <span>{where}</span>}
          </div>
        </div>
      </header>

      {!isOwn && (
        <div className="actions">
          {user.role === 'regular' && <Button onClick={() => { setNote(null); setDlg('book'); }} disabled={!listings.length}>Book this provider</Button>}
          {phone ? (
            <>
              <a className="btn btn--secondary" href={`tel:${phone}`}>Call {phone}</a>
              <a className="btn btn--secondary" href={`sms:${phone}`}>Send SMS</a>
            </>
          ) : (
            <Button variant="secondary" onClick={reveal} loading={busy} disabled={user.role === 'provider'}>{busy ? 'Getting number' : 'Contact'}</Button>
          )}
          <Button variant="secondary" onClick={() => save.mutate(!saved)} aria-pressed={saved}>
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {saved ? 'Saved' : 'Save'}
          </Button>
          {user.role !== 'provider' && (data.reported ? <span className="small muted">Reported</span> : <Button variant="quiet" onClick={() => { setNote(null); setDlg('report'); }}><Flag size={16} aria-hidden="true" /> Report</Button>)}
          <Button variant="quiet" onClick={share}><Share2 size={16} aria-hidden="true" /> {shared || 'Share'}</Button>
        </div>
      )}
      {user.role === 'provider' && !isOwn && <p className="field__hint" style={{ marginTop: 'var(--s3)' }}>Provider accounts cannot contact other providers.</p>}
      {note && <div className="notice notice--ok" role="status" style={{ marginTop: 'var(--s4)' }}>{note}</div>}
      {contactError && <div className="notice notice--error" role="alert" style={{ marginTop: 'var(--s4)' }}>{contactError}</div>}

      <section className="section" aria-labelledby="h-about">
        <div className="section-head"><h2 id="h-about">About</h2></div>
        <p style={{ marginTop: 'var(--s4)' }}>{p.bio || 'This provider has not added a description yet.'}</p>
        <dl className="defs">
          {where && <><dt>Location</dt><dd>{[p.street, where].filter(Boolean).join(', ')}</dd></>}
          <dt>Member since</dt><dd>{month(p.memberSince)}</dd>
        </dl>
      </section>

      <section className="section" aria-labelledby="h-svc">
        <div className="section-head"><h2 id="h-svc">Services</h2></div>
        {listings.length ? listings.map((l) => (
          <div className="listing" key={l.id}>
            <div className="listing__top"><h3>{l.title}</h3>{l.priceLabel && <span className="listing__price num">{l.priceLabel}</span>}</div>
            <span className="prow__where">{catLabel(l.category)} · {l.sub}</span>
            {l.description && <p>{l.description}</p>}
          </div>
        )) : <Empty title="No services listed" />}
      </section>

      <section className="section" aria-labelledby="h-rev">
        <div className="section-head"><h2 id="h-rev">Reviews</h2></div>
        {reviews.length ? (
          <>
            <div className="score"><b className="num">{p.rating.toFixed(1)}</b><span>from {p.reviews} review{p.reviews === 1 ? '' : 's'}</span></div>
            {reviews.map((r, i) => (
              <article className="review" key={i}>
                <div className="review__top">
                  <span className="stars" role="img" aria-label={`${r.stars} out of 5`}>{Array.from({ length: 5 }, (_, k) => <Star key={k} size={14} fill={k < r.stars ? 'currentColor' : 'none'} strokeWidth={k < r.stars ? 0 : 1.5} />)}</span>
                  <span><b>{r.name}</b> · {day(r.createdAt)}</span>
                </div>
                {r.comment && <p>{r.comment}</p>}
              </article>
            ))}
          </>
        ) : <Empty title="No reviews yet">Only customers who completed a booking can leave a review.</Empty>}
      </section>
    
      <Dialog open={dlg === 'book'} onClose={() => setDlg(null)} title={`Book ${p.name}`}>
        <p className="muted small">Agree on the details with the provider first (Contact), then describe the job here so both of you have a record.</p>
        {book.error && <div className="notice notice--error" role="alert">{book.error.message}</div>}
        <Field as="select" label="Service" value={form.listing} onChange={(e) => setForm({ ...form, listing: e.target.value })}><option value="">Select…</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}{l.priceLabel ? ` · ${l.priceLabel}` : ''}</option>)}</Field>
        <Field as="textarea" label="Job description" maxLength={500} placeholder="e.g. Aircon cleaning, 1 unit 1.5HP, agreed ₱500, Quezon City" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <div className="dlg__actions"><Button loading={book.isPending} onClick={() => book.mutate({ providerId: id, listingId: form.listing, message: form.text })}>Send booking</Button><Button variant="quiet" onClick={() => setDlg(null)}>Cancel</Button></div>
      </Dialog>
      <Dialog open={dlg === 'report'} onClose={() => setDlg(null)} title="Report this provider">
        <p className="muted small">Reports are reviewed by our team and your name is not shown to the provider.</p>
        {report.error && <div className="notice notice--error" role="alert">{report.error.message}</div>}
        <Field as="select" label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="">Select…</option>{['Fake or misleading profile', 'Rude or unprofessional behavior', 'Did not show up', 'Overcharging or scam', 'Inappropriate content', 'Other'].map((r) => <option key={r}>{r}</option>)}</Field>
        <Field as="textarea" label="Details (optional)" maxLength={600} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        <div className="dlg__actions"><Button variant="danger" loading={report.isPending} onClick={() => report.mutate({ providerId: id, reason: form.reason, details: form.details })}>Submit report</Button><Button variant="quiet" onClick={() => setDlg(null)}>Cancel</Button></div>
      </Dialog>
    </>
  );
}