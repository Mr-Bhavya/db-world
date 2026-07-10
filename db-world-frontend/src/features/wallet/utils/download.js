import { Capacitor } from '@capacitor/core';

/**
 * Saves a Blob to the user's device (web: anchor download, native: Capacitor Filesystem).
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
}
