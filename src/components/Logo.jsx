import { useState } from 'react';

/* The Fixia logo image. If /images/fixia-logo.png is missing it falls back to the text logo. */
export default function Logo({ width = 126 }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className="wordmark">fix<span>ia</span></span>;
  return <img src="/images/fixia-logo.png" alt="Fixia" width={width} height={Math.round((width * 37) / 126)} style={{ display: 'block' }} onError={() => setBad(true)} />;
}
