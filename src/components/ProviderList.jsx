import { Fragment } from 'react';
import ProviderRow from './ProviderRow.jsx';
import { InlineAd, useAds } from '../lib/ads.jsx';

/* Provider rows with a labelled sponsored row every few items (free customers only). */
export default function ProviderList({ items }) {
  const { data } = useAds();
  const ads = data?.inline || [], every = data?.config.inline || 4;
  return (
    <ul className="rows">
      {items.map((p, i) => (
        <Fragment key={p.id}>
          <ProviderRow p={p} />
          {ads.length > 0 && (i + 1) % every === 0 && <InlineAd ad={ads[Math.floor(i / every) % ads.length]} />}
        </Fragment>
      ))}
    </ul>
  );
}
