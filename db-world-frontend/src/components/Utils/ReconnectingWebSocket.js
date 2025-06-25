export class ReconnectingWebSocket {
  constructor(url, protocols = []) {
    this.url = url;
    this.protocols = protocols;
    this.ws = null;
    this.forcedClose = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;

    // User-assigned handlers
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;

    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url, this.protocols);

    this.ws.onopen = (event) => {
      this.reconnectAttempts = 0;
      if (this.onopen) this.onopen(event);
    };

    this.ws.onmessage = (event) => {
      if (this.onmessage) this.onmessage(event);
    };

    this.ws.onclose = (event) => {
      if (this.onclose) this.onclose(event);

      if (!this.forcedClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(
          this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
          30000
        );

        setTimeout(() => {
          this.reconnectAttempts += 1;
          this.connect();
        }, delay);
      }
    };

    this.ws.onerror = (error) => {
      if (this.onerror) this.onerror(error);
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  close() {
    this.forcedClose = true;
    if (this.ws) {
      this.ws.close();
    }
  }

  getReadyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  isOpen() {
    return this.getReadyState() === WebSocket.OPEN;
  }
}
