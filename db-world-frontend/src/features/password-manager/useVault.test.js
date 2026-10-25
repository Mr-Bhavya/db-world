import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/services/ApiServices', () => ({ getCredential: vi.fn(), getSnapshot: vi.fn(), getSecret: vi.fn(), getEntrySecrets: vi.fn(), getSnapshotVersion: vi.fn() }));
vi.mock('./offline/vaultCache', () => ({ cacheVault: vi.fn(), cachedVaultVersion: vi.fn(), readOfflineVault: vi.fn(), offlineVaultSupported: vi.fn() }));
vi.mock('@features/auth/context/Authentication', () => ({ useAuth: () => ({ auth: {} }) }));

const { getCredential, getSnapshot, getSecret, getEntrySecrets, getSnapshotVersion } = await import('@shared/services/ApiServices');
const { cacheVault, cachedVaultVersion, readOfflineVault, offlineVaultSupported } = await import('./offline/vaultCache');
const { fetchVault, getVaultOffline, vaultUserId, readSecret, readAllSecrets, resetVaultOffline } = await import('./useVault');

// What GET /api/pm/ returns now: summaries, no secrets.
const VAULT = [{ id: 'pm1', host: 'netflix.com', credentials: [{ id: 'c1', hasPassword: true, strength: 4, reused: false }] }];
// What GET /api/pm/snapshot returns, and what an offline copy holds (an old pre-summary copy has the same shape).
const SNAPSHOT = [{ id: 'pm1', host: 'netflix.com', credentials: [
  { id: 'c1', name: 'Netflix', username: 'me', password: 'pw-1', pin: '1234', notes: 'n',
    customFields: [{ id: 'f1', fieldKey: 'Recovery', fieldValue: 'code', fieldType: 'HIDDEN' }] },
] }];

const flush = () => new Promise((r) => { setTimeout(r, 0); });

// Unless a test says otherwise, the server's snapshot has changed since the copy was saved.
beforeEach(() => {
  getSnapshotVersion.mockResolvedValue({ data: { version: 'v2' } });
  cachedVaultVersion.mockResolvedValue('v1');
});

describe('fetchVault', () => {
  beforeEach(() => { vi.clearAllMocks(); offlineVaultSupported.mockReturnValue(false); });

  it('returns the server list and clears the offline flag', async () => {
    getCredential.mockResolvedValue({ data: VAULT });
    await expect(fetchVault(7)).resolves.toEqual(VAULT);
    expect(getVaultOffline()).toBeNull();
  });

  it('never fetches the snapshot where there is no offline copy to keep (web, iOS)', async () => {
    getCredential.mockResolvedValue({ data: VAULT });
    await fetchVault(7);
    await flush();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(cacheVault).not.toHaveBeenCalled();
  });

  it('on the Android app, refreshes the offline copy from the snapshot, not from the list', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    getSnapshot.mockResolvedValue({ data: SNAPSHOT });
    await expect(fetchVault(7)).resolves.toEqual(VAULT);
    await flush();
    expect(cacheVault).toHaveBeenCalledWith(7, SNAPSHOT, expect.objectContaining({ version: 'v2' }));
  });

  it('does not download the snapshot when the offline copy is already current', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    getSnapshotVersion.mockResolvedValue({ data: { version: 'v1' } });
    cachedVaultVersion.mockResolvedValue('v1');

    await expect(fetchVault(7)).resolves.toEqual(VAULT);
    await flush();

    expect(cachedVaultVersion).toHaveBeenCalledWith(7);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(cacheVault).not.toHaveBeenCalled();
  });

  it('downloads it when there is no copy yet, or one saved before versions existed', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    getSnapshot.mockResolvedValue({ data: SNAPSHOT });
    cachedVaultVersion.mockResolvedValue(null);

    await fetchVault(7);
    await flush();

    expect(cacheVault).toHaveBeenCalledWith(7, SNAPSHOT, expect.objectContaining({ version: 'v2' }));
  });

  it('downloads it every time from a server that has no version endpoint, as before', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    getSnapshot.mockResolvedValue({ data: SNAPSHOT });
    getSnapshotVersion.mockRejectedValue(new Error('404'));
    cachedVaultVersion.mockResolvedValue(null);

    await fetchVault(7);
    await flush();

    expect(cacheVault).toHaveBeenCalledWith(7, SNAPSHOT, expect.objectContaining({ version: null }));
  });

  it('still opens the vault when the snapshot fails (a 429, say): the offline copy just stays as it was', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    getSnapshot.mockRejectedValue(new Error('429'));
    await expect(fetchVault(7)).resolves.toEqual(VAULT);
    await flush();
    expect(cacheVault).not.toHaveBeenCalled();
  });

  it('falls back to the offline copy, shown as summaries, when the server is unreachable', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'ok', vault: SNAPSHOT, syncedAt: 123 });
    const vault = await fetchVault(7);
    expect(readOfflineVault).toHaveBeenCalledWith(7);
    expect(getVaultOffline()).toEqual({ syncedAt: 123 });
    expect(vault[0].credentials[0]).toMatchObject({ id: 'c1', hasPassword: true, hasPin: true, hasNotes: true });
    expect(JSON.stringify(vault)).not.toContain('pw-1');
  });

  it('reports a cancelled unlock and still fails, so the page can offer a retry', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'locked' });
    await expect(fetchVault(7)).rejects.toThrow('Network Error');
    expect(getVaultOffline()).toEqual({ locked: true });
  });

  it('reports an invalidated copy', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'invalidated' });
    await expect(fetchVault(7)).rejects.toThrow();
    expect(getVaultOffline()).toEqual({ invalidated: true });
  });

  it('fails plainly when there is no offline copy', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'none' });
    await expect(fetchVault(7)).rejects.toThrow();
    expect(getVaultOffline()).toBeNull();
  });
});

