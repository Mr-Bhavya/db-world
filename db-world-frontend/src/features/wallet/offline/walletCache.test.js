import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The Keystore bridge, faked.
 *
 * Wrapping is a public-key op in reality and unwrapping a private-key one behind a
 * biometric prompt — the asymmetry the whole design turns on. Here wrap is a reversible
 * prefix and unwrap counts its calls, which is what lets these tests assert the property
 * that actually matters to a user: how MANY times they are asked for a fingerprint.
 */
const ks = vi.hoisted(() => ({ unwrapCalls: 0, failWith: null }));

vi.mock('@platform/android/vaultCrypto', () => ({
  vaultCryptoAvailable: () => true,
  vcWrapKey: async (keyB64) => `w:${keyB64}`,
  vcUnwrapKey: async (wrapped) => {
    ks.unwrapCalls += 1;
    if (ks.failWith) {
      const e = new Error('unwrap refused');
      e.code = ks.failWith;
      throw e;
    }
    return String(wrapped).slice(2);
  },
  vcReset: async () => {},
}));

/**
 * Just enough IndexedDB to run the module under test.
 *
 * Hand-rolled rather than pulling in fake-indexeddb: adding a devDependency rewrites
 * package-lock.json, and on Windows that strips other platforms' native binaries and
 * breaks `npm ci` on CI. Sixty lines of Map is the cheaper trade.
 *
 * Requests resolve on a microtask because the real API does too — the module assigns
 * `onsuccess` AFTER the call returns, so anything firing synchronously would never be
 * heard and every test would hang.
 */
function installFakeIndexedDB() {
  const dbs = new Map();
  const defer = (fn) => queueMicrotask(fn);

  const makeTx = (stores, storeName) => {
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
    const map = stores.get(storeName);
    tx.objectStore = () => ({
      get: (k) => ({ result: map.get(k) }),
      put: (v, k) => { map.set(k, v); return { result: undefined }; },
      delete: (k) => { map.delete(k); return { result: undefined }; },
      clear: () => { map.clear(); return { result: undefined }; },
      getAllKeys: () => ({ result: [...map.keys()] }),
    });
    defer(() => tx.oncomplete?.());
    return tx;
  };

  globalThis.indexedDB = {
    open(name) {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null };
      defer(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, new Map());
        const stores = dbs.get(name);
        req.result = {
          objectStoreNames: { contains: (s) => stores.has(s) },
          createObjectStore: (s) => { stores.set(s, new Map()); return {}; },
          transaction: (s) => makeTx(stores, s),
          close: () => {},
        };
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
    _dbs: dbs,
  };
  return dbs;
}

const USER = 42;
const DOCS = [
  { id: 'd1', typeId: 'passport', label: 'Passport', fileName: 'passport.pdf' },
  { id: 'd2', typeId: 'licence', label: 'Driving Licence', fileName: 'dl.jpg' },
];

const bytesFor = (id) => new TextEncoder().encode(`bytes-of-${id}`);
const blobFor = (id) => new Blob([bytesFor(id)], { type: 'application/pdf' });

/** A fetcher that records what it was asked for, so re-download can be asserted. */
function recordingFetcher(failFor = []) {
  const calls = [];
  const fn = async (id) => {
    calls.push(id);
    if (failFor.includes(id)) throw new Error('download failed');
    return blobFor(id);
  };
  fn.calls = calls;
  return fn;
}

let cache;
beforeEach(async () => {
  installFakeIndexedDB();
  ks.unwrapCalls = 0;
  ks.failWith = null;
  vi.resetModules();
  cache = await import('./walletCache');   // fresh module = fresh in-memory session key
});

describe('offlineWalletSupported', () => {
  it('is true only when the Keystore, IndexedDB and WebCrypto are all present', async () => {
    expect(cache.offlineWalletSupported()).toBe(true);
    const saved = globalThis.indexedDB;
    globalThis.indexedDB = undefined;
    expect(cache.offlineWalletSupported()).toBe(false);
    globalThis.indexedDB = saved;
  });
});

