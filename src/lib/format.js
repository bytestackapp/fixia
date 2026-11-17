export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
export const fdate = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
export const ago = (d) => {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
export const PERIOD = { month: 'month', '3month': '3 months', '6month': '6 months', year: 'year', lifetime: 'lifetime' };
export const daysLeft = (end) => (end ? Math.max(0, Math.ceil((new Date(end) - Date.now()) / 86400000)) : null);
