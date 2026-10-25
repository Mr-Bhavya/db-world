import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Everything the provider touches outside React. No DOM here: the provider is rendered on the
// "server" only to get hold of logout (effects do not run, so verify never fires).
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({
  default: { post: vi.fn(async () => ({})) },
  refreshAccessToken: vi.fn(),
}));
vi.mock('@platform/android/biometric', () => ({ isBiometricEnabled: () => false }));
vi.mock('@features/password-manager/offline/vaultCache', () => ({ clearAllOfflineVault: vi.fn(async () => {}) }));
vi.mock('@features/password-manager/useVault', () => ({ resetVaultOffline: vi.fn() }));
vi.mock('@features/wallet/offline/walletCache', () => ({ clearAllOfflineWallet: vi.fn(async () => {}) }));
vi.mock('@shared/auth/tokenStore', () => ({
  accessTokenExpiringSoon: vi.fn(), clearSession: vi.fn(async () => {}), decodeAccessToken: vi.fn(),
  getAccessToken: vi.fn(), getStoredRole: vi.fn(() => null), getStoredUser: vi.fn(() => null),
  hasStoredSession: vi.fn(() => false), loadRefreshToken: vi.fn(), setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(), setStoredIdentity: vi.fn(), setStoredRole: vi.fn(),
}));

const { AuthProvider, useAuth } = await import('./Authentication');
const { resetVaultOffline } = await import('@features/password-manager/useVault');
const { clearAllOfflineVault } = await import('@features/password-manager/offline/vaultCache');
const { clearSession } = await import('@shared/auth/tokenStore');

describe('logout', () => {
  it('clears the vault from memory first, before the session and the offline copy go', async () => {
    let logout;
    const Grab = () => { ({ logout } = useAuth()); return null; };
    renderToString(createElement(AuthProvider, null, createElement(Grab)));

    await logout();

    expect(resetVaultOffline).toHaveBeenCalledTimes(1);
    expect(clearAllOfflineVault).toHaveBeenCalledTimes(1);
    const order = (fn) => fn.mock.invocationCallOrder[0];
    expect(order(resetVaultOffline)).toBeLessThan(order(clearSession));
    expect(order(resetVaultOffline)).toBeLessThan(order(clearAllOfflineVault));
  });

  it('empties every cached response, so the next person to sign in sees none of them', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['pm-vault'], [{ id: 'pm1', host: 'netflix.com', credentials: [{ username: 'me@x.com' }] }]);
    queryClient.setQueryData(['wallet', 'documents', undefined], [{ id: 'd1', label: 'Passport' }]);
    let logout;
    const Grab = () => { ({ logout } = useAuth()); return null; };
    renderToString(createElement(QueryClientProvider, { client: queryClient },
      createElement(AuthProvider, null, createElement(Grab))));

    await logout();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
