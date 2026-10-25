import { useCallback, useEffect, useRef, useState } from 'react';
import CommonServices from '@shared/services/CommonServices';
import { readSecret } from './useVault';

/** How long a revealed value is kept before it is dropped and has to be fetched again. */
export const SECRET_HOLD_MS = 30 * 1000;

/**
 * Copies a secret: the value held, or else the one reveal() fetches. Called straight from the tap
 * with nothing awaited first, and handed the fetch as a promise, so Safari still counts the clipboard
 * write as part of the tap (see CommonServices.handleCopy). The clipboard is emptied 30 s later.
 */
export const copySecret = (held, reveal) =>
  CommonServices.handleCopy(held != null ? String(held) : reveal().then(String), { sensitive: true });

/**
 * One secret of a vault entry, fetched only when asked for: the list never carries it.
 * field: 'password' | 'pin' | 'notes' | 'custom:<fieldId>' | 'history:<historyId>'.
 *
 * reveal() fetches it (from the server, or the unlocked offline copy) and keeps it in this
 * component's state for 30 seconds, then drops it. copy() puts it on the clipboard (emptied again 30 s
 * later), fetching first if needed, and rejects when the copy fails. value is what is held right now, or null.
 */
export default function useSecret(credentialId, field) {
  const [value, setValue] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setValue(null);
  }, []);

  // Another entry or field: what was held belongs to the old one.
  useEffect(() => hide, [credentialId, field, hide]);

  const reveal = useCallback(async () => {
    if (value != null) return value;
    if (!credentialId || !field) throw new Error('Nothing to reveal');
    const v = await readSecret(credentialId, field);
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setValue(null), SECRET_HOLD_MS);
    return v;
  }, [credentialId, field, value]);

  const copy = useCallback(async () => {
    const res = await copySecret(value, reveal);
    if (!res?.success) throw new Error(res?.message || 'Copy failed');
  }, [reveal, value]);

  return { value, reveal, copy, hide };
}
