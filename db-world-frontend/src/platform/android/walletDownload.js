import DbWorldDownload from './DbWorldDownload';

/**
 * Converts a Blob to base64 string (without the data: URI prefix).
 */
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

/** Common MIME → extension, so the saved file is recognised by other apps. */
const EXT_FOR_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** Ensures the filename carries an extension matching its MIME type. */
const withExtension = (name, mime) => {
  const ext = EXT_FOR_MIME[mime];
  if (!ext) return name;
  return /\.[a-z0-9]{1,5}$/i.test(name) ? name : `${name}.${ext}`;
};

/**
 * Saves the blob into the device's public Downloads/DB-World collection (visible in the Files app)
 * via the native DbWorldDownload plugin. The wallet already holds the decrypted bytes, so this is a
 * direct save — not an aria2 URL download.
 *
 * @param {Blob} blob - The blob to save
 * @param {string} filename - The desired filename
 * @returns {Promise<{uri: string, mimeType: string}>} URI + resolved MIME of the saved file
 */
export async function saveBlobNative(blob, filename) {
  const data = await blobToBase64(blob);
  const mimeType = blob.type || '';
  const base = (filename || 'document').replace(/[^\w.-]+/g, '_') || 'document';
  const safeName = withExtension(base, mimeType);
  const { uri, mimeType: savedMime } = await DbWorldDownload.saveDocument({
    data,
    fileName: safeName,
    mimeType,
  });
  return { uri, mimeType: savedMime || mimeType };
}

/**
 * Opens a saved file in the user's default viewer.
 * @param {string} uri - URI returned by {@link saveBlobNative}
 * @param {string} [mimeType] - Optional MIME hint
 */
export async function openNative(uri, mimeType) {
  if (!uri) return;
  await DbWorldDownload.openFile({ uri, mimeType: mimeType || '' });
}
