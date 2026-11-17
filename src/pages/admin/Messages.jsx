import { useState } from 'react';
import { useAdm, useDo, Load, Head, Btn } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { admin } from '../../lib/api.js';
import { Status } from '../../components/ui/Kit.jsx';

const TYPES = { announcement: 'Announcement', warning: 'Warning', maintenance: 'Maintenance', welcome: 'Welcome' };
export default function Messages() {
  const q = useAdm('templates.list'); const [t, setT] = useState(null), [del, setDel] = useState(null), [tpl, setTpl] = useState(''), [to, setTo] = useState('all'), [who, setWho] = useState(null), [text, setText] = useState(''), [hits, setHits] = useState([]);
  const save = useDo('template.save', 'Template saved'), rm = useDo('template.delete', 'Template deleted'), send = useDo('message.send', (d) => `Sent to ${d.sent} user${d.sent === 1 ? '' : 's'}`);
  async function find(v) { setText(v); setHits(v.length > 1 ? (await admin('users.search', { text: v })).items : []); }
  const chosen = (q.data?.items || []).find((x) => x.id === tpl);
  return (
    <>
      <Head title="Messages" sub="Announcements and notices. Recipients must read them before continuing." />
      <section className="stack" style={{ maxWidth: 520 }}>
        <h2>Send a message</h2>
        <Field as="select" label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Select…</option>{(q.data?.items || []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Field>
        {chosen && <div className="banner banner--ok" style={{ borderColor: 'var(--ink)', background: 'var(--surface)' }}><h3>{chosen.title}</h3><p style={{ whiteSpace: 'pre-wrap' }} className="small">{chosen.body}</p></div>}
        <Field as="select" label="Send to" value={to} onChange={(e) => { setTo(e.target.value); setWho(null); }}><option value="all">Everyone</option><option value="regulars">All customers</option><option value="providers">All providers</option><option value="one">One person…</option></Field>
        {to === 'one' && (who ? <p>To: <b>{who.first_name} {who.last_name}</b> ({who.email}) <Btn variant="quiet" onClick={() => setWho(null)}>Change</Btn></p> : <><Field label="Search by name or email" value={text} onChange={(e) => find(e.target.value)} />{hits.map((u) => <button key={u.id} className="row" style={{ padding: 'var(--s3)' }} onClick={() => { setWho(u); setHits([]); }}><b>{u.first_name} {u.last_name}</b> <span className="muted small">{u.email} · {u.role}</span></button>)}</>)}
        <div><Button loading={send.isPending} disabled={!tpl || (to === 'one' && !who)} onClick={() => send.mutate({ templateId: tpl, to: to === 'one' ? { userId: who.id } : to })}>Send message</Button></div>
      </section>
      <section className="section"><div className="section-head"><h2>Templates</h2><Button size="sm" variant="secondary" onClick={() => setT({ type: 'announcement', title: '', body: '' })}>New template</Button></div>
        <Load q={q}>{(d) => !d.items.length ? <p className="muted" style={{ padding: 'var(--s4) 0' }}>No templates yet.</p> : <ul className="rows" style={{ borderTop: 0 }}>{d.items.map((x) => <li key={x.id} className="row"><div className="cluster"><b>{x.title}</b><Status kind={x.type === 'warning' ? 'danger' : 'neutral'}>{TYPES[x.type]}</Status><span className="small muted">sent {x.send_count || 0}×</span></div><p className="small muted">{x.body}</p><div className="cluster"><Btn variant="secondary" onClick={() => setT({ id: x.id, type: x.type, title: x.title, body: x.body })}>Edit</Btn><Btn variant="quiet" onClick={() => setDel(x)}>Delete</Btn></div></li>)}</ul>}</Load></section>
      <Dialog open={!!t} onClose={() => setT(null)} title={t?.id ? 'Edit template' : 'New template'}>
        {t && <div className="stack"><Field as="select" label="Type" value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Field><Field label="Title" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /><Field as="textarea" label="Message" value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} />
          <div className="dlg__actions"><Button loading={save.isPending} onClick={() => save.mutate(t, { onSuccess: () => setT(null) })}>Save</Button><Button variant="quiet" onClick={() => setT(null)}>Cancel</Button></div></div>}
      </Dialog>
      <Confirm open={!!del} title={`Delete “${del?.title}”?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })} />
    </>
  );
}
