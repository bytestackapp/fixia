import { useState } from 'react';
import { useAct } from '../../lib/queries.js';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';

export default function Security() {
  const [f, setF] = useState({ current: '', next: '', again: '' }), [msg, setMsg] = useState(null);
  const change = useAct('password.change', { onSuccess: () => { setF({ current: '', next: '', again: '' }); setMsg({ ok: true, t: 'Password updated.' }); } });
  function submit(e) {
    e.preventDefault(); setMsg(null);
    if (f.next.length < 8) return setMsg({ t: 'New password needs at least 8 characters.' });
    if (f.next !== f.again) return setMsg({ t: 'The new passwords do not match.' });
    change.mutate({ current: f.current, next: f.next }, { onError: (er) => setMsg({ t: er.message }) });
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      {msg && <div className={`notice notice--${msg.ok ? 'ok' : 'error'}`} role="alert">{msg.t}</div>}
      <Field label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <Field label="New password" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      <Field label="Repeat new password" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
      <div><Button type="submit" loading={change.isPending}>Update password</Button></div>
    </form>
  );
}
