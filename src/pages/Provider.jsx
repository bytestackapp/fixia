import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Share2, Star, Flag, Phone, MessageSquare, MapPin, CalendarDays, Info, Wrench, BadgeCheck, Crown } from 'lucide-react';
import { useProvider, useToggleSave, useAct } from '../lib/queries.js';
import { call } from '../lib/api.js';
import { toast } from '../lib/toast.jsx';
import { catLabel } from '../lib/categories.js';
import { useAuth } from '../lib/auth.jsx';
import Button from '../components/ui/Button.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import Field from '../components/ui/Field.jsx';
import { bumpAd } from '../lib/ads.jsx';

const month = (d) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
const day = (d) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

export default function Provider() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, isLoading, refetch } = useProvider(id);
  const save = useToggleSave(id);
  const [phone, setPhone] = useState(''), [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null), [form, setForm] = useState({ listing: '', text: '', reason: '', details: '' });
  useEffect(() => { if (data) bumpAd(); }, [data?.provider.id]);   // eslint-disable-line
  const refetchAll = { invalidate: ['bookings', 'counts', 'provider'] };
  const book = useAct('bookings.create', { ...refetchAll, ok: 'Booking sent. The provider has been notified. Track it under Bookings.', onSuccess: () => { setDlg(null); bumpAd(); } });
  const report = useAct('report.submit', { ...refetchAll, ok: 'Report received. Our team will review it within 24–48 hours.', onSuccess: () => setDlg(null) });

  const goBack = () => (window.history.length > 1 ? nav(-1) : nav('/'));
  const back = <div style={{ marginBottom: 'var(--s3)' }}><Button variant="secondary" size="sm" onClick={goBack}>← Back</Button></div>;
  if (isLoading) return <>{back}<RowsSkeleton rows={2} /></>;
  if (error) return <>{back}<ErrorState error={error} retry={error.status === 404 ? undefined : refetch} /></>;

  const { provider: p, listings, reviews, saved, isOwn } = data;
  const where = [p.barangay, p.city, p.province].filter(Boolean).join(', ');

  async function reveal() {
    if (user.role === 'provider') return toast('Provider accounts cannot contact other providers.', 'info');
    setBusy(true);
    try { setPhone((await call('providers.contact', { id })).phone); }
    catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }
  async function share() {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: p.name, url }); } catch { /* cancelled */ } return; }
    try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch { toast('Could not copy the link.', 'error'); }
  }

  return (
    <>
      <header className="hero">
        {!isOwn && (
          <div className="hero__actions">
            <button type="button" className="herobtn" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save provider'} title={saved ? 'Saved' : 'Save'} onClick={() => save.mutate(!saved)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /></button>
            <button type="button" className="herobtn" aria-label="Share" title="Share" onClick={share}><Share2 size={16} aria-hidden="true" /></button>
            {user.role !== 'provider' && <button type="button" className="herobtn" aria-label={data.reported ? 'Already reported' : 'Report this provider'} title={data.reported ? 'Reported' : 'Report'} disabled={data.reported} onClick={() => setDlg('report')}><Flag size={16} aria-hidden="true" /></button>}
          </div>
        )}
        <div className="hero__inner">
          <div className="hero__avatar">{p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <span aria-hidden="true">{p.name.trim().charAt(0).toUpperCase() || '?'}</span>}</div>
          <div className="hero__info">
            <h1 className="hero__name">{p.name}</h1>
            {p.services.length > 0 && <p className="hero__service">{p.services.slice(0, 3).join(' · ')}</p>}
            <div className="hero__badges">
              <span className="hbadge hbadge--green"><BadgeCheck size={10} aria-hidden="true" /> Verified</span>
              {p.isElite && <span className="hbadge hbadge--gold"><Crown size={10} aria-hidden="true" /> Elite</span>}
            </div>
          </div>
        </div>
        <div className="stats-bar">
          <div><b className="num">{p.reviews ? p.rating.toFixed(1) : 'New'}</b><span>Rating</span></div>
          <div><b className="num">{p.reviews}</b><span>Reviews</span></div>
          <div><b className="num">{new Date(p.memberSince).getFullYear()}</b><span>Member since</span></div>
        </div>
      </header>

      {!isOwn && (
        <div className="contact-bar">
          {user.role === 'regular' && <Button onClick={() => setDlg('book')} disabled={!listings.length}>Book this provider</Button>}
          {phone ? (
            <>
              <a className="btn btn--secondary" href={`tel:${phone}`}><Phone size={16} aria-hidden="true" /> Call</a>
              <a className="btn btn--secondary" href={`sms:${phone}`}><MessageSquare size={16} aria-hidden="true" /> SMS</a>
            </>
          ) : (
            <Button variant="secondary" onClick={reveal} loading={busy}><Phone size={16} aria-hidden="true" /> {busy ? 'Getting number' : 'Contact'}</Button>
          )}
        </div>
      )}

      <section className="sec" aria-labelledby="h-about">
        <h2 className="sec__title" id="h-about"><Info size={15} aria-hidden="true" /> About</h2>
        <p className="about-text">{p.bio || 'This provider has not added a description yet.'}</p>
        <div className="details">
          {where && <div className="detail-row"><span className="detail-icon"><MapPin size={14} aria-hidden="true" /></span><div><div className="detail-label">Location</div><div className="detail-val">{[p.street, where].filter(Boolean).join(', ')}</div></div></div>}
          <div className="detail-row"><span className="detail-icon"><CalendarDays size={14} aria-hidden="true" /></span><div><div className="detail-label">Member since</div><div className="detail-val">{month(p.memberSince)}</div></div></div>
          {phone && <div className="detail-row"><span className="detail-icon"><Phone size={14} aria-hidden="true" /></span><div><div className="detail-label">Phone</div><div className="detail-val">{phone}</div></div></div>}
        </div>
      </section>

      <section className="sec" aria-labelledby="h-svc">
        <h2 className="sec__title" id="h-svc"><Wrench size={15} aria-hidden="true" /> Services</h2>
        {listings.length ? listings.map((l) => (
          <div className="listing-item" key={l.id}>
            <div className="li-head"><h3 className="li-title">{l.title}</h3>{l.priceLabel && <span className="li-price num">{l.priceLabel}</span>}</div>
            <div className="li-sub">{catLabel(l.category)} · {l.sub}</div>
            {l.description && <p className="li-desc">{l.description}</p>}
          </div>
        )) : <Empty title="No services listed" />}
      </section>

      <section className="sec" aria-labelledby="h-rev">
        <h2 className="sec__title" id="h-rev"><Star size={15} aria-hidden="true" /> Reviews</h2>
        {reviews.length ? (
          <>
            <div className="rating-summary"><b className="rating-big num">{p.rating.toFixed(1)}</b><Star size={24} fill="currentColor" strokeWidth={0} className="rating-star" aria-hidden="true" /><span className="muted small">from {p.reviews} review{p.reviews === 1 ? '' : 's'}</span></div>
            {reviews.map((r, i) => (
              <article className="review-item" key={i}>
                <div className="ri-head">
                  <span className="stars" role="img" aria-label={`${r.stars} out of 5`}>{Array.from({ length: 5 }, (_, k) => <Star key={k} size={13} fill={k < r.stars ? 'currentColor' : 'none'} strokeWidth={k < r.stars ? 0 : 1.5} />)}</span>
                  <span className="ri-date"><b>{r.name}</b> · {day(r.createdAt)}</span>
                </div>
                {r.comment && <p className="ri-comment">{r.comment}</p>}
              </article>
            ))}
          </>
        ) : <Empty title="No reviews yet">Only customers who completed a booking can leave a review.</Empty>}
      </section>

      <div style={{ marginTop: 'var(--s4)' }}><Button variant="secondary" onClick={goBack}>← Back</Button></div>

      <Dialog open={dlg === 'book'} onClose={() => setDlg(null)} title={`Book ${p.name}`}>
        <p className="muted small">Agree on the details with the provider first (Contact), then describe the job here so both of you have a record.</p>
        <Field as="select" label="Service" value={form.listing} onChange={(e) => setForm({ ...form, listing: e.target.value })}><option value="">Select…</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Field>
        <Field as="textarea" label="Job description" maxLength={500} placeholder="e.g. Aircon cleaning, 1 unit 1.5HP, agreed ₱500, Quezon City" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <div className="dlg__actions"><Button loading={book.isPending} onClick={() => book.mutate({ providerId: id, listingId: form.listing, message: form.text })}>Send booking</Button><Button variant="quiet" onClick={() => setDlg(null)}>Cancel</Button></div>
      </Dialog>
      <Dialog open={dlg === 'report'} onClose={() => setDlg(null)} title="Report this provider">
        <p className="muted small">Reports are reviewed by our team and your name is not shown to the provider.</p>
        <Field as="select" label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="">Select…</option>{['Fake or misleading profile', 'Rude or unprofessional behavior', 'Did not show up', 'Overcharging or scam', 'Inappropriate content', 'Other'].map((r) => <option key={r}>{r}</option>)}</Field>
        <Field as="textarea" label="Details (optional)" maxLength={600} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        <div className="dlg__actions"><Button variant="danger" loading={report.isPending} onClick={() => report.mutate({ providerId: id, reason: form.reason, details: form.details })}>Submit report</Button><Button variant="quiet" onClick={() => setDlg(null)}>Cancel</Button></div>
      </Dialog>
    </>
  );
}
