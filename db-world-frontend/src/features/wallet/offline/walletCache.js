/**
 * Offline wallet cache (installed Android app only).
 *
 * The wallet is the one feature whose whole point is being reachable when nothing else is:
 * a licence number at a checkpoint, a policy number at a hospital desk, on a phone with no
 * signal. It is also the worst thing to keep lying around, so this reuses the vault's
 * scheme exactly — AES-GCM over the data, the AES key RSA-wrapped by a hardware Keystore
 * key, and the unwrap gated on biometric or device credential.
 *
 * <h3>Why one key for the whole snapshot, not one per document</h3>
 *
 * Wrapping uses the Keystore PUBLIC key and never prompts; unwrapping uses the private key
 * and always does. Per-document keys would therefore mean a fingerprint per document opened.
 * One key for the snapshot means exactly one prompt, after which the metadata and every
 * cached file are readable — which is the difference between usable and theatre.
 *
 * The cost is that a re-cache has to rewrite everything under a fresh key, since the old
 * raw key cannot be recovered without prompting. So a re-cache only happens when the wallet
 * has actually CHANGED (see `signatureOf`), which for a document wallet is rare.
 *
 * <h3>Its own database</h3>
 *
 * Deliberately NOT a second store inside the vault's `dbworld` database. Two modules opening
 * one database at different versions is a VersionError waiting to happen, and the failure
 * would land on the vault — code that already works. They share the Keystore keypair, which
 * is what `vcReset()` on logout drops for both.
 */
import { vaultCryptoAvailable, vcWrapKey, vcUnwrapKey } from '@platform/android/vaultCrypto';

const DB_NAME = 'dbworld-wallet';
const STORE = 'walletCache';

const indexKey = (userId) => `${userId}:index`;
const fileKey = (userId, docId) => `${userId}:file:${docId}`;

export const offlineWalletSupported = () =>
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

// ── tiny IndexedDB wrapper ───────────────────────────────────────────────────
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
const idbKeys = () => idbRun('readonly', (s) => s.getAllKeys());
const idbDelete = (key) => idbRun('readwrite', (s) => s.delete(key));
const idbClear = () => idbRun('readwrite', (s) => s.clear());

/**
 * The raw snapshot key for the session, once we have it.
 *
 * Set when a snapshot is written (we just generated it) and when one is read (we just
 * unwrapped it). Memory only — it is never persisted unwrapped, and a cold start has to
 * prompt again. This is what lets a document open after the list has already been
 * unlocked, instead of asking for the same finger twice in a row.
 */
let sessionKey = null;   // { userId, key: CryptoKey }

const rememberKey = (userId, key) => { sessionKey = { userId: String(userId), key }; };
const recallKey = (userId) => (sessionKey?.userId === String(userId) ? sessionKey.key : null);
export const forgetWalletSessionKey = () => { sessionKey = null; };

/** What a re-cache is keyed on: any metadata change at all rewrites the snapshot. */
const signatureOf = (documents) => {
  try { return JSON.stringify(documents ?? []); } catch { return String(Date.now()); }
};

async function encryptBuffer(aesKey, buffer) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, buffer);
  return { iv: abToB64(iv.buffer), ct };
}

async function decryptBuffer(aesKey, rec) {
  return globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToAb(rec.iv)) }, aesKey, rec.ct,
  );
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Write-through: encrypt and persist the wallet, documents and files alike.
 *
 * Best-effort and silent, exactly like the vault's — a device with no lock screen, a
 * download that fails, any error at all just means "no fresh offline copy this time" and
 * leaves whatever was there before intact. Never prompts: wrapping is a public-key
 * operation. Fire and forget.
 *
 * Skips entirely when the metadata is byte-identical to the stored snapshot, which is the
 * normal case — re-keying would otherwise re-download every file on every wallet open.
 *
 * @param fetchBlob (id) => Promise<Blob>  how to get a document's bytes
 */
