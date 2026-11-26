/**
 * logo.dev — shared brand-logo helpers
 * ------------------------------------
 * Generalised out of the IPO feature so every surface (IPO cards, the password
 * vault, anywhere else) resolves brand logos the same way.
 *
 * LOGODEV_TOKEN is a PUBLISHABLE key (like a Stripe pk_…) — safe to ship in the
 * client bundle. The logo.dev *search* API needs a SECRET key and must be
 * proxied through the backend; it is intentionally not here.
 */
export const LOGODEV_TOKEN = 'pk_HJMOHJjgQpOOileyHqQMug';

/** Build a logo.dev image URL for a bare domain (e.g. "swiggy.com"). */
export const logoDevUrl = (domain, { size = 128, format = 'png' } = {}) =>
  `https://img.logo.dev/${domain}?token=${LOGODEV_TOKEN}&size=${size}&format=${format}`;

const faviconUrl = (domain, provider) => {
  if (!domain) return '';
  if (provider === 'google') {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }
  if (provider === 'duckduckgo') {
    return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;
  }
  return logoDevUrl(domain);
};

/** Normalise a full URL or bare host down to a lower-case registrable domain. */
export const domainFromUrl = (value) => {
  if (!value) return '';
  let v = String(value).trim();
  if (!v) return '';
  try {
    if (!/^[a-z]+:\/\//i.test(v)) v = `https://${v}`;
    return new URL(v).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return String(value).trim().replace(/^www\./i, '').toLowerCase();
  }
};

/**
 * clearbit's logo-by-domain endpoint was shut down and now fails DNS. Some seeded
 * rows still carry such a `logoUrl`; treat any clearbit.com URL as absent so we
 * fall through to logo.dev instead of mounting an `<img>` that can only fail.
 */
const isClearbitUrl = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'clearbit.com' || host.endsWith('.clearbit.com');
  } catch {
    return false;
  }
};

/**
 * Resolve the `<img src>` for a brand logo. Order:
 *   1. `logoUrl` — a ready-to-use URL, unless blank or a dead clearbit URL.
 *   2. `logoDomain` — a bare domain, built into a logo.dev URL.
 *   3. neither usable → `null` (caller renders the initials fallback).
 */
/** Ordered, keyless-first candidates so a failed provider degrades to the next source. */
export const resolveLogoCandidates = (logoUrl, logoDomain) => {
  const trimmedUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  const usableUrl = trimmedUrl && !isClearbitUrl(trimmedUrl) ? trimmedUrl : '';
  const trimmedDomain = typeof logoDomain === 'string' ? logoDomain.trim() : '';
  return [
    usableUrl,
    faviconUrl(trimmedDomain, 'google'),
    faviconUrl(trimmedDomain, 'duckduckgo'),
    faviconUrl(trimmedDomain, 'logodev'),
  ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
};

export const resolveLogoSrc = (logoUrl, logoDomain) =>
  resolveLogoCandidates(logoUrl, logoDomain)[0] ?? null;
