// utils/ReconnectingWebSocket.js
export class ReconnectingWebSocket {
  constructor(url, protocols = []) {
    this.url = url;
    this.protocols = protocols;
    this.ws = null;
    this.forcedClose = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds initial
    this.listeners = {
      open: [],
      message: [],
      close: [],
      error: []
    };
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url, this.protocols);
    
    this.ws.onopen = (event) => {
      this.reconnectAttempts = 0;
      this.listeners.open.forEach(cb => cb(event));
    };
    
    this.ws.onmessage = (event) => {
      this.listeners.message.forEach(cb => cb(event));
    };
    
    this.ws.onclose = (event) => {
      this.listeners.close.forEach(cb => cb(event));
      
      if (!this.forcedClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(
          this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
          30000 // Max 30 seconds
        );
        
        setTimeout(() => {
          this.reconnectAttempts += 1;
          this.connect();
        }, delay);
      }
    };
    
    this.ws.onerror = (error) => {
      this.listeners.error.forEach(cb => cb(error));
    };
  }

  // Add event listeners
  onopen(callback) {
    this.listeners.open.push(callback);
    return this;
  }

  onmessage(callback) {
    this.listeners.message.push(callback);
    return this;
  }

  onclose(callback) {
    this.listeners.close.push(callback);
    return this;
  }

  onerror(callback) {
    this.listeners.error.push(callback);
    return this;
  }

  // Send data if connection is open
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  // Close connection (won't attempt to reconnect)
  close() {
    this.forcedClose = true;
    if (this.ws) {
      this.ws.close();
    }
  }

  // Get current readyState
  getReadyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  // Check if connection is open
  isOpen() {
    return this.getReadyState() === WebSocket.OPEN;
  }
}