import { useEffect, useRef, useCallback } from 'react';
import useIngestionStore from '../store/ingestionStore';
import { resolveWsUrl } from '@shared/config/apiBaseUrl';
import { accessTokenExpiringSoon, getAccessToken } from '@shared/auth/tokenStore';
import { refreshAccessToken } from '@shared/components/ui/utils/AxiosInstants';
import { reconnectDelay, shouldReconnect, withAccessToken } from './wsConnection';

/**
 * Manages the authenticated WebSocket connection to /ws/status.
 * Parses the server broadcast (jobId -> JobSnapshot map) and writes it into the Zustand store.
 * Reconnects with exponential backoff after any close the page did not initiate.
 */
export function useIngestionWS() {
  const setJobs = useIngestionStore((s) => s.setJobs);
  const setWsStatus = useIngestionStore((s) => s.setWsStatus);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const attemptRef = useRef(0);
  const unmountedRef = useRef(false);
  const connectingRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    const socket = wsRef.current;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'cleanup');
      }
    } catch {
      // ignore cleanup close errors
    }
    wsRef.current = null;
  }, []);

  const scheduleReconnect = useCallback((connectFn) => {
    if (unmountedRef.current || reconnectRef.current) return;
    const delay = reconnectDelay(attemptRef.current);
    attemptRef.current += 1;
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connectFn();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    if (unmountedRef.current || connectingRef.current) return;
    const current = wsRef.current;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    clearReconnectTimer();
    cleanupSocket();
    setWsStatus('connecting');
    connectingRef.current = true;

    try {
      if (accessTokenExpiringSoon(30_000)) {
        await refreshAccessToken().catch(() => {});
      }
    } finally {
      connectingRef.current = false;
    }
    if (unmountedRef.current) return;

    try {
      const socket = new WebSocket(withAccessToken(resolveWsUrl('/ws/status'), getAccessToken()));
      wsRef.current = socket;

      socket.onopen = () => {
        if (unmountedRef.current) return;
        attemptRef.current = 0;
        clearReconnectTimer();
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        if (unmountedRef.current) return;
        try {
          setJobs(JSON.parse(event.data));
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onerror = () => {
        if (!unmountedRef.current) setWsStatus('error');
      };

      socket.onclose = () => {
        if (unmountedRef.current) return;
        wsRef.current = null;
        setWsStatus('disconnected');
        // Our own cleanup detaches onclose first, so any close seen here came from the server/network.
        if (shouldReconnect({ closedByClient: false, unmounted: unmountedRef.current })) {
          scheduleReconnect(connect);
        }
      };
    } catch {
      if (!unmountedRef.current) {
        setWsStatus('error');
        scheduleReconnect(connect);
      }
    }
  }, [setJobs, setWsStatus, clearReconnectTimer, cleanupSocket, scheduleReconnect]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      cleanupSocket();
    };
  }, [connect, clearReconnectTimer, cleanupSocket]);

  // Reconnect immediately when the network or the tab comes back.
  useEffect(() => {
    const reconnectNow = () => {
      if (unmountedRef.current) return;
      attemptRef.current = 0;
      connect();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconnectNow();
    };
    window.addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', reconnectNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect]);
}
