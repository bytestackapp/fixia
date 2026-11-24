// Every image the app uploads is compressed to stay under 50 KB.
const LIMIT = 49000;
const bytes = (dataUrl) => Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

// draw(ctx, width, height) paints the picture. Lowers quality, then size, until the file fits.
export function compressCanvas(draw, w, h, limit = LIMIT) {
  let scale = 1;
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    draw(x, c.width, c.height);
    for (let q = 0.85; q >= 0.4; q -= 0.15) {
      const out = c.toDataURL('image/jpeg', q);
      if (bytes(out) <= limit) return out;
    }
    scale *= 0.85;
  }
  throw new Error('Could not make that image small enough. Try a different image.');
}

// Shrinks a photo in the browser before upload. square: crop to a square of that size (avatars).
export function shrink(file, { max = 1200, square = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Please choose a JPG or PNG image.'));
    if (file.size > 20 * 1024 * 1024) return reject(new Error('That image is too large (max 20 MB).'));
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.onload = () => {
        try {
          if (square) {
            const s = Math.min(img.width, img.height);
            resolve(compressCanvas((x, W, H) => x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, W, H), square, square));
          } else {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            resolve(compressCanvas((x, W, H) => x.drawImage(img, 0, 0, W, H), Math.round(img.width * k), Math.round(img.height * k)));
          }
        } catch (e) { reject(e); }
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
export const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });