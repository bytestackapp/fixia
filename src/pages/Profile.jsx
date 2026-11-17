import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useProfile } from '../lib/queries.js';
import { Tabs } from '../components/ui/Kit.jsx';
import { ErrorState } from '../components/States.jsx';
import Overview from './profile/Overview.jsx';
import Edit from './profile/Edit.jsx';
import Security from './profile/Security.jsx';
import Plan from './profile/Plan.jsx';
import Referral from './profile/Referral.jsx';
import Listings from './profile/Listings.jsx';
import Reviews from './profile/Reviews.jsx';

export default function Profile() {
  const { user } = useAuth(); const isPro = user.role === 'provider';
  const [sp, setSp] = useSearchParams();
  const { data, error, refetch } = useProfile();
  const tabs = [['overview', 'Overview'], ...(isPro ? [['services', 'Services'], ['reviews', 'Reviews']] : []), ['edit', 'Edit'], ['security', 'Security'], ['plan', 'Plan'], ['referral', 'Referrals']];
  const tab = tabs.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : 'overview';
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data) return <><header className="page-head"><h1>Profile</h1></header><div className="skeleton" style={{ height: 160 }} /></>;
  const P = { overview: Overview, services: Listings, reviews: Reviews, edit: Edit, security: Security, plan: Plan, referral: Referral }[tab];
  return (
    <>
      <header className="page-head"><h1>Profile</h1></header>
      <Tabs items={tabs} value={tab} onChange={(k) => setSp({ tab: k }, { replace: true })} />
      <P data={data} />
    </>
  );
}
