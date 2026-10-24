import { useState, useEffect, useRef, useCallback } from 'react';
import { searchBrands } from '@shared/services/ApiServices';
import { siteKey, looksLikeSite, pickSite } from './entryUtils';

/**
 * Finds a website for what the person typed as a name: "Netflix" or "net flix" -> netflix.com.
 *
 * It never overwrites a website the person typed (or one already saved): `touched` locks it. A
 * confident match is applied by itself (`autoSite`); a loose one is only offered (`suggestion`).
 *
 * @param name         the current name
 * @param enabled      false for entry types that have no site to find (notes)
 * @param setUrl       writes the site into the form ('' clears it)
 * @param startTouched true when a site is already there and must be left alone
 */
export default function useSiteFromName({ name, enabled = true, setUrl, startTouched = false }) {
  const [touched, setTouched]       = useState(startTouched);
  const [autoSite, setAutoSite]     = useState(null); // { domain, name } applied by us
  const [suggestion, setSuggestion] = useState(null);
  const [detecting, setDetecting]   = useState(false);
  const seq = useRef(0);

  const applyAuto = useCallback((site) => {
    setAutoSite(site);
    setUrl(site ? `https://${site.domain}` : '');
  }, [setUrl]);

  useEffect(() => {
    if (touched || !enabled) return undefined;
    const typed = (name ?? '').trim().replace(/\s+/g, ' ');
    const mine = ++seq.current;

    if (typed.length < 2) { applyAuto(null); setSuggestion(null); setDetecting(false); return undefined; }

    if (looksLikeSite(typed)) { // already an address: no lookup needed
      setSuggestion(null); setDetecting(false);
      applyAuto({ domain: siteKey(typed), name: typed });
      return undefined;
    }

    setDetecting(true);
    const timer = setTimeout(async () => {
      const res = await searchBrands(typed);
      if (mine !== seq.current) return; // a newer keystroke owns the answer now
      const { auto, suggest } = pickSite(typed, res?.data);
      setDetecting(false);
      setSuggestion(suggest);
      applyAuto(auto ? { domain: auto.domain, name: auto.name || auto.domain } : null);
    }, 420);
    return () => clearTimeout(timer);
  }, [name, enabled, touched, applyAuto]);

  /** The person edited the website field themselves: stop guessing. */
  const markTyped = useCallback(() => { setTouched(true); setAutoSite(null); setSuggestion(null); }, []);
  /** "Not this one": clear the found site and stop guessing. */
  const dropSite = useCallback(() => { setTouched(true); applyAuto(null); setSuggestion(null); }, [applyAuto]);
  const takeSuggestion = useCallback(() => {
    if (!suggestion) return;
    applyAuto({ domain: suggestion.domain, name: suggestion.name || suggestion.domain });
    setSuggestion(null);
  }, [suggestion, applyAuto]);
  /** Back to a blank form. */
  const reset = useCallback(() => { setTouched(false); setAutoSite(null); setSuggestion(null); }, []);

  return { autoSite, suggestion, detecting, markTyped, dropSite, takeSuggestion, reset };
}
