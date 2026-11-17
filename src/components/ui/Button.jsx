export default function Button({ variant = 'primary', size, block, loading, children, ...rest }) {
  const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block'].filter(Boolean).join(' ');
  return (
    <button className={cls} aria-busy={loading || undefined} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
