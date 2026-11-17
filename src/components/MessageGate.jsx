import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';

/* Messages from the Fixia team (warnings, announcements) appear once and must be read. */
export default function MessageGate() {
  const { logout } = useAuth(); const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ['messages'], queryFn: () => call('messages.pending'), refetchInterval: 120_000, refetchOnWindowFocus: true });
  const m = data?.items?.[0];
  async function ack() {
    setBusy(true);
    try { const r = await call('messages.ack', { id: m.id }); if (r.signOut) return logout(); await qc.invalidateQueries({ queryKey: ['messages'] }); } catch { /* try again */ }
    setBusy(false);
  }
  return (
    <Dialog open={!!m} onClose={() => {}} title={m?.title || ''} label="Message from Fixia">
      {m && <>
        <p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
        <div className="dlg__actions"><Button loading={busy} onClick={ack}>Got it</Button>{data.items.length > 1 && <span className="small muted">{data.items.length - 1} more after this</span>}</div>
      </>}
    </Dialog>
  );
}
