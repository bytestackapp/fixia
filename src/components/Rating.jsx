import { Star } from 'lucide-react';

export default function Rating({ value, count }) {
  if (!count) return <span className="rating rating--new">New</span>;
  return (
    <span className="rating num" aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} reviews`}>
      <Star size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      <b>{value.toFixed(1)}</b><span className="rating__n">({count})</span>
    </span>
  );
}
