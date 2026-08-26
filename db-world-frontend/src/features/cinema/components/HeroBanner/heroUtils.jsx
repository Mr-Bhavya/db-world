import { useEffect, useRef, useState } from 'react';

export const CYCLE_MS = 8000; // hero auto-advance interval (desktop) + Ken Burns zoom duration
export const FADE_SECS = 0.6;

export const year = (d) => (d ? String(d).slice(0, 4) : null);

/** 142 → "2h 22m", 47 → "47m". Null for missing/zero/garbage. */
export const fmtRuntime = (min) => {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return null;
  const h = Math.floor(n / 60);
  const mm = n % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
};

/**
 * Mobile hero meta row: year · up to two genres · runtime-or-seasons.
 * Type lives in the ribbon above the title and certification / rating render
 * separately, so neither belongs here.
 */
export function buildMobileMeta(record) {
  if (!record) return [];
  const items = [];

  const y = year(record.releaseDate);
  if (y) items.push(y);

  (record.genres ?? []).slice(0, 2).forEach((g) => items.push(g));

  if (record.type === 'MOVIE') {
    const rt = fmtRuntime(record.runtime);
    if (rt) items.push(rt);
  } else if (record.numberOfSeasons > 0) {
    items.push(record.numberOfSeasons === 1 ? '1 Season' : `${record.numberOfSeasons} Seasons`);
  }

  return items;
}

export const ratingColor = (v) => {
  if (v >= 7.5) return '#4caf50';
  if (v >= 6) return '#ff9800';
  return '#f44336';
};

// ─── Hero artwork selection ────────────────────────────────────────────────
// ONE source of truth for which image the hero shows. The colour extraction
// must run against the very image on screen, otherwise the page wash is keyed
// to artwork the user never sees — which is how you get a teal wash under a
// warm orange poster.
//
// When we draw our own title logo the artwork underneath must be TEXTLESS, or
// the title appears twice, so the clean variants are preferred in that case.
//
// `tmdbImg` is passed in rather than imported to keep this module free of an
// API dependency (heroUtils is imported by pure helpers and tests).
// `titled: true` inverts the poster preference: the phone card stack paints the poster
// AS the hero and draws no title of its own, so there the poster's own title art is the
// title and the text-bearing variant is the one we want first.
export function heroArtCandidates(record, { portrait, hasLogo, titled = false }) {
  const posterClean = record?.posterPathClean;
  const posterText = record?.posterPath;
  const backdropClean = record?.backdropPath;
  const backdropText = record?.backdropPathText;

  if (portrait) {
    if (titled) {
      return [posterText, posterClean, backdropText, backdropClean];
    }
    return hasLogo
      ? [posterClean, backdropClean, posterText, backdropText]
      : [posterClean, posterText, backdropClean, backdropText];
  }
  return hasLogo
    ? [backdropClean, posterClean, backdropText, posterText]
    : [backdropClean, backdropText, posterClean, posterText];
}

/**
 * The one contextual badge the phone hero card carries, or null.
 *
 * The tag has to be TRUE, which means distinguishing two things the old version merged.
 * The red TOP 10 mark is Netflix's own device for their top-ten row; a "Trending Now" or
 * "Popular" rail is an ordered list, not a top ten, and stamping TOP 10 on it is simply
 * false. So a genuine top-ten rail gets `top10`, any other ordered rail gets `rank` and
 * carries THAT RAIL'S NAME ("#3 in Trending Now"), and an unranked rail falls through to
 * what is true of the record itself: unreleased, or released recently.
 *
 * JioHotstar's card says "New Season" here, which we cannot honestly produce: a season's
 * own air date isn't in the rail payload (only the show's first air date and a season
 * COUNT), so a returning show is indistinguishable from an old one. If that badge is
 * wanted, the rail projection has to start sending the latest season's air date.
 */
export const NEW_WINDOW_DAYS = 45;

export function heroBadge(record, {
  ranked = false,
  top10 = false,
  rankLabel = null,
  idx = 0,
  now = Date.now(),
} = {}) {
  if (!record) return null;

  const position = `#${idx + 1}`;

  if (top10) {
    return { kind: 'top10', label: `${position} in ${record.type === 'MOVIE' ? 'Movies' : 'Shows'}` };
  }

  // An ordered rail that isn't a top ten: the position is real, so say where it is real.
  if (ranked) {
    return {
      kind: 'rank',
      label: rankLabel ? `${position} in ${rankLabel}` : `${position} trending`,
    };
  }

  const released = record.releaseDate ? Date.parse(record.releaseDate) : NaN;
  if (!Number.isFinite(released)) return null;

  const days = (released - now) / 86_400_000;
  if (days > 0) return { kind: 'soon', label: 'Coming soon' };
  if (days > -NEW_WINDOW_DAYS) return { kind: 'new', label: 'New' };
  return null;
}

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

// ─── Title-logo tone ───────────────────────────────────────────────────────
// TMDB `logoPath` art arrives in every colour. Gold, red and white logos all
// read fine over a dark scrim and must keep their brand colour; an all-black
// logo is invisible no matter how the scrim is tuned, and is the only case
// worth repainting. So measure the artwork instead of blanket-inverting it.

