import { useState } from 'react';
import { useAdm, useDo, Load, Head, Table, Btn, Prompt } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Tabs, Status } from '../../components/ui/Kit.jsx';
import { fdate } from '../../lib/format.js';

const blank = { type: 'inline', advertiser: '', title: '', description: '', ctaLabel: 'Learn more', linkUrl: '', bgColor: '#0F1A27', quota: 5000, notes: '' };
const Meter = ({ n, of }) => <div><span className="num small">{n || 0} / {of || 5000}</span><div className="meter"><i style={{ width: `${Math.min(100, ((n || 0) / (of || 5000)) * 100)}%` }} /></div></div>;

export default function Ads() {
  const [tab, setTab] = useState('inline'); const q = useAdm('ads.list'), rot = useAdm('rotation.stats'), hist = useAdm('ad.batches', { type: tab });
  const [f, setF] = useState(null), [del, setDel] = useState(null), [rerun, setRerun] = useState(null), [showHist, setShowHist] = useState(false);
  const save = useDo('ad.save', 'Ad saved'), rm = useDo('ad.delete', 'Ad deleted'), tog = useDo('ad.toggle', 'Updated'), re = useDo('ad.rerun', 'New batch started'), react = useDo('rotation.reactivate', (d) => `${d.count} provider(s) reactivated`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const open = (a) => setF(a ? { id: a.id, type: a.type, advertiser: a.advertiser, title: a.title, description: a.description || '', ctaLabel: a.cta_label || '', linkUrl: a.link_url || '', bgColor: a.bg_color || '#0F1A27', quota: a.impression_quota, notes: a.notes || '' } : { ...blank, type: tab });
  const state = (a) => (a.is_active ? ['ok', 'Running'] : a.impression_count >= a.impression_quota ? ['neutral', 'Completed'] : ['warn', 'Paused']);
  return (
    <>
      <Head title="Ads & featured" sub="Ads show to customers on the free plan only."><Button onClick={() => open()}>Add an ad</Button></Head>
      <Tabs items={[['inline', 'Inline ads'], ['popup', 'Pop-up ads']]} value={tab} onChange={setTab} />
      <Load q={q}>{(d) => <Table empty="No ads of this type yet." rows={d.items.filter((a) => a.type === tab)} cols={[
        ['Ad', (a) => <><b>{a.title}</b><br /><span className="muted">{a.advertiser}</span></>], ['Impressions', (a) => <Meter n={a.impression_count} of={a.impression_quota} />], ['Clicks', (a) => a.click_count || 0],
        ['State', (a) => <Status kind={state(a)[0]}>{state(a)[1]}</Status>],
        ['', (a) => <div className="actions-cell"><Btn variant="secondary" onClick={() => open(a)}>Edit</Btn>{state(a)[1] === 'Completed' ? <Btn onClick={() => setRerun(a)}>Re-run</Btn> : <Btn variant="quiet" onClick={() => tog.mutate({ id: a.id, active: !a.is_active })}>{a.is_active ? 'Pause' : 'Resume'}</Btn>}<Btn variant="quiet" onClick={() => setDel(a)}>Delete</Btn></div>]]} />}</Load>
      <div style={{ marginTop: 'var(--s3)' }}><Button variant="quiet" size="sm" onClick={() => setShowHist(true)}>Batch history</Button></div>

      <section className="section"><div className="section-head"><h2>Featured providers</h2><Button size="sm" variant="secondary" loading={react.isPending} onClick={() => react.mutate({})}>Reactivate finished</Button></div>
        <Load q={rot}>{(d) => <Table empty="No featured providers." rows={d.items} cols={[['Provider', (p) => <b>{p.biz_name}{p.is_elite && <span className="tag">Elite</span>}</b>], ['Plan', (p) => p.package_id], ['Rating', (p) => p.avg_rating || 0], ['Shown', (p) => <Meter n={p.featured_impressions} of={p.featured_quota} />]]} />}</Load></section>

      <Dialog open={!!f} onClose={() => setF(null)} title={f?.id ? 'Edit ad' : 'New ad'} wide>
        {f && <div className="stack">
          <div className="two"><Field as="select" label="Type" value={f.type} onChange={set('type')}><option value="inline">Inline (between rows)</option><option value="popup">Pop-up</option></Field><Field label="Impression quota" type="number" min="5" value={f.quota} onChange={set('quota')} /></div>
          <div className="two"><Field label="Advertiser" value={f.advertiser} onChange={set('advertiser')} /><Field label="Title" value={f.title} onChange={set('title')} /></div>
          <Field label="Text (optional)" value={f.description} onChange={set('description')} />
          <div className="two"><Field label="Button label" value={f.ctaLabel} onChange={set('ctaLabel')} /><Field label="Link URL" type="url" value={f.linkUrl} onChange={set('linkUrl')} /></div>
          <Field as="textarea" label="Internal notes (not shown)" value={f.notes} onChange={set('notes')} />
          <div className="dlg__actions"><Button loading={save.isPending} onClick={() => save.mutate({ ...f, quota: +f.quota }, { onSuccess: () => setF(null) })}>Save ad</Button><Button variant="quiet" onClick={() => setF(null)}>Cancel</Button></div>
        </div>}
      </Dialog>
      <Prompt open={!!rerun} title={`Re-run ${rerun?.title}`} label="New impression quota" confirmLabel="Start new batch" busy={re.isPending} onClose={() => setRerun(null)} onSubmit={(v) => re.mutate({ id: rerun.id, quota: v || rerun.impression_quota }, { onSuccess: () => setRerun(null) })}><p className="muted small">Counts reset to zero. The finished batch is kept in history.</p></Prompt>
      <Confirm open={!!del} title={`Delete “${del?.title}”?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })} />
      <Dialog open={showHist} onClose={() => setShowHist(false)} title="Batch history" wide>
        <Load q={hist}>{(d) => <Table empty="No batches yet." rows={d.items.filter((b) => d.ads.some((a) => a.id === b.ad_id))} cols={[['Ad', (b) => d.ads.find((a) => a.id === b.ad_id)?.title], ['Batch', (b) => `#${b.batch_number}`], ['Impressions', (b) => `${b.impression_count} / ${b.impression_quota}`], ['Clicks', (b) => b.click_count || 0], ['Started', (b) => fdate(b.started_at)], ['State', (b) => b.status]]} />}</Load>
        <div className="dlg__actions"><Button variant="secondary" onClick={() => setShowHist(false)}>Close</Button></div>
      </Dialog>
    </>
  );
}
