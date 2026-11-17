// Shrinks a photo in the browser before upload. square: crop to a square of that size (avatars).
export function shrink(file, { max = 1200, square = 0, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Please choose a JPG or PNG image.'));
    if (file.size > 20 * 1024 * 1024) return reject(new Error('That image is too large (max 20 MB).'));
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.onload = () => {
        const c = document.createElement('canvas'), x = c.getContext('2d');
        if (square) { const s = Math.min(img.width, img.height); c.width = c.height = square; x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, square, square); }
        else { const k = Math.min(1, max / Math.max(img.width, img.height)); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); x.drawImage(img, 0, 0, c.width, c.height); }
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
export const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
