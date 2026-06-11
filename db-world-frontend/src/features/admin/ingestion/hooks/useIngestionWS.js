import { useEffect, useRef, useCallback } from 'react';
import useIngestionStore from '../store/ingestionStore';
import { resolveWsUrl } from '@shared/config/apiBaseUrl';

const WS_URL = resolveWsUrl('/ws/status');

const RECONNECT_DELAY = 5000;

/**
 * Manages the WebSocket connection to /ws/status.
 * Parses the server broadcast (jobId → JobSnapshot map) and
 * writes it into the Zustand store.
 */
export function useIngestionWS() {
  const setJobs      = useIngestionStore((s) => s.setJobs);
  const setWsStatus  = useIngestionStore((s) => s.setWsStatus);
  const ws           = useRef(null);
  const reconnectRef = useRef(null);
  const unmounted    = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    setWsStatus('connecting');

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        if (unmounted.current) return;
        setWsStatus('connected');
        clearTimeout(reconnectRef.current);
      };

      ws.current.onmessage = (event) => {
        if (unmounted.current) return;
        try {
          // Backend sends: { jobId: { jobId, status, step, sourceType, fileName, uri, progress, ... } }
          const data = JSON.parse(event.data);
          setJobs(data);
        } catch {
          // ignore parse errors
        }
      };

      ws.current.onerror = () => {
        if (!unmounted.current) setWsStatus('error');
      };

      ws.current.onclose = (e) => {
        if (unmounted.current) return;
        setWsStatus('disconnected');
        if (e.code !== 1000) {
          reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };
    } catch {
      setWsStatus('error');
    }
  }, [setJobs, setWsStatus]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(reconnectRef.current);
      if (ws.current) ws.current.close(1000, 'unmount');
    };
  }, [connect]);
}
