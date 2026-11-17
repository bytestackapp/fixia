import { useEffect, useState } from 'react';
import { useAdm, useDo, Load, Head } from './kit.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Switch } from '../../components/ui/Kit.jsx';

function Setting({ k, label, hint, v, type = 'number', ...rest }) {
  const [val, setVal] = useState(v); useEffect(() => setVal(v), [v]);
  const save = useDo('settings.set', 'Setting saved');
  return <div className="cluster" style={{ alignItems: 'end' }}><div style={{ flex: '1 1 260px', maxWidth: 420 }}><Field label={label} hint={hint} type={type} value={val} onChange={(e) => setVal(e.target.value)} {...rest} /></div><Button variant="secondary" loading={save.isPending} disabled={val === v} onClick={() => save.mutate({ key: k, value: val })}>Save</Button></div>;
}
export default function Settings() {
  const q = useAdm('settings.get'); const otp = useDo('settings.set', 'Setting saved');
  return (
    <>
      <Head title="Settings" sub="Each setting is saved on its own and applies right away." />
      <Load q={q}>{(s) => (
        <div className="stack stack--lg">
          <section className="stack"><h2>Email verification at sign-up</h2>
            <div className="cluster"><Switch checked={s.otp_enabled === 'true'} label="Require email verification" onChange={(v) => otp.mutate({ key: 'otp_enabled', value: v ? 'true' : 'false' })} /><span>Require a code sent by email</span></div>
            <Setting k="otp_test_code" label="Fixed test code" type="text" maxLength={6} hint="6 digits. While set, every sign-up uses this code and no email is sent. Leave empty for real codes." v={s.otp_test_code} /></section>
          <section className="stack"><h2>Ads</h2>
            <Setting k="inline_ad_interval" label="Rows between inline ads" v={s.inline_ad_interval} min="1" max="20" />
            <Setting k="ad_actions_per_popup" label="Actions before a pop-up" hint="Searches, profile views, bookings." v={s.ad_actions_per_popup} min="1" max="20" />
            <Setting k="ad_min_minutes" label="Minutes between pop-ups" v={s.ad_min_minutes} min="0.5" step="0.5" />
            <Setting k="ad_skip_seconds" label="Seconds before a pop-up can be skipped" v={s.ad_skip_seconds} min="3" max="30" /></section>
          <section className="stack"><h2>Providers</h2>
            <Setting k="suspension_days" label="Suspension length (days)" v={s.suspension_days} min="1" max="365" />
            <Setting k="featured_impression_quota" label="Featured appearances per cycle" hint="Applies to every featured provider immediately. Elite providers are not limited." v={s.featured_impression_quota} min="100" /></section>
        </div>
      )}</Load>
    </>
  );
}
