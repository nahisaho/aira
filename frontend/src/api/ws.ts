export type WSEventType =
  | { type: 'status'; runId: string; status: string }
  | { type: 'log'; message: string; timestamp: string }
  | { type: 'chunk'; content: string }
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
      this.ws.close();
      this.ws = null;
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

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._status = 'connected';
      this.reconnectDelay = INITIAL_DELAY;
      this.notify({ type: 'status', runId: '', status: 'connected' });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEventType;
        this.notify(data);
      } catch {
        // Ignore invalid messages
      }
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) {
        this._status = 'disconnected';
        return;
      }

      this._status = 'reconnecting';
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
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

  private notify(event: WSEventType): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}

export const wsClient = new WebSocketClient();
