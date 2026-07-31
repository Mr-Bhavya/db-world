/**
 * JS bridge to the native VaultCrypto plugin (Android Keystore key wrapping).
 * All methods are safe no-ops / rejections off Android so callers don't need to
 * branch. Errors carry a `.code` string (NO_LOCK, CANCELED, KEY_INVALIDATED, …)
 * set by the native side via reject(message, code).
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

const VaultCrypto = registerPlugin('VaultCrypto');

export const vaultCryptoAvailable = () => Capacitor.getPlatform() === 'android';

/** { secure, canAuthenticate, biometric } — never throws. */
export async function vcIsSecure() {
  if (!vaultCryptoAvailable()) return { secure: false, canAuthenticate: false, biometric: false };
  try {
    return await VaultCrypto.isSecure();
  } catch {
    return { secure: false, canAuthenticate: false, biometric: false };
  }
}

/** RSA-wrap a base64 AES key with the device keypair (no prompt). Returns base64 wrapped key. */
export async function vcWrapKey(keyB64) {
  const { wrapped } = await VaultCrypto.wrapKey({ key: keyB64 });
  return wrapped;
}

/** Prompt (biometric / device-credential) then unwrap. Returns base64 AES key. May throw with .code. */
export async function vcUnwrapKey(wrapped, { title, subtitle } = {}) {
  const { key } = await VaultCrypto.unwrapKey({ wrapped, title, subtitle });
  return key;
}

/** Delete the device keypair (logout / invalidation). Never throws. */
export async function vcReset() {
  if (!vaultCryptoAvailable()) return;
  try { await VaultCrypto.reset(); } catch { /* ignore */ }
}
