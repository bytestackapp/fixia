import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { call } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useAct } from '../lib/queries.js';
import { ago } from '../lib/format.js';
import Button from '../components/ui/Button.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';

const CUSTOMER = {
  active: ['Booking confirmed', 'Your booking is active. The provider will be in touch.'],
  done: ['Job marked as done', 'The provider finished the job. Open it to confirm and rate.'],
  cancelled: ['Cancelled by provider', 'The provider cancelled this booking.'],
  disputed: ['You disputed this job', 'Talk to the provider to resolve it, then rebook if needed.'],
  completed: ['Booking completed', 'Thank you for using Fixia.'],
};
const PROVIDER = {
  pending: ['New booking request', 'A customer sent you a request.'],
  active: ['Booking active', 'A booking is now in progress.'],
  cancelled: ['Booking cancelled', 'This booking was cancelled.'],
  disputed: ['A customer disputed a job', 'Please reach out to resolve it.'],
  completed: ['Job completed', 'A customer confirmed completion.'],
};

export default function Notifications() {
  const nav = useNavigate(); const { user } = useAuth();
  const map = user.role === 'provider' ? PROVIDER : CUSTOMER;
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['notifications'], queryFn: () => call('notifications.list') });
  const inv = { invalidate: ['notifications', 'counts', 'bookings'] };
  const read = useAct('notifications.read', inv), clear = useAct('notifications.clear', inv);
  const items = (data?.items || []).filter((n) => map[n.status]);
  return (
    <>
      <header className="page-head"><h1>Updates</h1><p>Changes to your bookings.</p></header>
      <div className="cluster" style={{ marginBottom: 'var(--s4)' }}>
        <Button size="sm" variant="secondary" disabled={!items.some((n) => n.unread)} onClick={() => read.mutate({})}>Mark all read</Button>
        <Button size="sm" variant="quiet" disabled={!items.some((n) => !n.unread)} onClick={() => clear.mutate({})}>Clear read</Button>
      </div>
      {isLoading ? <RowsSkeleton rows={3} /> : error ? <ErrorState error={error} retry={refetch} /> : !items.length ? <Empty title="No updates yet">Booking changes will show up here.</Empty> : (
        <ul className="rows">
          {items.map((n) => (
            <li key={n.id}>
              <button className="row" style={{ background: n.unread ? 'var(--signal-tint)' : undefined, padding: 'var(--s4) var(--s3)' }} onClick={() => { read.mutate({ id: n.id }); nav('/bookings'); }}>
                <span className="prow__name">{map[n.status][0]}{n.unread && <span className="tag">New</span>}</span>
                <span className="small muted">{map[n.status][1]}</span>
                <span className="prow__where">{ago(n.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
