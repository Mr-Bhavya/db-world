import { useCallback, useEffect, useRef, useState } from "react";

export const useWebSocket = (url, onMessage) => {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  
  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const socket = new WebSocket(url);
    
    socket.onopen = () => {
      setIsConnected(true);
      setWs(socket);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = () => {
      setIsConnected(false);
      setWs(null);
      reconnectTimeoutRef.current = setTimeout(() => connect(), 5000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return socket;
  }, [url, onMessage]);

  useEffect(() => {
    const socket = connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socket) socket.close();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    if (ws) ws.close();
    else connect();
  }, [ws, connect]);

  return { isConnected, reconnect };
};