/** Appends the access token as the `token` query param (browsers can't send auth headers on a WS upgrade). */
export function withAccessToken(url, token) {
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

/**
 * Whether the live-status socket should reconnect after a close.
 * Only a close the page initiated itself (unmount / manual cleanup) is final — a server
 * restart or proxy timeout also arrives as 1000/1001 and must be recovered from.
 */
export function shouldReconnect({ closedByClient, unmounted }) {
  return !closedByClient && !unmounted;
}

/** Exponential backoff capped at `max`, so a down backend isn't hammered every few seconds. */
export function reconnectDelay(attempt, base = 2000, max = 30000) {
  const n = Math.max(0, attempt);
  return Math.min(max, base * 2 ** n);
}
