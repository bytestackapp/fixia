export default function Avatar({ name = '', url, size = 48 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return url
    ? <img className="avatar" src={url} alt="" style={style} loading="lazy" />
    : <span className="avatar avatar--blank" style={style} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>;
}
