/**
 * Saves a Blob to the user's device (web: anchor download).
 * Native (Capacitor) handling is added in Phase 9 (Task 9.1), which rewrites this file.
 */
export function downloadBlob(blob, filename) {
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