export async function cacheWallet(userId, documents, fetchBlob) {
  if (!offlineWalletSupported() || !userId || !Array.isArray(documents)) return;
  try {
    const signature = signatureOf(documents);
    const existing = await idbGet(indexKey(userId)).catch(() => null);
    if (existing?.signature === signature) return;   // nothing changed

    const { subtle } = globalThis.crypto;
    const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawKey = await subtle.exportKey('raw', aesKey);
    const wrapped = await vcWrapKey(abToB64(rawKey));   // Keystore public-key wrap, no prompt

    // Files first. A half-written snapshot whose index promises documents it cannot open
    // is worse than the previous one, so the index — the thing readers start from — is
    // only swapped in once the bytes are actually down.
    const stored = [];
    for (const doc of documents) {
      if (!doc?.id) continue;
      try {
        // Sequential on purpose: a wallet is a handful of documents and firing every
        // download at once on the connection that just came back helps nobody.
        const blob = await fetchBlob(doc.id);
        if (!blob) continue;
        const buf = await blob.arrayBuffer();
        const enc = await encryptBuffer(aesKey, buf);
        await idbPut(fileKey(userId, doc.id), {
          ...enc,
          contentType: blob.type || 'application/octet-stream',
          fileName: doc.fileName ?? doc.label ?? `document-${doc.id}`,
        });
        stored.push(String(doc.id));
      } catch { /* this one document stays online-only */ }
    }

    const metaEnc = await encryptBuffer(aesKey, new TextEncoder().encode(JSON.stringify(documents)));
    await idbPut(indexKey(userId), {
      userId: String(userId),
      wrapped,
      iv: metaEnc.iv,
      ct: metaEnc.ct,
      signature,
      files: stored,
      syncedAt: Date.now(),
    });

    // Files written under the PREVIOUS key can no longer be opened by anything, since the
    // raw key they used is unrecoverable. Leaving them would be dead bytes accumulating on
    // the device forever.
    const keep = new Set(stored.map((id) => fileKey(userId, id)));
    keep.add(indexKey(userId));
    const prefix = `${userId}:`;
    const all = await idbKeys().catch(() => []);
    await Promise.all(
      all.filter((k) => typeof k === 'string' && k.startsWith(prefix) && !keep.has(k))
        .map((k) => idbDelete(k).catch(() => {})),
    );

    rememberKey(userId, aesKey);
  } catch { /* best-effort; leave any previous snapshot intact */ }
}

/** Is there a local snapshot for this user? */
export async function hasCachedWallet(userId) {
  if (!offlineWalletSupported() || !userId) return false;
  try { return !!(await idbGet(indexKey(userId))); } catch { return false; }
}

/**
 * Decrypt and return the offline document list. Prompts once, unless this session has
 * already unlocked the snapshot.
 *
 * Mirrors readOfflineVault's contract so both features report failure the same way:
 *   'ok'          — decrypted; documents + syncedAt present
 *   'locked'      — the unlock prompt was cancelled
 *   'invalidated' — device security changed; the snapshot was wiped, sync online
 *   'none'        — no snapshot, or not supported here
 *   'error'       — decrypt failed
 */
export async function readOfflineWallet(userId) {
  if (!offlineWalletSupported() || !userId) return { status: 'none' };
  let rec;
  try { rec = await idbGet(indexKey(userId)); } catch { return { status: 'none' }; }
  if (!rec) return { status: 'none' };
  try {
    let aesKey = recallKey(userId);
    if (!aesKey) {
      const rawKeyB64 = await vcUnwrapKey(rec.wrapped, {
        title: 'Unlock your wallet',
        subtitle: 'Verify it’s you to view your documents offline',
      });
      aesKey = await globalThis.crypto.subtle.importKey(
        'raw', b64ToAb(rawKeyB64), { name: 'AES-GCM' }, false, ['decrypt'],
      );
      rememberKey(userId, aesKey);
    }
    const plaintext = await decryptBuffer(aesKey, rec);
    const documents = JSON.parse(new TextDecoder().decode(plaintext));
    return { status: 'ok', documents, syncedAt: rec.syncedAt };
  } catch (e) {
    if (e?.code === 'KEY_INVALIDATED') { await clearOfflineWallet(userId); return { status: 'invalidated' }; }
    if (e?.code === 'CANCELED') return { status: 'locked' };
    return { status: 'error' };
  }
}

/**
 * One document's bytes, back as a Blob.
 *
 * Normally silent: the list has already been read this session, so the key is in memory
 * and opening a document does not ask for the same finger a second time. Falls back to
 * reading the index — which does prompt — if it is called cold.
 */
export async function readOfflineDocument(userId, docId) {
  if (!offlineWalletSupported() || !userId || !docId) return { status: 'none' };
  let rec;
  try { rec = await idbGet(fileKey(userId, docId)); } catch { return { status: 'none' }; }
  if (!rec) return { status: 'none' };

  let aesKey = recallKey(userId);
  if (!aesKey) {
    const opened = await readOfflineWallet(userId);
    if (opened.status !== 'ok') return { status: opened.status };
    aesKey = recallKey(userId);
    if (!aesKey) return { status: 'error' };
  }
  try {
    const buf = await decryptBuffer(aesKey, rec);
    return {
      status: 'ok',
      blob: new Blob([buf], { type: rec.contentType }),
      contentType: rec.contentType,
      fileName: rec.fileName,
    };
  } catch {
    return { status: 'error' };
  }
}

/** Remove one user's snapshot: the index and every file under it. */
export async function clearOfflineWallet(userId) {
  if (!userId) return;
  forgetWalletSessionKey();
  try {
    const prefix = `${userId}:`;
    const all = await idbKeys();
    await Promise.all(
      all.filter((k) => typeof k === 'string' && k.startsWith(prefix))
        .map((k) => idbDelete(k).catch(() => {})),
    );
  } catch { /* ignore */ }
}

/**
 * Wipe every snapshot (call on logout).
 *
 * The Keystore keypair is NOT dropped here — `clearAllOfflineVault` already does that, and
 * both features share it. Dropping it twice is harmless but doing it from one place keeps
 * the ownership obvious.
 */
export async function clearAllOfflineWallet() {
  forgetWalletSessionKey();
  try { await idbClear(); } catch { /* ignore */ }
}
