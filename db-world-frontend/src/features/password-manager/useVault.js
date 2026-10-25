import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCredential, getEntrySecrets, getSecret, getSnapshot } from '@shared/services/ApiServices';
import { useAuth } from '@features/auth/context/Authentication';
import { cacheVault, readOfflineVault, offlineVaultSupported } from './offline/vaultCache';
import { summarizeVault } from './passwordUtils';

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
// The unlocked offline copy's secrets, by credential id: { password, pin, notes, custom: { [fieldId]: value } }.
// Kept in memory only, and only while the vault is showing that copy, so a reveal works offline.
let offlineSecrets = null;
const listeners = new Set();
const setVaultOffline = (next) => {
  offlineState = next;
  if (!next?.syncedAt) offlineSecrets = null;
  listeners.forEach((l) => l());
};
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getVaultOffline = () => offlineState;

// Bumped on sign-out. Work started before it (a snapshot or an offline unlock still in flight) checks
// it before it stores anything, so the previous user's vault is not written back after it was wiped.
let sessionEpoch = 0;

/**
 * Sign-out: drops the decrypted offline secrets and the offline state from memory, and makes any
 * snapshot still in flight skip writing the offline copy (which clearAllOfflineVault has just wiped).
 */
export function resetVaultOffline() {
  sessionEpoch += 1;
  offlineSecrets = null;
  setVaultOffline(null);
}

/** What the offline copy is doing right now, for banners. */
export const useVaultOffline = () => useSyncExternalStore(subscribe, getVaultOffline, getVaultOffline);

const secretsOf = (snapshot) => {
  const byId = new Map();
  (snapshot ?? []).forEach((entry) => entry.credentials?.forEach((c) => {
    const custom = {};
    (c.customFields ?? []).forEach((f) => { if (f.id) custom[f.id] = f.fieldValue ?? ''; });
    byId.set(c.id, { password: c.password ?? '', pin: c.pin ?? '', notes: c.notes ?? '', custom });
  }));
  return byId;
};

/**
 * The list has no secrets: the offline copy needs them, so on the installed Android app it is
 * refreshed from GET /api/pm/snapshot. Fire-and-forget like before: a failure (a 429, no network
 * half-way) leaves the previous copy as it is and never holds up the list.
 */
const refreshOfflineCopy = (userId, epoch) => {
  if (!offlineVaultSupported()) return;
  const isCurrent = () => epoch === sessionEpoch;
  getSnapshot()
    // Signed out meanwhile: caching it would re-create the keypair and re-save the vault just wiped.
    // cacheVault asks again around its own write, since a sign-out can also land inside it.
    .then((res) => (isCurrent() ? cacheVault(userId, res?.data ?? [], isCurrent) : undefined))
    .catch(() => { /* best-effort; the next fetch tries again */ });
};

export async function fetchVault(userId) {
  const epoch = sessionEpoch;
  try {
    const data = (await getCredential()).data ?? [];
    setVaultOffline(null);
    refreshOfflineCopy(userId, epoch);
    return data;
  } catch (err) {
    // Server unreachable: open the offline copy (prompts biometric / device lock). It holds the full
    // entries (a copy from before the list lost its secrets has the same shape): the screens get the
    // list's summaries, and the secrets stay here for readSecret.
    const res = await readOfflineVault(userId);
    if (epoch !== sessionEpoch) throw err;   // signed out while it was unlocking: keep nothing
    if (res.status === 'ok') {
      setVaultOffline({ syncedAt: res.syncedAt });
      offlineSecrets = secretsOf(res.vault);
      return summarizeVault(res.vault);
    }
    if (res.status === 'locked') setVaultOffline({ locked: true });
    else if (res.status === 'invalidated') setVaultOffline({ invalidated: true });
    else setVaultOffline(null);
    throw err;
  }
}

/**
 * One secret of an entry ('password' | 'pin' | 'notes' | 'custom:<fieldId>' | 'history:<historyId>'):
 * from the server, or from the unlocked offline copy while the vault is showing it.
 */
export async function readSecret(credentialId, field) {
  if (getVaultOffline()?.syncedAt && offlineSecrets) {
    const entry = offlineSecrets.get(credentialId);
    const fieldId = field.startsWith('custom:') ? field.slice('custom:'.length) : null;
    const value = !entry ? undefined
      : fieldId ? (Object.hasOwn(entry.custom, fieldId) ? entry.custom[fieldId] : undefined)
        : field === 'password' || field === 'pin' || field === 'notes' ? entry[field]
          : undefined;   // earlier passwords are not in the offline copy
    if (value === undefined) throw new Error('Not available offline');
    return value;
  }
  return (await getSecret(credentialId, field))?.data?.value ?? '';
}

/**
 * Every secret of one entry ({ password, pin, notes, customFields: { [fieldId]: value } }), in one
 * read: from the server, or from the unlocked offline copy while the vault is showing it.
 */
export async function readAllSecrets(credentialId) {
  if (getVaultOffline()?.syncedAt && offlineSecrets) {
    const entry = offlineSecrets.get(credentialId);
    if (!entry) throw new Error('Not available offline');
    return { password: entry.password, pin: entry.pin, notes: entry.notes, customFields: { ...entry.custom } };
  }
  return (await getEntrySecrets(credentialId))?.data ?? {};
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
