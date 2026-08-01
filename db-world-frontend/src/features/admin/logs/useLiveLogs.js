import { useCallback, useEffect, useRef, useState } from 'react';
import { followUrl } from './logApi';

const MAX_BACKOFF_MS = 20_000;
const MAX_ATTEMPTS = 3;   // give up (no flood) if the server keeps closing the stream
const FLUSH_MS = 200;

// Parse one SSE frame (text between blank lines). Ignores comment/heartbeat
// lines (":...") and the "connect" handshake; returns the joined `data:` payload.
function parseFrame(frame) {
  let event = 'message';
  const data = [];
  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (event === 'connect') return '';
  return data.join('\n');
}

/**
 * Live tail over a SINGLE long-lived SSE connection (fetch + ReadableStream, so it
 * can send the Bearer token). No polling — one request that stays open.
 *   - incoming lines are BATCHED and flushed every 200ms (no setState-per-line jank)
 *   - reconnect with exponential backoff, but BOUNDED (MAX_ATTEMPTS) so a server that
 *     keeps closing the stream can't cause a request flood — it stops with an error
 *   - a connection that holds ≥3s resets the attempt counter (genuine hiccups reconnect)
 *   - 401/403 stops immediately; ring-buffered to `max`
 *
 * Returns { lines, status, error, clear }.  status: idle | connecting | live | reconnecting | error
 */
export default function useLiveLogs({ source, type, format = 'JSON', enabled, max = 2000 }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const bufRef = useRef([]);
  const parseJson = source === 'app' && format === 'JSON';

  const clear = useCallback(() => { bufRef.current = []; setLines([]); }, []);

  useEffect(() => {
    if (!enabled || !source || !type) { setStatus('idle'); return undefined; }

    bufRef.current = [];
    setLines([]);
    setError(null);

    let aborted = false;
    let attempt = 0;
    let ctrl = null;
    let retryTimer = null;

    const flush = setInterval(() => {
      if (!bufRef.current.length) return;
      const batch = bufRef.current;
      bufRef.current = [];
      setLines((prev) => {
        const next = prev.concat(batch);
        return next.length > max ? next.slice(-max) : next;
      });
    }, FLUSH_MS);

    const push = (raw) => {
      if (!raw) return;
      let entry = raw;
      if (parseJson) { try { entry = JSON.parse(raw); } catch { entry = raw; } }
      bufRef.current.push(entry);
    };

    const scheduleRetry = (reason) => {
      if (aborted) return;
      if (attempt >= MAX_ATTEMPTS) {
        setError(`Live stopped — ${reason}. The server closed the stream repeatedly (streaming may not be supported for this log here).`);
        setStatus('error');
        return; // bounded: stop instead of flooding with reconnects
      }
      setError(`${reason} — reconnecting…`);
      setStatus('reconnecting');
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    async function connect() {
      if (aborted) return;
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
      ctrl = new AbortController();
      let stable = null;
      let gotBytes = false;
      try {
        const token = localStorage.getItem('token');
        const headers = { Accept: 'text/event-stream' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(followUrl(source, type, format), { headers, signal: ctrl.signal });
        if (res.status === 401 || res.status === 403) {
          setError('Not authorized to stream this log (session may have expired).');
          setStatus('error');
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        setStatus('live');
        setError(null);
        // A stream that survives a few seconds is genuinely working → reset backoff.
        stable = setTimeout(() => { attempt = 0; }, 3000);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          gotBytes = true;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            push(parseFrame(buf.slice(0, idx)));
            buf = buf.slice(idx + 2);
          }
        }
        throw new Error(gotBytes ? 'Stream ended' : 'Stream closed with no data');
      } catch (e) {
        if (aborted || e?.name === 'AbortError') return;
        scheduleRetry(String(e?.message || e));
      } finally {
        if (stable) clearTimeout(stable);
      }
    }

    connect();

    return () => {
      aborted = true;
      ctrl?.abort();
      clearInterval(flush);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [source, type, format, enabled, max, parseJson]);

  return { lines, status, error, clear };
}
