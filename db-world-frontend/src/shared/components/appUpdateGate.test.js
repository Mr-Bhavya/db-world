import { describe, it, expect } from 'vitest';
import { adminAudienceDecision } from '@shared/components/AppUpdateGate';

/**
 * Who sees an admin-audience release, and — the part that actually broke — when the answer is
 * "not yet" rather than "no".
 *
 * Every release up to v3.0.26 shipped `releaseAudience: "all"`, which takes the immediate path and
 * never reaches this logic at all. v3.0.27 and v3.0.28 were published admin-only, and the update
 * prompt stopped appearing — including for the admin who published them.
 */
describe('adminAudienceDecision', () => {
  it('shows the update to an admin', () => {
    expect(adminAudienceDecision({ loading: false, isAuthenticated: true, role: 'ADMIN' }))
      .toBe('show');
  });

  it('shows the update to an owner', () => {
    expect(adminAudienceDecision({ loading: false, isAuthenticated: true, role: 'OWNER' }))
      .toBe('show');
  });

  it('accepts a ROLE_ prefix and odd casing, as the token may carry either', () => {
    expect(adminAudienceDecision({ loading: false, isAuthenticated: true, role: 'ROLE_admin' }))
      .toBe('show');
    expect(adminAudienceDecision({ loading: false, isAuthenticated: true, role: '  Owner ' }))
      .toBe('show');
  });

  it('discards it for a signed-in non-admin — that is a real answer', () => {
    expect(adminAudienceDecision({ loading: false, isAuthenticated: true, role: 'USER' }))
      .toBe('discard');
  });

  it('waits while the initial verify is still running', () => {
    expect(adminAudienceDecision({ loading: true, isAuthenticated: false, role: null }))
      .toBe('wait');
  });

  it('waits while the app is biometric-locked, even though loading is already false', () => {
    // THE bug. The auth context starts a biometric session at
    // `{ ...INITIAL_AUTH, loading: false, locked: true }`: loading is false while role is still
    // null, because the fingerprint prompt has not been answered yet. Reading that as "resolved,
    // not an admin" discarded the update before the user could possibly have unlocked, and it
    // was never re-evaluated after they did.
    expect(adminAudienceDecision({ loading: false, locked: true, isAuthenticated: false, role: null }))
      .toBe('wait');
  });

  it('shows it once the unlock completes and the role lands', () => {
    expect(adminAudienceDecision({ loading: false, locked: false, isAuthenticated: true, role: 'OWNER' }))
      .toBe('show');
  });

  it('keeps waiting for an anonymous visitor, who may still sign in', () => {
    // Covers "use password instead" too: the lock is dismissed but nobody is signed in yet, so
    // discarding here would lose the update for the login that is about to happen.
    expect(adminAudienceDecision({ loading: false, locked: false, isAuthenticated: false, role: null }))
      .toBe('wait');
  });

  it('does not throw on a missing or malformed auth snapshot', () => {
    expect(adminAudienceDecision(undefined)).toBe('wait');
    expect(adminAudienceDecision({})).toBe('wait');
    expect(adminAudienceDecision({ loading: false, isAuthenticated: true, role: 42 })).toBe('discard');
  });
});
