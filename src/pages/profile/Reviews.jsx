import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { call } from '../../lib/api.js';
import { fdate } from '../../lib/format.js';
import { RowsSkeleton, Empty } from '../../components/States.jsx';

export default function Reviews({ data }) {
  const { data: d, isLoading } = useQuery({ queryKey: ['reviews'], queryFn: () => call('reviews.mine') });
  const p = data.provider;
  return (
    <>
      <div className="score"><b className="num">{Number(p.avgRating || 0).toFixed(1)}</b><span>from {p.totalRatings || 0} review{p.totalRatings === 1 ? '' : 's'}</span></div>
      {isLoading ? <RowsSkeleton rows={2} /> : !d.items.length ? <Empty title="No reviews yet">Finish jobs and customers can rate you.</Empty> : d.items.map((r, i) => (
        <article className="review" key={i}><div className="review__top"><span className="stars" role="img" aria-label={`${r.stars} out of 5`}>{Array.from({ length: 5 }, (_, k) => <Star key={k} size={14} fill={k < r.stars ? 'currentColor' : 'none'} strokeWidth={k < r.stars ? 0 : 1.5} />)}</span><span><b>{r.name}</b> · {fdate(r.createdAt)}</span></div>{r.comment && <p>{r.comment}</p>}</article>
      ))}
    </>
  );
}
