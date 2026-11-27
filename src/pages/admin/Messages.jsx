import { useState } from 'react';
import { Plus, Pencil, Trash2, X, FileText, Send, Eraser } from 'lucide-react';
import { useAdm, useDo, Head, Btn, IconBtn } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { admin } from '../../lib/api.js';
import { Status } from '../../components/ui/Kit.jsx';

const TYPES = { announcement: 'Announcement', warning: 'Warning', maintenance: 'Maintenance', welcome: 'Welcome' };

export default function Messages() {
  const q = useAdm('templates.list');
  const [msg, setMsg] = useState({ type: 'announcement', title: '', body: '' }), [tplId, setTplId] = useState('');
  const [to, setTo] = useState('all'), [who, setWho] = useState([]), [text, setText] = useState(''), [hits, setHits] = useState([]);
  const [pickOpen, setPickOpen] = useState(false), [t, setT] = useState(null), [del, setDel] = useState(null);

  const save = useDo('template.save', 'Template saved'), rm = useDo('template.delete', 'Template deleted');
  const send = useDo('message.send', (d) => `Sent to ${d.sent} user${d.sent === 1 ? '' : 's'}`);

  async function find(v) {
    setText(v);
    if (v.length < 2) return setHits([]);
    const r = await admin('users.search', { text: v });
    setHits(r.items.filter((u) => !who.some((w) => w.id === u.id)));
  }
  const addPerson = (u) => { setWho([...who, u]); setHits([]); setText(''); };
  const dropPerson = (id) => setWho(who.filter((u) => u.id !== id));

  const useTemplate = (x) => {
    setMsg({ type: x.type, title: x.title, body: x.body });
    setTplId(x.id);
    setPickOpen(false);
  };
  const reset = () => { setMsg({ type: 'announcement', title: '', body: '' }); setTplId(''); setWho([]); setText(''); setHits([]); };

  // only count it as a template send if the text was not changed
  const tpl = (q.data?.items || []).find((x) => x.id === tplId);
  const sameAsTpl = tpl && tpl.title === msg.title && tpl.body === msg.body;

  const ready = msg.title.trim() && msg.body.trim() && (to !== 'selected' || who.length > 0);
  const doSend = () => send.mutate(
    { title: msg.title, body: msg.body, type: msg.type, templateId: sameAsTpl ? tplId : undefined, to: to === 'selected' ? { userIds: who.map((u) => u.id) } : to },
    { onSuccess: reset }
  );

  return (
    <>
      <Head title="Messages" sub="Announcements and notices. Recipients must read them before continuing." />
      <section className="stack" style={{ maxWidth: 520 }}>
        <Field as="select" label="Send to" value={to} onChange={(e) => { setTo(e.target.value); setWho([]); setHits([]); setText(''); }}>
          <option value="all">Everyone</option>
          <option value="regulars">All customers</option>
          <option value="providers">All providers</option>
          <option value="selected">Selected persons</option>
        </Field>

        {to === 'selected' && (
          <>
            {who.length > 0 && (
              <div className="cluster">
                {who.map((u) => (
                  <button key={u.id} type="button" className="btn btn--secondary btn--sm" onClick={() => dropPerson(u.id)} aria-label={`Remove ${u.first_name} ${u.last_name}`}>
                    {u.first_name} {u.last_name} <X size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <Field label="Search by name or email" value={text} onChange={(e) => find(e.target.value)} hint={who.length ? `${who.length} selected. Search to add more.` : 'Search and tap a person to add them.'} />
            {hits.map((u) => (
              <button key={u.id} className="row" style={{ padding: 'var(--s3)' }} onClick={() => addPerson(u)}>
                <span><b>{u.first_name} {u.last_name}</b> <span className="muted small">{u.email} · {u.role}</span></span>
              </button>
            ))}
          </>
        )}

        <Field as="select" label="Type" value={msg.type} onChange={(e) => setMsg({ ...msg, type: e.target.value })}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Field>
        <Field label="Title" maxLength={100} value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} />
        <Field as="textarea" label="Message" value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} hint="Write your own message, or tap Templates to start from a saved one." />

        <div className="cluster">
          <Button loading={send.isPending} disabled={!ready} onClick={doSend}>Send</Button>
          <Button variant="secondary" onClick={() => setPickOpen(true)}><FileText size={16} aria-hidden="true" /> Templates</Button>
          <Button variant="quiet" disabled={!msg.title && !msg.body && !who.length} onClick={reset}><Eraser size={16} aria-hidden="true" /> Clear</Button>
        </div>
      </section>

      {/* template list */}
      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} title="Templates" wide>
        <div className="stack">
          <div><Btn variant="secondary" onClick={() => setT({ type: 'announcement', title: '', body: '' })}><Plus size={14} aria-hidden="true" /> New template</Btn></div>
          {!(q.data?.items || []).length ? <p className="muted">No templates yet.</p> : (
            <ul className="rows" style={{ maxHeight: '55dvh', overflowY: 'auto' }}>
              {q.data.items.map((x) => (
                <li key={x.id} className="row">
                  <div className="cluster"><b>{x.title}</b><Status kind={x.type === 'warning' ? 'danger' : 'neutral'}>{TYPES[x.type]}</Status></div>
                  <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{x.body}</p>
                  <div className="cluster">
                    <IconBtn icon={Send} label="Use this" variant="primary" onClick={() => useTemplate(x)} />
                    <IconBtn icon={Pencil} label="Edit" onClick={() => setT({ id: x.id, type: x.type, title: x.title, body: x.body })} />
                    <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDel(x)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="dlg__actions"><Button variant="quiet" onClick={() => setPickOpen(false)}>Close</Button></div>
        </div>
      </Dialog>

      {/* create / edit template */}
      <Dialog open={!!t} onClose={() => setT(null)} title={t?.id ? 'Edit template' : 'New template'}>
        {t && <div className="stack">
          <Field as="select" label="Type" value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Field>
          <Field label="Title" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
          <Field as="textarea" label="Message" value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} />
          <div className="dlg__actions"><Button loading={save.isPending} onClick={() => save.mutate(t, { onSuccess: () => setT(null) })}>Save</Button><Button variant="quiet" onClick={() => setT(null)}>Cancel</Button></div>
        </div>}
      </Dialog>

      <Confirm open={!!del} title={`Delete “${del?.title}”?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })} />
    </>
  );
}