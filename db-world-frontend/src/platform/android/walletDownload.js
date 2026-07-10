import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Converts a Blob to base64 string (without the data: URI prefix).
 */
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

/**
 * Writes the blob to the device Documents directory.
 * @param {Blob} blob - The blob to save
 * @param {string} filename - The desired filename
 * @returns {Promise<string>} The URI of the saved file
 */
export async function saveBlobNative(blob, filename) {
  const data = await blobToBase64(blob);
  const safeName = filename.replace(/[^\w.-]+/g, '_') || 'document';
  const result = await Filesystem.writeFile({
    path: safeName,
    data,
    directory: Directory.Documents,
    recursive: true,
  });
  return result.uri;
}