describe('cacheWallet / readOfflineWallet', () => {
  it('round-trips the document list through encryption', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();

    const res = await cache.readOfflineWallet(USER);
    expect(res.status).toBe('ok');
    expect(res.documents).toEqual(DOCS);
    expect(typeof res.syncedAt).toBe('number');
  });

  it('stores nothing readable in the clear, fields included', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    const store = globalThis.indexedDB._dbs.get('dbworld-wallet').get('walletCache');

    // Every scalar field on every record, plus the ciphertext bytes themselves.
    // JSON.stringify renders an ArrayBuffer as {}, so serialising alone would have
    // "passed" while the document contents sat there in the open.
    const decoder = new TextDecoder();
    const surface = [...store.values()].flatMap((rec) => Object.entries(rec).map(
      ([k, v]) => (v instanceof ArrayBuffer ? decoder.decode(v) : `${k}=${String(v)}`),
    )).join(' | ');

    // This is what caught `signature` being the document JSON verbatim, sitting
    // unencrypted beside the record it was supposed to be protecting.
    expect(surface).not.toContain('Driving Licence');
    expect(surface).not.toContain('Passport');
    expect(surface).not.toContain('passport');   // the typeId too
    expect(surface).not.toContain('bytes-of-d1');
    expect(surface).not.toContain('bytes-of-d2');
  });

  it('reports no snapshot rather than throwing when there is none', async () => {
    expect(await cache.readOfflineWallet(USER)).toEqual({ status: 'none' });
    expect(await cache.hasCachedWallet(USER)).toBe(false);
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    expect(await cache.hasCachedWallet(USER)).toBe(true);
  });

  it('keeps one user out of another user’s snapshot', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    expect(await cache.hasCachedWallet(99)).toBe(false);
    expect((await cache.readOfflineWallet(99)).status).toBe('none');
  });
});

describe('re-cache is driven by change, not by every load', () => {
  it('skips the whole pass when the metadata is identical', async () => {
    const first = recordingFetcher();
    await cache.cacheWallet(USER, DOCS, first);
    expect(first.calls).toEqual(['d1', 'd2']);

    // This is the load-bearing one: without it every wallet open would re-download
    // every file, because a re-key makes the old ciphertext unreadable.
    const second = recordingFetcher();
    await cache.cacheWallet(USER, DOCS, second);
    expect(second.calls).toEqual([]);
  });

  it('re-downloads when any metadata actually changed', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    const edited = [{ ...DOCS[0], label: 'Passport (renewed)' }, DOCS[1]];
    const again = recordingFetcher();
    await cache.cacheWallet(USER, edited, again);
    expect(again.calls).toEqual(['d1', 'd2']);
    cache.forgetWalletSessionKey();
    expect((await cache.readOfflineWallet(USER)).documents).toEqual(edited);
  });

  it('sweeps the files of the generation it replaced', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    const store = globalThis.indexedDB._dbs.get('dbworld-wallet').get('walletCache');
    expect(store.size).toBe(3);                       // index + two files

    // d2 leaves the wallet, and the re-key makes every previous record unreadable
    // anyway — so leaving them behind is dead bytes accumulating forever.
    await cache.cacheWallet(USER, [DOCS[0]], recordingFetcher());
    expect(store.size).toBe(2);                       // index + the one survivor
    cache.forgetWalletSessionKey();
    expect((await cache.readOfflineDocument(USER, 'd1')).status).toBe('ok');
    expect((await cache.readOfflineDocument(USER, 'd2')).status).toBe('none');
  });

  it('keeps a complete old snapshot rather than writing a holed new one', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());

    // Metadata changed, but the connection cannot deliver d2's bytes. Going ahead would
    // re-key and leave a wallet that lists two documents and can open one.
    const edited = [DOCS[0], { ...DOCS[1], label: 'Licence (renewed)' }];
    await cache.cacheWallet(USER, edited, recordingFetcher(['d2']));

    cache.forgetWalletSessionKey();
    const res = await cache.readOfflineWallet(USER);
    expect(res.documents).toEqual(DOCS);                       // the old, complete list
    expect((await cache.readOfflineDocument(USER, 'd1')).status).toBe('ok');
    expect((await cache.readOfflineDocument(USER, 'd2')).status).toBe('ok');

    // And the abandoned pass left nothing lying about: index + the two original files,
    // with none of the generation that was rolled back.
    const store = globalThis.indexedDB._dbs.get('dbworld-wallet').get('walletCache');
    expect(store.size).toBe(3);
  });

  it('takes a partial snapshot when there is nothing cached to lose', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher(['d2']));
    cache.forgetWalletSessionKey();
    expect((await cache.readOfflineWallet(USER)).documents).toEqual(DOCS);
    expect((await cache.readOfflineDocument(USER, 'd1')).status).toBe('ok');
    expect((await cache.readOfflineDocument(USER, 'd2')).status).toBe('none');
  });
});