describe('readSecret', () => {
  beforeEach(() => { vi.clearAllMocks(); offlineVaultSupported.mockReturnValue(false); });

  it('asks the server while online', async () => {
    getCredential.mockResolvedValue({ data: VAULT });
    await fetchVault(7);
    getSecret.mockResolvedValue({ data: { value: 'pw-1' } });
    await expect(readSecret('c1', 'password')).resolves.toBe('pw-1');
    expect(getSecret).toHaveBeenCalledWith('c1', 'password');
  });

  it('reads the unlocked offline copy while offline, without the network', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'ok', vault: SNAPSHOT, syncedAt: 123 });
    await fetchVault(7);

    await expect(readSecret('c1', 'password')).resolves.toBe('pw-1');
    await expect(readSecret('c1', 'pin')).resolves.toBe('1234');
    await expect(readSecret('c1', 'notes')).resolves.toBe('n');
    await expect(readSecret('c1', 'custom:f1')).resolves.toBe('code');
    await expect(readSecret('c1', 'history:h1')).rejects.toThrow();   // history is not in the copy
    await expect(readSecret('nope', 'password')).rejects.toThrow();
    expect(getSecret).not.toHaveBeenCalled();
  });

  it('forgets the offline secrets once the server answers again', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'ok', vault: SNAPSHOT, syncedAt: 123 });
    await fetchVault(7);
    getCredential.mockResolvedValue({ data: VAULT });
    await fetchVault(7);

    getSecret.mockResolvedValue({ data: { value: 'from-server' } });
    await expect(readSecret('c1', 'password')).resolves.toBe('from-server');
  });
});

describe('readAllSecrets (the edit form)', () => {
  beforeEach(() => { vi.clearAllMocks(); offlineVaultSupported.mockReturnValue(false); });

  it('reads the whole entry from the server in one request while online', async () => {
    getCredential.mockResolvedValue({ data: VAULT });
    await fetchVault(7);
    const all = { password: 'pw-1', pin: '1234', notes: 'n', customFields: { f1: 'code' } };
    getEntrySecrets.mockResolvedValue({ data: all });

    await expect(readAllSecrets('c1')).resolves.toEqual(all);
    expect(getEntrySecrets).toHaveBeenCalledTimes(1);
    expect(getSecret).not.toHaveBeenCalled();
  });

  it('reads it from the unlocked offline copy while offline', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'ok', vault: SNAPSHOT, syncedAt: 123 });
    await fetchVault(7);

    await expect(readAllSecrets('c1')).resolves.toEqual({ password: 'pw-1', pin: '1234', notes: 'n', customFields: { f1: 'code' } });
    await expect(readAllSecrets('nope')).rejects.toThrow();
    expect(getEntrySecrets).not.toHaveBeenCalled();
  });
});

describe('resetVaultOffline (sign-out)', () => {
  beforeEach(() => { vi.clearAllMocks(); offlineVaultSupported.mockReturnValue(false); });

  it('drops the decrypted offline secrets and the offline state', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'ok', vault: SNAPSHOT, syncedAt: 123 });
    await fetchVault(7);
    await expect(readSecret('c1', 'password')).resolves.toBe('pw-1');

    resetVaultOffline();

    expect(getVaultOffline()).toBeNull();
    getSecret.mockResolvedValue({ data: { value: 'from-server' } });
    await expect(readSecret('c1', 'password')).resolves.toBe('from-server');   // not the offline copy
    expect(getSecret).toHaveBeenCalledWith('c1', 'password');
  });

  it('a snapshot still in flight at sign-out does not write the offline copy back', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    let arrive;
    getSnapshot.mockReturnValue(new Promise((r) => { arrive = r; }));
    await fetchVault(7);

    resetVaultOffline();   // signed out (clearAllOfflineVault wipes the copy)
    arrive({ data: SNAPSHOT });
    await flush();
    expect(cacheVault).not.toHaveBeenCalled();

    // The next session's load caches as usual.
    getSnapshot.mockResolvedValue({ data: SNAPSHOT });
    await fetchVault(8);
    await flush();
    expect(cacheVault).toHaveBeenCalledWith(8, SNAPSHOT, expect.objectContaining({ version: 'v2' }));
  });

  it('tells cacheVault when a sign-out lands while it is still writing', async () => {
    offlineVaultSupported.mockReturnValue(true);
    getCredential.mockResolvedValue({ data: VAULT });
    getSnapshot.mockResolvedValue({ data: SNAPSHOT });
    await fetchVault(7);
    await flush();
    const { isCurrent } = cacheVault.mock.calls[0][2];

    expect(isCurrent()).toBe(true);
    resetVaultOffline();
    expect(isCurrent()).toBe(false);
  });

  it('an offline unlock still in flight at sign-out keeps nothing in memory', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    let unlocked;
    readOfflineVault.mockReturnValue(new Promise((r) => { unlocked = r; }));
    const loading = fetchVault(7);
    await flush();

    resetVaultOffline();
    unlocked({ status: 'ok', vault: SNAPSHOT, syncedAt: 123 });
    await expect(loading).rejects.toThrow('Network Error');
    expect(getVaultOffline()).toBeNull();
    getSecret.mockResolvedValue({ data: { value: 'from-server' } });
    await expect(readSecret('c1', 'password')).resolves.toBe('from-server');
  });
});

describe('vaultUserId', () => {
  it('prefers the numeric id and falls back like the old screens did', () => {
    expect(vaultUserId({ user: { id: 7, username: 'u' } })).toBe(7);
    expect(vaultUserId({ user: { username: 'u' } })).toBe('u');
    expect(vaultUserId({})).toBeNull();
  });
});
