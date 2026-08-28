import { Capacitor } from '@capacitor/core';

/** The extensions the wallet can actually hold — `ACCEPTED_MIME` is the same three. */
const EXT_BY_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/**
 * Filename for a saved document: the label, plus the extension its content type implies.
 *
 * Downloads used to be named from the label alone, which for the common case produced a file
 * called "Aadhaar Card" with NO extension — unopenable by double-click on Windows and Android
 * alike. The label is still the better base name than the stored `originalFileName` (which is
 * whatever the camera called it), it just needs the suffix.
 *
 * Characters a filesystem rejects are replaced rather than stripped, so "Passport / Renewal"
 * stays readable instead of collapsing to "PassportRenewal".
 */
export function documentFileName(label, contentType) {
  const base = String(label || 'document').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document';
  const ext = EXT_BY_MIME[contentType] ?? '';
  return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;
}

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
