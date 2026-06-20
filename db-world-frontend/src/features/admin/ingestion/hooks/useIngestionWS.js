import { useEffect, useRef, useCallback } from 'react';
import useIngestionStore from '../store/ingestionStore';
import { resolveWsUrl, showResolvedUrlsAlert } from '@shared/config/apiBaseUrl';

const RECONNECT_DELAY = 5000;

/**
 * Manages the WebSocket connection to /ws/status.
 * Parses the server broadcast (jobId -> JobSnapshot map)
 * and writes it into the Zustand store.
 */
export function useIngestionWS() {
  const setJobs = useIngestionStore((s) => s.setJobs);
  const setWsStatus = useIngestionStore((s) => s.setWsStatus);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const unmountedRef = useRef(false);
  const alertShownRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    if (!wsRef.current) return;

    wsRef.current.onopen = null;
    wsRef.current.onmessage = null;
    wsRef.current.onerror = null;
    wsRef.current.onclose = null;

    try {
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close(1000, 'cleanup');
      }
    } catch {
      // ignore cleanup close errors
    }

    wsRef.current = null;
  }, []);

  const scheduleReconnect = useCallback((connectFn) => {
    if (unmountedRef.current || reconnectRef.current) return;

    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connectFn();
    }, RECONNECT_DELAY);
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // Prevent duplicate active connections
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    cleanupSocket();

    const wsUrl = resolveWsUrl('/ws/status');

    setWsStatus('connecting');

    // Show alert only once because logs may not be visible on mobile
    if (!alertShownRef.current) {
      showResolvedUrlsAlert('/ws/status');
      alertShownRef.current = true;
    }

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (unmountedRef.current) return;
        clearReconnectTimer();
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        if (unmountedRef.current) return;

        try {
          // Backend sends:
          // { jobId: { jobId, status, step, sourceType, fileName, uri, progress, ... } }
          const data = JSON.parse(event.data);
          setJobs(data);
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onerror = () => {
        if (unmountedRef.current) return;
        setWsStatus('error');
      };

      socket.onclose = (event) => {
        if (unmountedRef.current) return;

        wsRef.current = null;
        setWsStatus('disconnected');

        // 1000 = normal close -> do not reconnect
        if (event.code !== 1000) {
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

  // 1) Initial mount + unmount cleanup
  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      cleanupSocket();
    };
  }, [connect, clearReconnectTimer, cleanupSocket]);

  // 2) Reconnect when device/network comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (!unmountedRef.current) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [connect]);

  // 3) Reconnect when app/tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !unmountedRef.current) {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    
  }, [connect]);
}