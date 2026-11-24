import { useState } from 'react';
import { Plus, Pencil, Trash2, Pause, Play, RotateCcw, Download } from 'lucide-react';
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
function exportCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Ad', 'Advertiser', 'Type', 'Batch', 'Impressions', 'Quota', 'Clicks', 'Started', 'Completed'];
  const lines = [head, ...rows.map((b) => [b.title, b.advertiser, b.kind, b.batch_number, b.impression_count, b.impression_quota, b.click_count || 0, fdate(b.started_at), b.completed_at ? fdate(b.completed_at) : ''])].map((r) => r.map(esc).join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `fixia-ads-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}
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
        <Load q={hist}>{(d) => {
          const rows = d.items.filter((b) => d.ads.some((a) => a.id === b.ad_id)).map((b) => {
            const a = d.ads.find((x) => x.id === b.ad_id);
            return { ...b, title: a.title, advertiser: a.advertiser, kind: a.type === 'popup' ? 'Pop-up' : 'Inline', ctr: b.impression_count ? (((b.click_count || 0) / b.impression_count) * 100).toFixed(2) : '0.00' };
          });
          return (
            <>
              <div className="cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
                <span className="muted small">{rows.length} completed run{rows.length === 1 ? '' : 's'}</span>
                <Button size="sm" variant="secondary" disabled={!rows.length} onClick={() => exportCsv(rows)}><Download size={14} aria-hidden="true" /> Export to Excel</Button>
              </div>
              {!rows.length ? <p className="muted">No completed ads yet. An ad appears here once it reaches its impression quota.</p> : (
                <div className="table-wrap hist-wrap">
                  <table className="table">
                    <thead><tr><th>Advertiser</th><th>Type</th><th>Batch</th><th>Impressions</th><th>Clicks</th><th>Started</th><th>Completed</th></tr></thead>
                    <tbody>{rows.map((b) => (
                      <tr key={b.id}><td><b>{b.advertiser || b.title}</b></td><td>{b.kind}</td><td className="num">#{b.batch_number}</td><td className="num">{b.impression_count} / {b.impression_quota}</td><td className="num">{b.click_count || 0}</td><td>{fdate(b.started_at)}</td><td>{b.completed_at ? fdate(b.completed_at) : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}</Load>
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
          <div className="two"><Field as="select" label="Type" value={f.type} onChange={set('type')}><option value="inline">Inline (between rows)</option><option value="popup">Pop-up</option></Field><Field label="Impression quota" type="number" min="1" value={f.quota} onChange={set('quota')} /></div>
          <div className="two"><Field label="Advertiser" value={f.advertiser} onChange={set('advertiser')} /><Field label="Title" value={f.title} onChange={set('title')} /></div>
          <Field label="Text (optional)" value={f.description} onChange={set('description')} />
          <div className="two"><Field label="Button label" value={f.ctaLabel} onChange={set('ctaLabel')} /><Field label="Link URL" type="url" value={f.linkUrl} onChange={set('linkUrl')} /></div>
          <div className="stack">
            <span className="field__label">Image (optional): square for inline ads, wide for pop-ups</span>
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
      <Cropper open={!!crop} src={crop} aspect={f?.type === 'inline' ? 1 : 19 / 11} onClose={() => setCrop('')} onDone={(img) => { setF((x) => ({ ...x, image: img })); setCrop(''); }} />
      <Prompt open={!!rerun} title={`Re-run ${rerun?.advertiser || rerun?.title}`} label="New impression quota" type="number" min="1" placeholder={String(rerun?.impression_quota || 5000)} confirmLabel="Start new batch" busy={re.isPending} onClose={() => setRerun(null)} onSubmit={(v) => re.mutate({ id: rerun.id, quota: v || rerun.impression_quota }, { onSuccess: () => setRerun(null) })}><p className="muted small">Counts reset to zero. The finished batch is kept in history.</p></Prompt>
      <Confirm open={!!del} title={`Delete “${del?.title}”?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })} />
    </>
  );
}