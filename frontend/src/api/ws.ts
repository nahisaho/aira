export type WSEventType =
  | { type: 'status'; runId: string; status: string }
  | { type: 'log'; message: string; timestamp: string }
  | { type: 'chunk'; content: string }
  | { type: 'progress'; message: string }
  | { type: 'file_added'; file: { id: string; file_path: string; size_bytes: number } }
  | { type: 'file_modified'; file: { id: string; file_path: string; size_bytes: number } }
  | { type: 'file_deleted'; fileId: string }
  | { type: 'warning'; code: string; message: string };

type EventHandler = (event: WSEventType) => void;

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30_000;
const BACKOFF_FACTOR = 2;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectDelay = INITIAL_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private _status: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';

  get status() {
    return this._status;
  }

  connect(projectId: string): void {
    this.disconnect();
    this.projectId = projectId;
    this.intentionalClose = false;
    this.reconnectDelay = INITIAL_DELAY;
    this.doConnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      // Detach before close: the close event fires async, and by then a new
      // socket may exist (connect() right after disconnect()). The stale
      // handler must not schedule a reconnect — that produced two live sockets
      // per project and duplicated every streamed chunk.
      const sock = this.ws;
      this.ws = null;
      sock.close();
    }
    this._status = 'disconnected';
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private doConnect(): void {
    if (!this.projectId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/projects/${this.projectId}/chat`;

    const sock = new WebSocket(url);
    this.ws = sock;

    sock.onopen = () => {
      if (this.ws !== sock) return; // superseded by a newer connect()
      this._status = 'connected';
      this.reconnectDelay = INITIAL_DELAY;
      this.notify({ type: 'status', runId: '', status: 'connected' });
    };

    sock.onmessage = (event) => {
      if (this.ws !== sock) return; // stale socket — drop, don't double-dispatch
      try {
        const data = JSON.parse(event.data) as WSEventType;
        this.notify(data);
      } catch {
        // Ignore invalid messages
      }
    };

    sock.onclose = () => {
      if (this.ws !== sock) return; // stale socket — a newer one owns the state
      if (this.intentionalClose) {
        this._status = 'disconnected';
        return;
      }

      this._status = 'reconnecting';
      this.notify({ type: 'status', runId: '', status: 'reconnecting' });
      this.scheduleReconnect();
    };

    sock.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * BACKOFF_FACTOR,
      MAX_DELAY,
    );
  }

  /**
   * Send a frame if the socket is open. Returns false when the frame was
   * dropped (disconnected / reconnecting) so callers can reset UI state
   * instead of waiting forever for a run that never started.
   */
  send(data: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  private notify(event: WSEventType): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}

export const wsClient = new WebSocketClient();
