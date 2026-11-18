import { useState } from 'react';
import { useAct } from '../../lib/queries.js';
import { toast } from '../../lib/toast.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';

export default function Security() {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const change = useAct('password.change', { ok: 'Password updated.', onSuccess: () => setF({ current: '', next: '', again: '' }) });
  function submit(e) {
    e.preventDefault();
    if (f.next.length < 8) return toast('New password needs at least 8 characters.', 'error');
    if (f.next !== f.again) return toast('The new passwords do not match.', 'error');
    change.mutate({ current: f.current, next: f.next });
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      <Field label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <Field label="New password" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      <Field label="Repeat new password" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
      <div><Button type="submit" loading={change.isPending}>Update password</Button></div>
    </form>
  );
}
