import { useState } from 'react';
import { useAdm, useDo, Load, Head, Table, Btn, Detail } from './kit.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { Tabs, Status } from '../../components/ui/Kit.jsx';
import { fdate } from '../../lib/format.js';

export default function Reports() {
  const [tab, setTab] = useState('pending'); const q = useAdm('reports.list', { status: tab }); const [v, setV] = useState(null);
  const done = { onSuccess: () => setV(null) };
  const dismiss = useDo('report.dismiss', 'Report dismissed'), warn = useDo('report.warn', 'Warning sent'), susp = useDo('report.suspend', 'Suspension queued');
  return (
    <>
      <Head title="Reports" sub="Customers' reports about providers. Reporters stay anonymous to providers." />
      <Tabs items={[['pending', 'Pending'], ['warned', 'Warned'], ['suspended', 'Suspended'], ['dismissed', 'Dismissed']]} value={tab} onChange={setTab} />
      <Load q={q}>{(d) => <Table empty="No reports here." rows={d.items} cols={[['Provider', (r) => <b>{r.provider_name}</b>], ['Reason', (r) => r.reason], ['Date', (r) => fdate(r.created_at)], ['', (r) => <Btn variant="secondary" onClick={() => setV(r)}>Review</Btn>]]} />}</Load>
      <Dialog open={!!v} onClose={() => setV(null)} title="Review report">
        {v && <><Detail rows={[['Provider', v.provider_name], ['Reported by', v.user_name], ['Reason', v.reason], ['Details', v.details], ['Status', <Status key="s" kind="neutral">{v.status}</Status>]]} />
          <div className="dlg__actions">{v.status === 'pending' ? <><Btn variant="secondary" loading={dismiss.isPending} onClick={() => dismiss.mutate({ id: v.id }, done)}>Dismiss</Btn><Btn loading={warn.isPending} onClick={() => warn.mutate({ id: v.id }, done)}>Warn</Btn><Btn variant="danger" loading={susp.isPending} onClick={() => susp.mutate({ id: v.id }, done)}>Suspend</Btn></> : null}<Btn variant="quiet" onClick={() => setV(null)}>Close</Btn></div>
          {v.status === 'pending' && <p className="small muted">Suspend takes effect when the provider closes the notice message.</p>}</>}
      </Dialog>
    </>
  );
}
