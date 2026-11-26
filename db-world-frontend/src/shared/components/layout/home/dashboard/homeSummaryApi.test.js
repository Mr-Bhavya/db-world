import { describe, expect, it, vi } from 'vitest';

vi.mock('@features/auth/context/Authentication', () => ({ useAuth: () => ({ auth: {} }) }));
vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({ default: { get: vi.fn() } }));

const { summaryIdentity } = await import('./homeSummaryApi');

describe('summaryIdentity', () => {
  it('treats a missing or signed-out auth as anonymous', () => {
    expect(summaryIdentity(undefined)).toBe('anon');
    expect(summaryIdentity({ isAuthenticated: false, user: { id: 7 } })).toBe('anon');
  });

  it('keys a signed-in viewer by id and role so promotion refetches', () => {
    const user = { isAuthenticated: true, user: { id: 7 }, role: 'USER' };
    expect(summaryIdentity(user)).toBe('7:USER');
    expect(summaryIdentity({ ...user, role: 'ADMIN' })).toBe('7:ADMIN');
  });

  it('falls back through the identifying fields', () => {
    expect(summaryIdentity({ isAuthenticated: true, user: { username: 'bd' } })).toBe('bd:');
    expect(summaryIdentity({ isAuthenticated: true })).toBe('user:');
  });
});
