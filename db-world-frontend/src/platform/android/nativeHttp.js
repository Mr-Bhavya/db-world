import { CapacitorHttp } from '@capacitor/core';

/**
 * Fetches a URL as a correct binary Blob on a native Capacitor build.
 *
 * WHY: the app enables CapacitorHttp (capacitor.config), which patches fetch/XHR to route through
 * the native HTTP layer. That layer decodes response bodies as UTF-8 TEXT, so binary responses
 * (PDFs, images) come back corrupted — every non-UTF-8 byte becomes U+FFFD — which renders/downloads
 * as a blank/garbage file. Calling CapacitorHttp directly with responseType 'blob' returns the body
 * base64-encoded, which we decode losslessly. Native-only; the web path keeps using axios blobs.
 */
function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchBinaryBlobNative(url, { params, auth = true } = {}) {
  const call = () => CapacitorHttp.get({
    url,
    params,
    headers: auth ? authHeaders() : {},
    responseType: 'blob',
  });

  let res = await call();

  // Access token expired mid-session → refresh once and retry (mirrors the axios interceptor).
  if (auth && res.status === 401) {
    try {
      const { refreshAccessToken } = await import('@shared/components/ui/utils/AxiosInstants');
      await refreshAccessToken();
      res = await call();
    } catch { /* fall through to the error below */ }
  }

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`Request failed with status ${res.status}`);
    err.response = { status: res.status, data: res.data };
    throw err;
  }

  const base64 = typeof res.data === 'string' ? res.data : '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const headers = res.headers || {};
  const contentType = headers['Content-Type'] || headers['content-type'] || 'application/octet-stream';
  return new Blob([bytes], { type: contentType.split(';')[0].trim() });
}
