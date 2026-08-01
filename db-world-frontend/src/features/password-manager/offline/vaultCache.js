/**
 * Offline vault cache (installed Android app only).
 *
 * The vault is a thin client over a server-side-encrypted store, so it normally
 * needs the network. To keep passwords reachable when the server is unreachable,
 * we keep a *local encrypted snapshot*:
 *
 *   cache (online):  AES-GCM encrypt the vault JSON with a random key (WebCrypto),
 *                    then RSA-wrap that key with a hardware Keystore key
 *                    (native VaultCrypto). Wrapping uses the public key → no prompt.
 *   read  (offline): biometric / device-credential unlock → unwrap the AES key →
 *                    AES-GCM decrypt. One prompt, only when actually offline.
 *
 * The Keystore key is invalidated by the OS if the device lock screen is removed
 * or reset, which surfaces as KEY_INVALIDATED → we wipe the snapshot and fall
 * back to online sync. Nothing here runs (or stores anything) off Android.
 */
import { vaultCryptoAvailable, vcWrapKey, vcUnwrapKey, vcReset } from '@platform/android/vaultCrypto';

const DB_NAME = 'dbworld';
const STORE = 'vaultCache';

export const offlineVaultSupported = () =>
  vaultCryptoAvailable() && typeof indexedDB !== 'undefined' && !!globalThis.crypto?.subtle;

// ── base64 <-> ArrayBuffer (standard base64, matches Android Base64.NO_WRAP) ──
function abToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToAb(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ── tiny IndexedDB wrapper (userId-keyed records) ────────────────────────────
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbRun(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => { resolve(req ? req.result : undefined); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
    tx.onabort = () => { reject(tx.error); db.close(); };
  }));
}
const idbGet = (key) => idbRun('readonly', (s) => s.get(key));
const idbPut = (key, val) => idbRun('readwrite', (s) => s.put(val, key));
const idbDelete = (key) => idbRun('readwrite', (s) => s.delete(key));
const idbClear = () => idbRun('readwrite', (s) => s.clear());

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Write-through: encrypt + persist the freshly-fetched vault. Best-effort and
 * silent — a device with no lock screen (NO_LOCK) or any failure simply means
 * "no offline copy this time". Never prompts. Fire-and-forget from the caller.
 */
export async function cacheVault(userId, vault) {
  if (!offlineVaultSupported() || !userId) return;
  try {
    const { subtle } = globalThis.crypto;
    const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(vault));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    const rawKey = await subtle.exportKey('raw', aesKey);
    const wrapped = await vcWrapKey(abToB64(rawKey)); // Keystore public-key wrap (no prompt)
    await idbPut(String(userId), {
      userId: String(userId),
      wrapped,
      iv: abToB64(iv.buffer),
      ct: abToB64(ct),
      syncedAt: Date.now(),
    });
  } catch { /* best-effort; leave any previous snapshot intact */ }
}

/** Is there a local snapshot for this user? (Used to decide whether to offer offline.) */
export async function hasCachedVault(userId) {
  if (!offlineVaultSupported() || !userId) return false;
  try { return !!(await idbGet(String(userId))); } catch { return false; }
}

/**
 * Decrypt and return the offline snapshot. Prompts for biometric / device-credential.
 * Result: { status, vault?, syncedAt? } where status is one of
 *   'ok'          — decrypted, vault + syncedAt present
 *   'locked'      — user canceled the unlock prompt
 *   'invalidated' — device security changed; snapshot was wiped, sync online
 *   'none'        — no snapshot / not supported
 *   'error'       — decrypt failed
 */
export async function readOfflineVault(userId) {
  if (!offlineVaultSupported() || !userId) return { status: 'none' };
  let rec;
  try { rec = await idbGet(String(userId)); } catch { return { status: 'none' }; }
  if (!rec) return { status: 'none' };
  try {
    const rawKeyB64 = await vcUnwrapKey(rec.wrapped, {
      title: 'Unlock your vault',
      subtitle: 'Verify it’s you to view your saved passwords offline',
    });
    const aesKey = await globalThis.crypto.subtle.importKey('raw', b64ToAb(rawKeyB64), { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(b64ToAb(rec.iv)) }, aesKey, b64ToAb(rec.ct),
    );
    const vault = JSON.parse(new TextDecoder().decode(plaintext));
    return { status: 'ok', vault, syncedAt: rec.syncedAt };
  } catch (e) {
    if (e?.code === 'KEY_INVALIDATED') { await clearOfflineVault(userId); return { status: 'invalidated' }; }
    if (e?.code === 'CANCELED') return { status: 'locked' };
    return { status: 'error' };
  }
}

/** Remove one user's snapshot. */
export async function clearOfflineVault(userId) {
  if (!userId) return;
  try { await idbDelete(String(userId)); } catch { /* ignore */ }
}

/** Wipe every snapshot and drop the device keypair (call on logout). */
export async function clearAllOfflineVault() {
  try { await idbClear(); } catch { /* ignore */ }
  await vcReset();
}
