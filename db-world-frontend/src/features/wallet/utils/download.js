import { Capacitor } from '@capacitor/core';

/**
 * Saves a Blob to the user's device.
 *  - Native: writes to public Downloads/DB-World and returns `{ uri, mimeType }` so the caller can
 *    offer an "Open" action.
 *  - Web: triggers an anchor download and returns `null`.
 *
 * @returns {Promise<{uri: string, mimeType: string} | null>}
 */
export async function downloadBlob(blob, filename) {
  if (Capacitor?.isNativePlatform?.()) {
    const { saveBlobNative } = await import('@platform/android/walletDownload');
    return saveBlobNative(blob, filename || 'document');
  }

  // Web: use anchor download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}

/**
 * Opens a file previously saved by {@link downloadBlob} (native only; no-op with a falsy `saved`).
 * @param {{uri: string, mimeType?: string} | null} saved
 */
export async function openDownloaded(saved) {
  if (!saved?.uri) return;
  const { openNative } = await import('@platform/android/walletDownload');
  await openNative(saved.uri, saved.mimeType);
}
