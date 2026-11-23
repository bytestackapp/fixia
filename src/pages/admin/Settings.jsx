import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAdm, useDo, Load, Head, IconBtn } from './kit.jsx';
import Field from '../../components/ui/Field.jsx';
import { Switch } from '../../components/ui/Kit.jsx';

function Setting({ k, label, hint, v, type = 'number', ...rest }) {
  const [val, setVal] = useState(v); useEffect(() => setVal(v), [v]);
  const save = useDo('settings.set', 'Setting saved');
  return (
    <div>
      <div className="cluster" style={{ alignItems: 'end', flexWrap: 'nowrap' }}>
        <div style={{ flex: '1 1 0', maxWidth: 420, minWidth: 0 }}><Field label={label} type={type} value={val} onChange={(e) => setVal(e.target.value)} {...rest} /></div>
        <IconBtn icon={Save} label="Save" size="md" style={{ width: 46, height: 46 }} loading={save.isPending} disabled={val === v} onClick={() => save.mutate({ key: k, value: val })} />
      </div>
      {hint && <p className="field__hint" style={{ marginTop: 6 }}>{hint}</p>}
    </div>
  );
}
export default function Settings() {
  const q = useAdm('settings.get'); const otp = useDo('settings.set', 'Setting saved');
  return (
    <>
      <Head title="Settings" sub="Each setting is saved on its own and applies right away." />
      <Load q={q}>{(s) => (
        <div className="stack stack--lg">
          <section className="stack"><div className="section-head"><h2>Email verification at sign-up</h2></div>
            <div className="cluster"><Switch checked={s.otp_enabled === 'true'} label="Require email verification" onChange={(v) => otp.mutate({ key: 'otp_enabled', value: v ? 'true' : 'false' })} /><span>Require a code sent by email</span></div>
            <Setting k="otp_test_code" label="Fixed test code" type="text" maxLength={6} hint="6 digits. While set, every sign-up uses this code and no email is sent. Leave empty for real codes." v={s.otp_test_code} /></section>
          <section className="stack"><div className="section-head"><h2>Ads</h2></div>
            <Setting k="inline_ad_interval" label="Rows between inline ads" v={s.inline_ad_interval} min="1" max="20" />
            <Setting k="ad_actions_per_popup" label="Actions before a pop-up" hint="Searches, profile views, bookings." v={s.ad_actions_per_popup} min="1" max="20" />
            <Setting k="ad_min_minutes" label="Minutes between pop-ups" v={s.ad_min_minutes} min="0.5" step="0.5" />
            <Setting k="ad_skip_seconds" label="Seconds before a pop-up can be skipped" v={s.ad_skip_seconds} min="3" max="30" /></section>
          <section className="stack"><div className="section-head"><h2>Providers</h2></div>
            <Setting k="suspension_days" label="Suspension length (days)" v={s.suspension_days} min="1" max="365" />
            <Setting k="fraud_point_limit" label="Fraud warnings before suspension" hint="Each removed fraudulent rating gives the guilty account 1 point. At this number the Suspend button activates. Leave empty for 3." v={s.fraud_point_limit} min="1" max="20" />
            <Setting k="featured_impression_quota" label="Featured appearances per cycle" hint="Applies to every featured provider immediately. Elite providers are not limited." v={s.featured_impression_quota} min="100" /></section>
        </div>
      )}</Load>
    </>
  );
}