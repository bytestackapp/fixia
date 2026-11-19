import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, IconBtn } from './kit.jsx';
import { Confirm } from '../../components/ui/Dialog.jsx';
import { fdate } from '../../lib/format.js';

export default function Suspicious() {
  const q = useAdm('suspicious.list'); const [v, setV] = useState(null); const rm = useDo('rating.delete', 'Rating removed');
  return (
    <>
      <Head title="Suspicious ratings" sub="Patterns that may mean fake or self-given ratings. Review before removing." />
      <Load q={q}>{(d) => <Table empty="Nothing suspicious found." rows={d.items} cols={[['Pattern', (r) => <b>{r.type}</b>], ['Provider', (r) => r.provider], ['Customer', (r) => r.user], ['Stars', (r) => r.stars], ['Detail', (r) => r.detail || '—'], ['Date', (r) => fdate(r.date)], ['', (r) => <div className="actions-cell"><IconBtn icon={Trash2} label="Remove rating" variant="danger" onClick={() => setV(r)} /></div>]]} />}</Load>
      <Confirm open={!!v} title="Remove this rating?" confirmLabel="Remove" danger busy={rm.isPending} onClose={() => setV(null)} onConfirm={() => rm.mutate({ id: v.id }, { onSuccess: () => setV(null) })}>The provider's average is recalculated. This cannot be undone.</Confirm>
    </>
  );
}