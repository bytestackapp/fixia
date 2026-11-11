import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Rating from './Rating.jsx';

export default function ProviderRow({ p }) {
  const where = [p.city, p.province].filter(Boolean).join(', ');
  return (
    <li>
      <Link to={`/p/${p.id}`} className="prow">
        <Avatar name={p.name} url={p.avatarUrl} />
        <span className="prow__main">
          <span className="prow__name">{p.name}{p.isElite && <span className="tag">Elite</span>}</span>
          {p.services.length > 0 && <span className="prow__services">{p.services.slice(0, 3).join(' · ')}</span>}
          {where && <span className="prow__where">{where}</span>}
        </span>
        <Rating value={p.rating} count={p.reviews} />
      </Link>
    </li>
  );
}
