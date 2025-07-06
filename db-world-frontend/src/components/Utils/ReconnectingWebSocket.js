import { useEffect, useRef, useState, useCallback } from 'react';

export const useReconnectingWebSocket = (url, {
  pingInterval = 15000,
  timeout = 30000,
  reconnectDelay = 2000,
  onMessage,
  onOpen,
  onClose,
  onError
} = {}) => {
  const wsRef = useRef(null);
  const pingTimer = useRef(null);
  const timeoutTimer = useRef(null);
  const reconnectTimer = useRef(null);
  const [connected, setConnected] = useState(false);

  const stopPing = () => {
    clearInterval(pingTimer.current);
    clearTimeout(timeoutTimer.current);
  };

  const startPing = () => {
    stopPing();
    pingTimer.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, pingInterval);

    timeoutTimer.current = setTimeout(() => {
      console.warn("No pong received, closing stale socket");
      wsRef.current?.close();
    }, timeout);
  };

  const connect = useCallback(() => {
    if (wsRef.current) return;

    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = (event) => {
      setConnected(true);
      onOpen?.(event);
      startPing();
    };

    wsRef.current.onmessage = (event) => {
      if (event.data === 'pong') return;

      clearTimeout(timeoutTimer.current);
      timeoutTimer.current = setTimeout(() => {
        wsRef.current?.close();
      }, timeout);

      onMessage?.(event);
    };

    wsRef.current.onerror = (error) => {
      onError?.(error);
    };

    wsRef.current.onclose = (event) => {
      setConnected(false);
      onClose?.(event);
      stopPing();
      wsRef.current = null;

      reconnectTimer.current = setTimeout(() => {
        connect();
      }, reconnectDelay);
    };
  }, [url, onMessage, onOpen, onClose, onError, pingInterval, timeout, reconnectDelay]);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      stopPing();
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return {
    send,
    connected,
    readyState: wsRef.current?.readyState ?? WebSocket.CLOSED
  };
};
