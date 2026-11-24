import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { call } from './api.js';
import { useAuth } from './auth.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { X } from 'lucide-react';

export const useAds = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: ['ads'], queryFn: () => call('ads.list'), staleTime: 120_000, enabled: user?.role === 'regular' && !user.adsFree });
};

const seen = new Set();
const track = (id, kind) => call('ads.track', { id, kind }).catch(() => {});

/* A sponsored row that sits between provider rows. Clearly labelled, one impression per session. */
export function InlineAd({ ad }) {
  useEffect(() => { if (!seen.has(ad.id)) { seen.add(ad.id); track(ad.id, 'impression'); } }, [ad.id]);
  return (
    <li className="ad">
      {ad.image
        ? <img className="ad__img" src={ad.image} alt="" loading="lazy" />
        : <span className="ad__img ad__img--blank" aria-hidden="true">{(ad.advertiser || 'Ad').trim().charAt(0).toUpperCase()}</span>}
      <span className="ad__main">
        <span className="ad__label">Sponsored · {ad.advertiser || 'Partner'}</span>
        <span className="ad__title">{ad.title}</span>
        {ad.text && <span className="ad__text">{ad.text}</span>}
      </span>
      <a className="ad__cta" href={ad.link} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track(ad.id, 'click')}>{ad.cta}</a>
    </li>
  );
}

/* Call bumpAd('search') after a meaningful action. After N actions, and not too often, a popup appears. */
export function bumpAd() { window.dispatchEvent(new Event('fixia:ad-action')); }

export function PopupHost() {
  const { data } = useAds();
  const [ad, setAd] = useState(null);
  const [left, setLeft] = useState(0);
  const idx = useRef(0);

  useEffect(() => {
    if (!data?.popup.length) return;
    const on = () => {
      const n = (+sessionStorage.getItem('fixia.adn') || 0) + 1;
      sessionStorage.setItem('fixia.adn', n);
      if (n < data.config.actions) return;
      if (Date.now() - (+sessionStorage.getItem('fixia.adt') || 0) < data.config.minutes * 60000) return;
      sessionStorage.setItem('fixia.adn', 0); sessionStorage.setItem('fixia.adt', Date.now());
      const next = data.popup[idx.current++ % data.popup.length];
      setTimeout(() => { setAd(next); setLeft(data.config.skip); track(next.id, 'impression'); }, 900);
    };
    window.addEventListener('fixia:ad-action', on);
    return () => window.removeEventListener('fixia:ad-action', on);
  }, [data]);

  useEffect(() => { if (ad && left > 0) { const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); } }, [ad, left]);

  return (
    <Dialog open={!!ad} onClose={() => left <= 0 && setAd(null)} label="Advertisement" card>
      {ad && (
        <div className="adpop">
          <div className="adpop__bar">
            <span className="adpop__tag">Ad</span><span>Sponsored by <b>{ad.advertiser || 'our partner'}</b></span>
            <button type="button" className="adpop__close" disabled={left > 0} onClick={() => setAd(null)} aria-label={left > 0 ? `Close ad in ${left} seconds` : 'Close ad'}>
              {left > 0 ? left : <X size={18} aria-hidden="true" />}
            </button>
          </div>
          {ad.image
            ? <img className="adpop__img" src={ad.image} alt="" />
            : <div className="adpop__hero" style={{ background: ad.color }}>{ad.advertiser}</div>}
          <div className="adpop__body">
            <h3>{ad.title}</h3>
            {ad.text && <p>{ad.text}</p>}
            <a className="btn btn--primary btn--block" href={ad.link} target="_blank" rel="noopener noreferrer sponsored" onClick={() => { track(ad.id, 'click'); setAd(null); }}>{ad.cta}</a>
            <p className="adpop__note">Ads are removed with any paid plan.</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
