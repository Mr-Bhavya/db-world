import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCredential } from '@shared/services/ApiServices';
import { useAuth } from '@features/auth/context/Authentication';
import { cacheVault, readOfflineVault } from './offline/vaultCache';

/**
 * The vault, as every screen loads it: from the server, or from the encrypted offline copy when the
 * server cannot be reached.
 *
 * One query function for the one cache key. The hub, the list and the add form used to register
 * three different functions on ['pm-vault'] and only the list had the offline fallback, so in flight
 * mode the hub showed zeros, and a list opened while the hub's request was still failing waited on
 * that request instead of opening the offline copy.
 */
export const VAULT_QUERY_KEY = ['pm-vault'];
// The Trash is its own query (VaultTrash.js); anything that moves entries in or out refreshes it too.
export const TRASH_QUERY_KEY = ['pm-trash'];

export const vaultUserId = (auth) =>
  auth?.user?.id ?? auth?.user?.userId ?? auth?.user?.username ?? auth?.user?.email ?? null;

// ── Offline state, shared by every screen showing the vault ─────────────────────
// { syncedAt } | { locked: true } | { invalidated: true } | null
let offlineState = null;
const listeners = new Set();
const setVaultOffline = (next) => { offlineState = next; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getVaultOffline = () => offlineState;

/** What the offline copy is doing right now, for banners. */
export const useVaultOffline = () => useSyncExternalStore(subscribe, getVaultOffline, getVaultOffline);

export async function fetchVault(userId) {
  try {
    const data = (await getCredential()).data ?? [];
    setVaultOffline(null);
    cacheVault(userId, data); // best-effort write-through snapshot (native only, no prompt)
    return data;
  } catch (err) {
    // Server unreachable: open the offline copy (prompts biometric / device lock).
    const res = await readOfflineVault(userId);
    if (res.status === 'ok') { setVaultOffline({ syncedAt: res.syncedAt }); return res.vault; }
    if (res.status === 'locked') setVaultOffline({ locked: true });
    else if (res.status === 'invalidated') setVaultOffline({ invalidated: true });
    else setVaultOffline(null);
    throw err;
  }
}

export default function useVaultQuery() {
  const { auth } = useAuth();
  const userId = vaultUserId(auth);
  return useQuery({
    queryKey: VAULT_QUERY_KEY,
    queryFn: () => fetchVault(userId),
    staleTime: 2 * 60 * 1000,
    retry: false, // the offline fallback prompts for biometrics: never re-run it silently
    // The hub is a public route but /api/pm is protected: firing it signed out would 401.
    enabled: !!auth?.isAuthenticated,
  });
}
