export const CYCLE_MS = 8000;
export const FADE_SECS = 0.6;

export const year = (d) => (d ? String(d).slice(0, 4) : null);

export const ratingColor = (v) => {
  if (v >= 7.5) return '#4caf50';
  if (v >= 6) return '#ff9800';
  return '#f44336';
};

export const clampLines = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export async function extractDominantColor(imgUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const SIZE = 60;
        const canvas = document.createElement('canvas');
        const scale = SIZE / Math.max(img.width, img.height);

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;

        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

          if (brightness < 15 || brightness > 240) continue;

          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }

        resolve(
          n > 0
            ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
            : null
        );
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}

export function darken([r, g, b], factor = 0.45) {
  return `${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(
    b * factor
  )}`;
}

export function updateThemeColor(color) {
  if (!color) return;

  document.documentElement.style.setProperty('--hero-color', color);

  let meta = document.querySelector('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }

  meta.content = `rgb(${color})`;
}
``