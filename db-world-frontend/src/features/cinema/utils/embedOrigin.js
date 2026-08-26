/**
 * Exact origin of an embedded player URL, for use as a `postMessage` targetOrigin.
 *
 * Trailer embeds come from the backend (`record.previewVideoUrl`) and are not
 * guaranteed to be on `www.youtube.com` — `youtube-nocookie.com` and other hosts
 * are possible — so the origin has to be derived from the URL actually loaded in
 * the iframe rather than hard-coded. Passing a targetOrigin that doesn't match the
 * frame's origin makes the browser drop the message silently, which would look
 * like "mute just stopped working" with nothing in the console.
 *
 * Returns `null` when there is no usable origin, so callers can skip the send
 * rather than fall back to the wildcard `'*'` (which would deliver the message to
 * whatever document happens to occupy the frame).
 *
 * @param {string|null|undefined} url absolute embed URL
 * @returns {string|null} e.g. "https://www.youtube.com", or null
 */
export const embedOrigin = (url) => {
  if (typeof url !== 'string' || url === '') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null; // relative or malformed — no origin to speak of
  }

  // Only http(s) frames can receive a postMessage addressed to a real origin;
  // anything else (data:, blob:, about:) serialises to the opaque "null" origin.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  return parsed.origin;
};

export default embedOrigin;
