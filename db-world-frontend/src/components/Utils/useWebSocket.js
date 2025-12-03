import { useCallback, useEffect, useRef, useState } from "react";

export const useWebSocket = (url, onMessage, onError) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef([]);
  const maxReconnectAttempts = 5;

  // Memoize handlers via refs (prevents re-creation on every render)
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) {
      console.log("⚡ Existing WebSocket still open or connecting, skipping new connection");
      return;
    }

    console.log(`🔄 Connecting WebSocket: ${url}`);

    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;

      // Flush queued messages
      while (messageQueueRef.current.length > 0) {
        const msg = messageQueueRef.current.shift();
        try {
          socket.send(JSON.stringify(msg));
        } catch (err) {
          console.error("Error sending queued message:", err);
        }
      }
    };

    socket.onmessage = (event) => {
      if (onMessageRef.current) onMessageRef.current(event);
    };

    socket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setConnectionError("WebSocket connection error");
      if (onErrorRef.current) onErrorRef.current(error);
    };

    socket.onclose = (event) => {
      console.warn("🔴 WebSocket closed:", event);
      setIsConnected(false);

      if (event.code !== 1000) {
        // Attempt reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000);
          reconnectAttemptsRef.current++;
          console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setConnectionError("Max reconnect attempts reached.");
        }
      }
    };
  }, [url]);

  const sendMessage = useCallback((message) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
        console.log("📤 Sent message:", message);
        return true;
      } catch (err) {
        console.error("❌ Failed to send message:", err);
        return false;
      }
    } else {
      messageQueueRef.current.push(message);
      console.log("⏳ Queued message, socket not ready:", message);
      return false;
    }
  }, []);

  const reconnect = useCallback(() => {
    console.log("🔄 Manual reconnect triggered");
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectAttemptsRef.current = 0;
    setConnectionError(null);
    if (wsRef.current) wsRef.current.close();
    else connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    console.log("🔌 Disconnecting WebSocket");
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect, url]);

  return { isConnected, connectionError, sendMessage, reconnect, disconnect };
};
