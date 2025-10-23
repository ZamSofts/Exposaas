const DEFAULT_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000";

class WSClient {
  constructor() {
    this.ws = null;
    this.session = null; // { id, username, companyId }
    this.subscribers = new Set();
    this.queue = [];
    this.isConnecting = false;
    this.connectedSessionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimer = null;
  }

  isConnected() {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  connect(session) {
    if (!session || !session.id) return;

    if (this.connectedSessionId === session.id && this.isConnected()) return;

    if (this.isConnecting && this.connectedSessionId === session.id) return;

    this.session = session;
    // Clear any previous timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this._createSocket();
  }

  _createSocket() {
    if (!this.session || !this.session.id) return;
    if (this.isConnecting) return;

    this.isConnecting = true;
    const url = DEFAULT_URL;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('wsClient: failed to create WebSocket', e);
      this.isConnecting = false;
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectedSessionId = this.session?.id || null;

      // send join message
      try {
        this.ws.send(JSON.stringify({
          type: 'join',
          userId: this.session.id,
          username: this.session.username,
          companyId: this.session.companyId,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('wsClient: failed to send join', e);
      }

      // flush queue
      while (this.queue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const item = this.queue.shift();
        try {
          this.ws.send(JSON.stringify(item));
        } catch (e) {
          console.error('wsClient: failed to flush queued message', e);
          break;
        }
      }

      this._notify({ type: '__open' });
    };

    this.ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        this._notify(data);
      } catch (e) {
        console.error('wsClient: failed to parse incoming message', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      this._notify({ type: '__close' });
      // clear connectedSessionId only if it matches current session
      this.connectedSessionId = null;
      this._scheduleReconnect();
    };

    this.ws.onerror = err => {
      console.error('wsClient: socket error', err);
      this.isConnecting = false;
      // Let onclose handle reconnect
    };
  }

  _scheduleReconnect() {
    if (!this.session || !this.session.id) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts += 1;
    const timeout = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.session && this.session.id) this._createSocket();
    }, timeout);
  }

  send(payload) {
    if (!payload) return;
    const data = typeof payload === 'string' ? payload : payload;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(text);
      } catch (e) {
        console.error('wsClient: send failed', e);
      }
    } else {
      // queue until connected
      try {
        const toQueue = typeof data === 'string' ? JSON.parse(data) : data;
        this.queue.push(toQueue);
      } catch (e) {
        // if parse fails just push raw
        this.queue.push(data);
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.session = null;
    this.connectedSessionId = null;
    this.queue = [];
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect');
      } catch (e) {
        /* ignore */
      }
      this.ws = null;
    }
    this._notify({ type: '__close' });
  }

  subscribe(handler) {
    if (typeof handler !== 'function') return;
    this.subscribers.add(handler);
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          try { handler({ type: '__open' }); } catch (e) { /* ignore subscriber errors */ }
        }, 0);
      } else {
        setTimeout(() => {
          try { handler({ type: '__close' }); } catch (e) { /* ignore subscriber errors */ }
        }, 0);
      }
    } catch (e) {
      // ignore
    }
    return handler;
  }

  unsubscribe(handler) {
    if (!handler) return;
    this.subscribers.delete(handler);
  }

  _notify(data) {
    try {
      this.subscribers.forEach(fn => {
        try {
          fn(data);
        } catch (e) {
          console.error('wsClient subscriber error', e);
        }
      });
    } catch (e) {
      console.error('wsClient notify error', e);
    }
  }
}

const instance = new WSClient();
export default instance;
