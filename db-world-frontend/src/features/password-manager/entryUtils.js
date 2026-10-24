/**
 * Vault entry helpers: turning what a person types into a site, and spotting duplicates.
 * Pure functions (no React, no network) so they are cheap to test.
 */

export const ENTRY_TYPES = ['LOGIN', 'SERVER', 'NOTE'];

/** How a custom field is shown. The first is the default, and what a field saved before types existed is. */
export const FIELD_TYPES = [
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'TEXT', label: 'Text' },
  { value: 'URL', label: 'URL' },
  { value: 'MULTILINE', label: 'Multi-line' },
];

/** Masked until shown. A field with no type is an old one, and old fields were all masked. */
export const isSecretField = (f) => f.fieldType == null || f.fieldType === 'HIDDEN' || f.fieldType === 'MULTILINE';

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** "example.com" is as good as "https://example.com": assume https when no scheme was typed. */
export const withScheme = (value) => {
  const s = (value ?? '').trim();
  return s && !SCHEME.test(s) ? `https://${s}` : s;
};

export const isValidUrl = (value) => {
  try { return !!new URL(withScheme(value)).hostname.includes('.'); } catch { return false; }
};

/** Lower-case host without "www.", or '' when the text is not a usable address. */
export const siteKey = (value) => {
  try {
    const host = new URL(withScheme(value)).hostname.replace(/^www\./i, '').toLowerCase();
    return host.includes('.') ? host : '';
  } catch { return ''; }
};

/**
 * Does this text read as an address rather than a name? "netflix.com", "https://x.io/login",
 * "ssh.db-world.in:22" do; "Net flix", "my bank" and "Home server" do not.
 */
export const looksLikeSite = (text) => {
  const t = (text ?? '').trim();
  if (!t || /\s/.test(t)) return false;
  return SCHEME.test(t) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t);
};

/** Letters and digits only, lower-case: "Net flix" and "netflix" compare equal. */
const squash = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pick a site for a typed name from brand-search results.
 * `auto`   : the name and the brand agree ("Net flix" -> netflix.com), safe to fill in by itself.
 * `suggest`: the best guess, offered but never applied without a click ("bank" -> some bank).
 */
export const pickSite = (name, results) => {
  const typed = squash(name);
  const list = (results ?? []).filter((b) => b?.domain);
  if (typed.length < 2 || list.length === 0) return { auto: null, suggest: null };
  const agrees = (b) => squash(b.name) === typed || squash(b.domain.split('.')[0]) === typed;
  const match = list.find(agrees);
  return match ? { auto: match, suggest: null } : { auto: null, suggest: list[0] };
};

const same = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * The saved entry that would clash with this one, or null. Same rule as the server: same
 * username and same name (the name defaults to the site), among entries on the same site, or
 * among site-less entries when there is none.
 */
export const findDuplicate = (vault, { url, name, username, ignoreId }) => {
  const site = siteKey(url);
  const wanted = (name ?? '').trim() || site;
  if (!wanted) return null;
  for (const pm of vault ?? []) {
    for (const cred of pm.credentials ?? []) {
      if (ignoreId && cred.id === ignoreId) continue;
      const credSite = siteKey(cred.url) || (looksLikeSite(pm.host) ? siteKey(pm.host) : '');
      const sameGroup = site ? credSite === site : !credSite;
      const credName = (cred.name ?? '').trim() || credSite;
      if (sameGroup && same(cred.username, username) && same(credName, wanted)) return { pm, cred };
    }
  }
  return null;
};
