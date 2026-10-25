import { useCallback, useEffect, useMemo, useState } from 'react';
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
 * Holds one revealed secret for holdMs, then drops it. read() fetches it; onChange(value | null)
 * hears every change. dispose() drops it for good: a read still in flight then holds nothing, so a
 * value fetched for an entry the screen has already left never shows up on the next one.
 */
export function createSecretHold(read, onChange, holdMs = SECRET_HOLD_MS) {
  let value = null;
  let timer = null;
  let disposed = false;
  const set = (v) => { value = v; onChange(v); };
  const hide = () => { clearTimeout(timer); if (value != null) set(null); };
  return {
    get value() { return value; },
    async reveal() {
      if (value != null) return value;
      const v = await read();
      if (disposed) return v;
      set(v);
      clearTimeout(timer);
      timer = setTimeout(() => set(null), holdMs);
      return v;
    },
    hide,
    dispose() { disposed = true; hide(); },
  };
}

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

  // Another entry or field: a new hold, and the old one (with anything it still had coming) is dropped.
  const hold = useMemo(() => createSecretHold(async () => {
    if (!credentialId || !field) throw new Error('Nothing to reveal');
    return readSecret(credentialId, field);
  }, setValue), [credentialId, field]);
  useEffect(() => () => hold.dispose(), [hold]);

  const reveal = useCallback(() => hold.reveal(), [hold]);
  const hide = useCallback(() => hold.hide(), [hold]);
  const copy = useCallback(async () => {
    const res = await copySecret(hold.value, hold.reveal);
    if (!res?.success) throw new Error(res?.message || 'Copy failed');
  }, [hold]);

  // What this entry's hold has: never a value the previous entry's hold left in state.
  return { value: hold.value == null ? null : value, reveal, copy, hide };
}