const logoToneCache = new Map(); // url -> 'dark' | 'light' | null (undecidable)

/**
 * Verdict from a pixel tally. Split out from the canvas work so the rule that
 * actually matters is testable.
 *
 * A RATIO, not a mean: black glyphs very often carry a thin white outline or
 * halo, and averaging lets those bright edge pixels drag the mean above any
 * sane threshold — which is how an obviously-black logo slipped through the
 * first implementation. Counting pixels ignores the outline.
 */
export function classifyLogoTone(darkCount, opaqueCount) {
  if (!opaqueCount) return null; // fully transparent, or nothing decodable
  return darkCount / opaqueCount >= DARK_PIXEL_RATIO ? 'dark' : 'light';
}

/**
 * One eased step of an r,g,b tween. `t` is linear 0→1; easing is applied here
 * so callers just feed elapsed/duration.
 */
export function interpolateRgb(from, to, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const eased = 1 - (1 - clamped) ** 3; // easeOutCubic
  return [0, 1, 2].map((i) => Math.round(from[i] + (to[i] - from[i]) * eased));
}

// A pixel this dark counts as black-ish.
const DARK_PIXEL_LUMA = 70;
// ...and the logo is "a black logo" when this much of its ink is black-ish.
// A RATIO, not a mean: black glyphs very often carry a thin white outline or
// halo, and averaging lets those bright edge pixels drag the mean above any
// sane threshold — which is exactly how an obviously-black logo slipped
// through. Counting pixels ignores the outline and looks at the body.
const DARK_PIXEL_RATIO = 0.6;

export function analyzeLogoTone(url) {
  if (!url) return Promise.resolve(null);
  if (logoToneCache.has(url)) return Promise.resolve(logoToneCache.get(url));

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const SIZE = 48;
        const scale = SIZE / Math.max(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let dark = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Logo art is mostly transparent padding — only the glyphs count.
          if (data[i + 3] < 128) continue;
          const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          if (luma < DARK_PIXEL_LUMA) dark++;
          n++;
        }

        const tone = classifyLogoTone(dark, n);
        logoToneCache.set(url, tone);
        resolve(tone);
      } catch {
        // Tainted canvas (no CORS header) — leave the artwork untouched.
        logoToneCache.set(url, null);
        resolve(null);
      }
    };

    img.onerror = () => {
      logoToneCache.set(url, null);
      resolve(null);
    };

    img.src = url;
  });
}

/** 'dark' only for near-black artwork; 'light' or null means leave it alone. */
export function useLogoTone(url) {
  const [tone, setTone] = useState(() => logoToneCache.get(url) ?? null);

  useEffect(() => {
    if (!url) { setTone(null); return undefined; }

    // Synchronous on a revisit, so a cached logo never flashes un-corrected.
    if (logoToneCache.has(url)) { setTone(logoToneCache.get(url)); return undefined; }

    let alive = true;
    setTone(null);
    analyzeLogoTone(url).then((t) => { if (alive) setTone(t); });
    return () => { alive = false; };
  }, [url]);

  return tone;
}

export function darken([r, g, b], factor = 0.45) {
  return `${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(
    b * factor
  )}`;
}

// ─── Animated colour variable ──────────────────────────────────────────────
// CSS cannot interpolate a `background` that holds gradients — a
// `transition: background 900ms` on a gradient stack is silently a no-op, so
// every hero colour change lands as a hard cut. (That transition was sitting
// in both the mobile scrim and CinemaPage's page wash, doing nothing.)
//
// Instead, drive ONE custom property holding an "r,g,b" triple and let the
// gradients read it via `rgba(var(--x), 0.5)`. The gradients then never change
// — only the variable does — so we can tween it ourselves on rAF. This works
// everywhere (no `@property` or relative-colour support needed), never
// re-renders React, and avoids the alpha-compounding artefact you get from
// crossfading two translucent gradient layers against each other.

const parseRgbTriple = (value) => {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((v) => Number(v.trim()));
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : null;
};

/**
 * Returns a ref to attach to the element that should own the variable.
 * Descendants inherit it, so one ref on the container covers every layer.
 */
export function useAnimatedRgbVar(target, { duration = 700, varName = '--hero-wash', immediate = false } = {}) {
  const nodeRef = useRef(null);
  const currentRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const to = parseRgbTriple(target);
    const node = nodeRef.current;
    if (!to || !node) return undefined;

    const write = (rgb) => {
      currentRef.current = rgb;
      node.style.setProperty(varName, rgb.join(','));
    };

    const from = currentRef.current;

    // First paint, reduced motion, or no actual change — just set it.
    if (!from || immediate || duration <= 0) { write(to); return undefined; }
    if (from[0] === to[0] && from[1] === to[1] && from[2] === to[2]) return undefined;

    const startedAt = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      write(interpolateRgb(from, to, t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, varName, immediate]);

  return nodeRef;
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