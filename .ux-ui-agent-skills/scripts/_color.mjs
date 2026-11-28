/**
 * Read any computed CSS colour as sRGB numbers.
 *
 * Chrome reports a computed colour in the syntax it was written in: rgb() for a
 * hex or rgb value, but oklch(), oklab(), lab(), lch() or color(srgb ...) for
 * the newer ones, and color-mix() resolves to one of those. The render gates
 * used to pull the numbers out of the string, which reads oklch(0.2 0.014 30)
 * as rgb(0.2, 0.014, 30): near black, so a page written in oklch (every
 * Tailwind v4 palette is) failed contrast on hundreds of elements it did not
 * get wrong.
 *
 * This paints the colour into one canvas pixel and reads the pixel back, so
 * the browser does the conversion it does on screen, gamut mapping included.
 * The alpha is taken from the string and the colour painted opaque, because a
 * translucent pixel comes back premultiplied and rounded.
 *
 * Usage, before page.goto:
 *   await page.addInitScript(COLOR_INIT);
 * then inside page.evaluate: window.__dsRGBA(cs.color) -> [r, g, b, a] or null,
 * or window.__dsRGBString(cs.color) -> 'rgb(r, g, b)' / 'rgba(r, g, b, a)'
 */
export const COLOR_INIT = () => {
  let cx = null;
  const memo = new Map();
  window.__dsRGBA = s => {
    if (!s) return null;
    if (s === 'transparent') return [0, 0, 0, 0];
    const rgb = /^rgba?\(([^)]*)\)$/.exec(s);
    if (rgb) {
      const p = rgb[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      if (p.length >= 3 && p.every(n => !Number.isNaN(n))) return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
    }
    if (memo.has(s)) return memo.get(s);
    let out = null;
    const m = /^([a-z-]+)\((.*)\)$/i.exec(s.trim());
    if (m) {
      const [body, alpha] = m[2].split('/');
      let a = 1;
      if (alpha !== undefined) a = alpha.trim().endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
      if (!cx) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; cx = cv.getContext('2d', { willReadFrequently: true }); }
      const sentinel = '#010203';
      cx.fillStyle = sentinel;
      cx.fillStyle = `${m[1]}(${body.trim()})`;
      if (cx.fillStyle !== sentinel && !Number.isNaN(a)) {
        cx.clearRect(0, 0, 1, 1);
        cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], a];
      }
    }
    memo.set(s, out);
    return out;
  };
  // The same colour in the rgb() form Chrome gives a hex value, for code that
  // compares colour strings ('rgb(0, 0, 0)') or reads their numbers.
  window.__dsRGBString = s => {
    const c = window.__dsRGBA(s);
    if (!c) return s;
    return c[3] === 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`;
  };
};
