import { useState } from 'react';
import { Plus, Pencil, Trash2, Pause, Play, RotateCcw } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, IconBtn, Menu, Prompt } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Tabs, Status } from '../../components/ui/Kit.jsx';
import { fdate } from '../../lib/format.js';
import { shrink } from '../../lib/image.js';
import { toast } from '../../lib/toast.jsx';
import Cropper from '../../components/ui/Cropper.jsx';

const blank = { type: 'inline', advertiser: '', title: '', description: '', ctaLabel: 'Learn more', linkUrl: '', bgColor: '#0F1A27', quota: 5000, notes: '', image: '' };
const Meter = ({ n, of }) => <div><span className="num small">{n || 0} / {of || 5000}</span><div className="meter"><i style={{ width: `${Math.min(100, ((n || 0) / (of || 5000)) * 100)}%` }} /></div></div>;

export default function Ads() {
  const [tab, setTab] = useState('inline'); const q = useAdm('ads.list'), rot = useAdm('rotation.stats'), hist = useAdm('ad.batches');
  const [f, setF] = useState(null), [del, setDel] = useState(null), [rerun, setRerun] = useState(null), [crop, setCrop] = useState('');
  const save = useDo('ad.save', 'Ad saved'), rm = useDo('ad.delete', 'Ad deleted'), tog = useDo('ad.toggle', 'Updated'), re = useDo('ad.rerun', 'New batch started'), react = useDo('rotation.reactivate', 'Provider reactivated');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const open = (a) => setF(a ? { id: a.id, type: a.type, advertiser: a.advertiser, title: a.title, description: a.description || '', ctaLabel: a.cta_label || '', linkUrl: a.link_url || '', bgColor: a.bg_color || '#0F1A27', quota: a.impression_quota, notes: a.notes || '', image: a.image_url || '' } : { ...blank, type: tab });
  const state = (a) => (a.is_active ? ['ok', 'Running'] : a.impression_count >= a.impression_quota ? ['neutral', 'Completed'] : ['warn', 'Paused']);
  return (
    <>
      <Head title="Ads & featured" sub="Ads show to customers on the free plan only.">{(tab === 'inline' || tab === 'popup') && <IconBtn icon={Plus} label="Add an ad" variant="primary" size="md" onClick={() => open()} />}</Head>
      <Tabs items={[['inline', 'Inline ads'], ['popup', 'Pop-up ads'], ['featured', 'Featured providers'], ['history', 'History']]} value={tab} onChange={setTab} />

      {tab === 'history' ? (
        <Load q={hist}>{(d) => <Table empty="No batches yet." rows={d.items.filter((b) => d.ads.some((a) => a.id === b.ad_id))} cols={[
          ['Ad', (b) => <b>{d.ads.find((a) => a.id === b.ad_id)?.title}</b>],
          ['Batch', (b) => `#${b.batch_number}`],
          ['Type', (b) => (d.ads.find((a) => a.id === b.ad_id)?.type === 'popup' ? 'Pop-up' : 'Inline')],
          ['Impressions', (b) => `${b.impression_count} / ${b.impression_quota}`],
          ['Clicks', (b) => b.click_count || 0],
          ['Started', (b) => fdate(b.started_at)],
          ['State', (b) => <Status kind={b.status === 'active' ? 'ok' : 'neutral'}>{b.status}</Status>],
        ]} />}</Load>
      ) : tab === 'featured' ? (
        <Load q={rot}>{(d) => <Table empty="No featured providers." rows={d.items} cols={[
          ['Provider', (p) => <b>{p.biz_name}{p.is_elite && <span className="tag">Elite</span>}</b>], ['Plan', (p) => p.package_id], ['Rating', (p) => p.avg_rating || 0], ['Shown', (p) => <Meter n={p.featured_impressions} of={p.featured_quota} />],
          ['State', (p) => <Status kind={p.is_featured ? 'ok' : 'neutral'}>{p.is_featured ? 'Active' : 'Finished'}</Status>],
          ['', (p) => !p.is_featured && <IconBtn icon={RotateCcw} label="Reactivate" variant="primary" loading={react.isPending && react.variables?.id === p.id} onClick={() => react.mutate({ id: p.id })} />],
        ]} />}</Load>
      ) : (
        <Load q={q}>{(d) => <Table empty="No ads of this type yet." rows={d.items.filter((a) => a.type === tab)} cols={[
          ['Ad', (a) => <><b>{a.title}</b><br /><span className="muted">{a.advertiser}</span></>], ['Impressions', (a) => <Meter n={a.impression_count} of={a.impression_quota} />], ['Clicks', (a) => a.click_count || 0],
          ['State', (a) => <Status kind={state(a)[0]}>{state(a)[1]}</Status>],
          ['', (a) => <Menu items={[
            { icon: Pencil, label: 'Edit', onClick: () => open(a) },
            state(a)[1] === 'Completed' ? { icon: RotateCcw, label: 'Re-run', onClick: () => setRerun(a) } : { icon: a.is_active ? Pause : Play, label: a.is_active ? 'Pause' : 'Resume', onClick: () => tog.mutate({ id: a.id, active: !a.is_active }) },
            { icon: Trash2, label: 'Delete', danger: true, onClick: () => setDel(a) },
          ]} />]]} />}</Load>
      )}

      <Dialog open={!!f} onClose={() => setF(null)} title={f?.id ? 'Edit ad' : 'New ad'} wide>
        {f && <div className="stack">
          <div className="two"><Field as="select" label="Type" value={f.type} onChange={set('type')}><option value="inline">Inline (between rows)</option><option value="popup">Pop-up</option></Field><Field label="Impression quota" type="number" min="5" value={f.quota} onChange={set('quota')} /></div>
          <div className="two"><Field label="Advertiser" value={f.advertiser} onChange={set('advertiser')} /><Field label="Title" value={f.title} onChange={set('title')} /></div>
          <Field label="Text (optional)" value={f.description} onChange={set('description')} />
          <div className="two"><Field label="Button label" value={f.ctaLabel} onChange={set('ctaLabel')} /><Field label="Link URL" type="url" value={f.linkUrl} onChange={set('linkUrl')} /></div>
          <div className="stack">
            <span className="field__label">Image (optional, shown at the top of pop-ups)</span>
            {f.image && <img src={f.image} alt="Ad preview" style={{ maxHeight: 140, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 10 }} />}
            <div className="cluster">
              <label className="btn btn--secondary btn--sm">{f.image ? 'Change image' : 'Choose image'}<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { try { setCrop(await shrink(e.target.files[0], { max: 1600 })); } catch (err) { toast(err.message, 'error'); } e.target.value = ''; }} /></label>
              {f.image && <button type="button" className="btn btn--quiet btn--sm" onClick={() => setF({ ...f, image: '' })}>Remove image</button>}
            </div>
          </div>
          <Field as="textarea" label="Internal notes (not shown)" value={f.notes} onChange={set('notes')} />
          <div className="dlg__actions"><Button loading={save.isPending} onClick={() => save.mutate({ ...f, quota: +f.quota }, { onSuccess: () => setF(null) })}>Save ad</Button><Button variant="quiet" onClick={() => setF(null)}>Cancel</Button></div>
        </div>}
      </Dialog>
      <Cropper open={!!crop} src={crop} onClose={() => setCrop('')} onDone={(img) => { setF((x) => ({ ...x, image: img })); setCrop(''); }} />
      <Prompt open={!!rerun} title={`Re-run ${rerun?.title}`} label="New impression quota" confirmLabel="Start new batch" busy={re.isPending} onClose={() => setRerun(null)} onSubmit={(v) => re.mutate({ id: rerun.id, quota: v || rerun.impression_quota }, { onSuccess: () => setRerun(null) })}><p className="muted small">Counts reset to zero. The finished batch is kept in history.</p></Prompt>
      <Confirm open={!!del} title={`Delete “${del?.title}”?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })} />
    </>
  );
}