import { describe, it, expect } from 'vitest';
import { classifyBiometricError, isNetworkError, BIOMETRIC_OUTCOME } from './biometric';

/**
 * This mapping decides what the lock screen offers. Get it wrong in the "no retry"
 * direction and the user is left on a full-screen overlay with nothing to press, which
 * is exactly the bug these tests exist to stop coming back. Codes are the plugin's
 * BiometricAuthError enum (@capgo/capacitor-native-biometric).
 */
describe('classifyBiometricError', () => {
  it('treats every dismissal as cancelled, never as a failed scan', () => {
    // Accusing someone of failing a scan they never attempted is the difference
    // between "try again" and "your fingerprint was rejected".
    [11, 15, 16].forEach((code) => {
      expect(classifyBiometricError({ code })).toBe(BIOMETRIC_OUTCOME.CANCELLED);
    });
  });

  it('separates an explicit passcode request from a cancel', () => {
    expect(classifyBiometricError({ code: 17 })).toBe(BIOMETRIC_OUTCOME.FALLBACK);
  });

  it('flags lockout separately, because retrying cannot work until it cools off', () => {
    [2, 4].forEach((code) => {
      expect(classifyBiometricError({ code })).toBe(BIOMETRIC_OUTCOME.LOCKED_OUT);
    });
  });

  it('reports a genuine non-match', () => {
    expect(classifyBiometricError({ code: 10 })).toBe(BIOMETRIC_OUTCOME.FAILED);
  });

  it('groups no-hardware, not-enrolled and no-passcode as unavailable', () => {
    // The gate turns this one into "let them through" rather than a dead end, so it
    // must not leak into ERROR and take the retry path instead.
    [1, 3, 14].forEach((code) => {
      expect(classifyBiometricError({ code })).toBe(BIOMETRIC_OUTCOME.UNAVAILABLE);
    });
  });

  it('falls back to ERROR — which is retryable — for anything unrecognised', () => {
    // An unknown code must never land somewhere that hides the button.
    [0, 99, undefined, null].forEach((code) => {
      expect(classifyBiometricError({ code })).toBe(BIOMETRIC_OUTCOME.ERROR);
    });
    expect(classifyBiometricError(undefined)).toBe(BIOMETRIC_OUTCOME.ERROR);
    expect(classifyBiometricError(new Error('boom'))).toBe(BIOMETRIC_OUTCOME.ERROR);
  });

  it('reads string codes, since the bridge may hand them back as strings', () => {
    expect(classifyBiometricError({ code: '10' })).toBe(BIOMETRIC_OUTCOME.FAILED);
    expect(classifyBiometricError({ code: '14' })).toBe(BIOMETRIC_OUTCOME.UNAVAILABLE);
  });
});

describe('isNetworkError', () => {
  it('spots a request that never got a response', () => {
    expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isNetworkError({ request: {}, response: undefined })).toBe(true);
  });

  it('does not claim a real HTTP failure is a connection problem', () => {
    // A 401 means the device token was revoked; calling that "no connection" would
    // tell the user to retry something that will keep failing.
    expect(isNetworkError({ request: {}, response: { status: 401 } })).toBe(false);
    expect(isNetworkError({})).toBe(false);
  });
});
