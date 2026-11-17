import { useState } from 'react';
import { useAdm, useDo, Load, Head, Table, Btn } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Status } from '../../components/ui/Kit.jsx';
import { fdate } from '../../lib/format.js';

export default function Customers() {
  const q = useAdm('users.list'), pk = useAdm('packages.list'); const [text, setText] = useState(''), [edit, setEdit] = useState(null), [del, setDel] = useState(null), [kick, setKick] = useState(null);
  const upd = useDo('user.update', 'Customer updated'), rm = useDo('user.delete', 'Customer deleted'), out = useDo('user.kick', 'Signed out on all devices');
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  return (
    <>
      <Head title="Customers" />
      <div style={{ maxWidth: 360, marginBottom: 'var(--s4)' }}><Field label="Search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, email or username" /></div>
      <Load q={q}>{(d) => (
        <Table rows={d.items.filter((u) => !text || [u.first_name, u.last_name, u.email, u.username].join(' ').toLowerCase().includes(text.toLowerCase()))} cols={[
          ['Customer', (u) => <><b>{u.first_name} {u.last_name}</b><br /><span className="muted">@{u.username} · {u.email}</span></>],
          ['Plan', (u) => u.package_name || 'Free'], ['Joined', (u) => fdate(u.created_at)],
          ['Status', (u) => <Status kind={u.status === 'active' ? 'ok' : 'danger'}>{u.status}</Status>],
          ['', (u) => <div className="actions-cell"><Btn variant="secondary" onClick={() => setEdit({ id: u.id, fn: u.first_name, ln: u.last_name, email: u.email, phone: u.phone || '', status: u.status, pkg: u.package_id || 'regular-free' })}>Edit</Btn><Btn variant="quiet" onClick={() => setKick(u)}>Sign out</Btn><Btn variant="quiet" onClick={() => setDel(u)}>Delete</Btn></div>],
        ]} />
      )}</Load>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title="Edit customer">
        {edit && <div className="stack">
          <div className="two"><Field label="First name" value={edit.fn} onChange={set('fn')} /><Field label="Last name" value={edit.ln} onChange={set('ln')} /></div>
          <Field label="Email" value={edit.email} onChange={set('email')} /><Field label="Phone" value={edit.phone} onChange={set('phone')} />
          <div className="two"><Field as="select" label="Status" value={edit.status} onChange={set('status')}>{['active', 'suspended'].map((s) => <option key={s}>{s}</option>)}</Field>
            <Field as="select" label="Plan" value={edit.pkg} onChange={set('pkg')}>{(pk.data?.items || []).filter((x) => x.type === 'regular').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Field></div>
          <div className="dlg__actions"><Button loading={upd.isPending} onClick={() => upd.mutate({ id: edit.id, firstName: edit.fn, lastName: edit.ln, email: edit.email, phone: edit.phone, status: edit.status, packageId: edit.pkg }, { onSuccess: () => setEdit(null) })}>Save</Button><Button variant="quiet" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>}
      </Dialog>
      <Confirm open={!!kick} title={`Sign out ${kick?.first_name}?`} confirmLabel="Sign out" busy={out.isPending} onClose={() => setKick(null)} onConfirm={() => out.mutate({ id: kick.id }, { onSuccess: () => setKick(null) })}>They are signed out on every device immediately.</Confirm>
      <Confirm open={!!del} title={`Delete ${del?.first_name} ${del?.last_name}?`} confirmLabel="Delete forever" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })}>This permanently removes the account.</Confirm>
    </>
  );
}
