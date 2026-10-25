import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@platform/android/vaultCrypto', () => ({
  vaultCryptoAvailable: () => true,
  vcWrapKey: vi.fn(async () => 'wrapped-key'),
  vcUnwrapKey: vi.fn(),
  vcReset: vi.fn(async () => {}),
}));

const { vcWrapKey } = await import('@platform/android/vaultCrypto');
const { cacheVault, cachedVaultVersion, clearAllOfflineVault } = await import('./vaultCache');

// Just enough IndexedDB for vaultCache: one database, one store, requests that complete on a later tick.
const records = new Map();
let afterPut = () => {};   // runs once a put has landed, for a test to sign out at that moment
const later = (fn) => setTimeout(fn, 0);
const fakeIndexedDb = {
  open() {
    const req = {};
    const store = {
      get: (k) => ({ result: records.get(k) }),
      put: (v, k) => { records.set(k, v); afterPut(); return {}; },
      delete: (k) => { records.delete(k); return {}; },
      clear: () => { records.clear(); return {}; },
    };
    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => {
        const tx = { objectStore: () => store };
        later(() => tx.oncomplete?.());
        return tx;
      },
      close: () => {},
    };
    later(() => { req.result = db; req.onsuccess?.(); });
    return req;
  },
};

const SNAPSHOT = [{ id: 'pm1', host: 'netflix.com', credentials: [{ id: 'c1', password: 'pw-1' }] }];

describe('cacheVault', () => {
  beforeEach(() => {
    records.clear();
    afterPut = () => {};
    vi.stubGlobal('indexedDB', fakeIndexedDb);
    vcWrapKey.mockImplementation(async () => 'wrapped-key');
  });

  it('writes the encrypted copy while the session is current', async () => {
    await cacheVault(7, SNAPSHOT, { isCurrent: () => true, version: 'v1' });

    const rec = records.get('7');
    expect(rec).toMatchObject({ userId: '7', wrapped: 'wrapped-key' });
    expect(JSON.stringify(rec)).not.toContain('pw-1');   // only ciphertext reaches storage
    await expect(cachedVaultVersion(7)).resolves.toBe('v1');
  });

  it('knows no version for a user with no copy, or a copy saved before versions existed', async () => {
    await expect(cachedVaultVersion(7)).resolves.toBeNull();
    records.set('7', { userId: '7', wrapped: 'w', iv: 'i', ct: 'c', syncedAt: 1 });   // an older copy
    await expect(cachedVaultVersion(7)).resolves.toBeNull();
  });

  it('writes nothing when the user signs out while the key is being wrapped', async () => {
    let signedIn = true;
    vcWrapKey.mockImplementation(async () => {
      signedIn = false;   // sign-out lands here, after the caller's own check
      await clearAllOfflineVault();
      return 'wrapped-key';
    });

    await cacheVault(7, SNAPSHOT, { isCurrent: () => signedIn });

    expect(records.size).toBe(0);
  });

  it('removes the copy again when the user signs out while it is being written', async () => {
    let signedIn = true;
    afterPut = () => { signedIn = false; };   // the record has landed; cacheVault has not looked again yet

    await cacheVault(7, SNAPSHOT, { isCurrent: () => signedIn });

    expect(records.size).toBe(0);
  });
});