describe('how often it asks for a fingerprint', () => {
  it('asks once for the list, and not again for a document', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();                    // as if the app had restarted

    expect((await cache.readOfflineWallet(USER)).status).toBe('ok');
    expect(ks.unwrapCalls).toBe(1);

    // The whole reason the snapshot shares ONE key. Per-document keys would make each
    // of these another prompt, which is the difference between usable and theatre.
    await cache.readOfflineDocument(USER, 'd1');
    await cache.readOfflineDocument(USER, 'd2');
    await cache.readOfflineWallet(USER);
    expect(ks.unwrapCalls).toBe(1);
  });

  it('does not ask at all when it just wrote the snapshot', async () => {
    // Caching generates the key, so it is already in hand — writing must never prompt.
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    expect(ks.unwrapCalls).toBe(0);
    expect((await cache.readOfflineWallet(USER)).status).toBe('ok');
    expect(ks.unwrapCalls).toBe(0);
  });

  it('asks once when a document is opened cold, via the index', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();
    const res = await cache.readOfflineDocument(USER, 'd1');
    expect(res.status).toBe('ok');
    expect(new TextDecoder().decode(await res.blob.arrayBuffer())).toBe('bytes-of-d1');
    expect(ks.unwrapCalls).toBe(1);
  });
});

describe('when the unlock does not succeed', () => {
  it('reports a cancelled prompt as locked, and keeps the snapshot', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();
    ks.failWith = 'CANCELED';

    expect((await cache.readOfflineWallet(USER)).status).toBe('locked');
    // Cancelling is not a reason to destroy anything.
    expect(await cache.hasCachedWallet(USER)).toBe(true);

    ks.failWith = null;
    expect((await cache.readOfflineWallet(USER)).status).toBe('ok');
  });

  it('wipes the snapshot when the device key is invalidated', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();
    ks.failWith = 'KEY_INVALIDATED';

    // The lock screen changed, so the key is gone and every record is now unopenable
    // ciphertext. Keeping it would only be storing secrets nobody can ever use.
    expect((await cache.readOfflineWallet(USER)).status).toBe('invalidated');
    expect(await cache.hasCachedWallet(USER)).toBe(false);
    expect(globalThis.indexedDB._dbs.get('dbworld-wallet').get('walletCache').size).toBe(0);
  });

  it('reports any other failure as an error without destroying anything', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();
    ks.failWith = 'SOMETHING_ELSE';
    expect((await cache.readOfflineWallet(USER)).status).toBe('error');
    expect(await cache.hasCachedWallet(USER)).toBe(true);
  });
});

describe('teardown', () => {
  it('clears one user without touching another', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    await cache.cacheWallet(99, [{ id: 'x1', label: 'Other' }], recordingFetcher());

    await cache.clearOfflineWallet(USER);
    expect(await cache.hasCachedWallet(USER)).toBe(false);
    expect(await cache.hasCachedWallet(99)).toBe(true);
  });

  it('drops the in-memory key too, so a later read has to ask again', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    await cache.clearOfflineWallet(USER);
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    cache.forgetWalletSessionKey();
    expect((await cache.readOfflineWallet(USER)).status).toBe('ok');
    expect(ks.unwrapCalls).toBe(1);
  });

  it('empties everything on logout', async () => {
    await cache.cacheWallet(USER, DOCS, recordingFetcher());
    await cache.cacheWallet(99, [{ id: 'x1', label: 'Other' }], recordingFetcher());
    await cache.clearAllOfflineWallet();
    expect(await cache.hasCachedWallet(USER)).toBe(false);
    expect(await cache.hasCachedWallet(99)).toBe(false);
  });
});
