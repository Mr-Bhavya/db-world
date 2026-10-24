import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/services/ApiServices', () => ({ getCredential: vi.fn() }));
vi.mock('./offline/vaultCache', () => ({ cacheVault: vi.fn(), readOfflineVault: vi.fn() }));
vi.mock('@features/auth/context/Authentication', () => ({ useAuth: () => ({ auth: {} }) }));

const { getCredential } = await import('@shared/services/ApiServices');
const { cacheVault, readOfflineVault } = await import('./offline/vaultCache');
const { fetchVault, getVaultOffline, vaultUserId } = await import('./useVault');

const VAULT = [{ host: 'netflix.com', credentials: [{ id: 'c1' }] }];

describe('fetchVault', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns the server vault, refreshes the offline copy and clears the offline flag', async () => {
    getCredential.mockResolvedValue({ data: VAULT });
    await expect(fetchVault(7)).resolves.toEqual(VAULT);
    expect(cacheVault).toHaveBeenCalledWith(7, VAULT);
    expect(getVaultOffline()).toBeNull();
  });

  it('falls back to the offline copy when the server is unreachable', async () => {
    getCredential.mockRejectedValue(new Error('Network Error'));
    readOfflineVault.mockResolvedValue({ status: 'ok', vault: VAULT, syncedAt: 123 });
    await expect(fetchVault(7)).resolves.toEqual(VAULT);
    expect(readOfflineVault).toHaveBeenCalledWith(7);
    expect(getVaultOffline()).toEqual({ syncedAt: 123 });
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

describe('vaultUserId', () => {
  it('prefers the numeric id and falls back like the old screens did', () => {
    expect(vaultUserId({ user: { id: 7, username: 'u' } })).toBe(7);
    expect(vaultUserId({ user: { username: 'u' } })).toBe('u');
    expect(vaultUserId({})).toBeNull();
  });
});
