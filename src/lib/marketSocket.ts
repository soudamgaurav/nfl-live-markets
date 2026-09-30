// One long-lived WebSocket to the CLOB market channel.
//
// - The first subscription after (re)connecting uses the documented
//   {assets_ids, type: "market", initial_dump: true} handshake.
// - Switching games diffs the old and new asset sets and sends
//   unsubscribe/subscribe operations on the same connection.
// - A literal "PING" goes out every 10s; the server answers "PONG".
// - Drops reconnect with capped exponential backoff and resubscribe.

export const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

const PING_INTERVAL_MS = 10_000;
const MAX_BACKOFF_MS = 15_000;

export type SocketStatus = 'idle' | 'connecting' | 'live' | 'reconnecting';

export interface MarketSocketOptions {
  url?: string;
  onMessage: (payload: unknown) => void;
  /** Called when a connection drops, before we try again. */
  onDisconnect?: () => void;
  /** Injected in tests. */
  createSocket?: (url: string) => WebSocket;
}

export class MarketSocket {
  private ws: WebSocket | null = null;
  private wanted: string[] = [];
  private subscribed = new Set<string>();
  private handshakeSent = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private disposed = false;

  private status: SocketStatus = 'idle';
  private statusListeners = new Set<() => void>();
  lastMessageAt: number | null = null;

  private readonly url: string;
  private readonly createSocket: (url: string) => WebSocket;

  constructor(private readonly options: MarketSocketOptions) {
    this.url = options.url ?? CLOB_WS_URL;
    this.createSocket = options.createSocket ?? ((u) => new WebSocket(u));
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.reconnectNow);
    }
  }

  getStatus = (): SocketStatus => this.status;

  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  /** Declare which assets we want. Safe to call at any socket state. */
  setAssets(assetIds: string[]): void {
    this.wanted = [...new Set(assetIds)];
    if (!this.ws) {
      if (this.wanted.length) this.connect();
      return;
    }
    if (this.ws.readyState === WebSocket.OPEN) this.syncSubscriptions();
    // If still connecting, onopen will pick up `wanted`.
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    if (typeof window !== 'undefined') window.removeEventListener('online', this.reconnectNow);
    this.ws?.close();
    this.ws = null;
  }

  private connect(): void {
    this.clearTimers();
    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');

    const ws = this.createSocket(this.url);
    this.ws = ws;
    ws.onopen = () => this.handleOpen(ws);
    ws.onmessage = (event) => this.handleMessage(event);
    ws.onclose = () => this.handleClose(ws);
    ws.onerror = () => {
      // onclose always follows; reconnect logic lives there.
    };
  }

  private handleOpen(ws: WebSocket): void {
    if (ws !== this.ws) return;
    this.attempts = 0;
    this.subscribed.clear();
    this.handshakeSent = false;
    this.setStatus('live');
    this.pingTimer = setInterval(() => this.send('PING'), PING_INTERVAL_MS);
    this.syncSubscriptions();
  }

  private syncSubscriptions(): void {
    const next = new Set(this.wanted);

    if (!this.handshakeSent) {
      if (next.size === 0) return;
      this.send({ assets_ids: [...next], type: 'market', initial_dump: true });
      this.handshakeSent = true;
      this.subscribed = next;
      return;
    }

    const removed = [...this.subscribed].filter((id) => !next.has(id));
    const added = [...next].filter((id) => !this.subscribed.has(id));

    if (removed.length) this.send({ operation: 'unsubscribe', assets_ids: removed });
    if (added.length) this.send({ operation: 'subscribe', assets_ids: added, initial_dump: true });
    this.subscribed = next;
  }

  private handleMessage(event: MessageEvent): void {
    this.lastMessageAt = Date.now();
    const data = event.data;
    if (typeof data !== 'string' || data === 'PONG' || data === '') return;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return; // not JSON; nothing we handle
    }
    this.options.onMessage(payload);
  }

  private handleClose(ws: WebSocket): void {
    if (ws !== this.ws) return;
    this.clearTimers();
    this.ws = null;
    this.subscribed.clear();
    this.handshakeSent = false;
    this.options.onDisconnect?.();
    if (this.disposed) return;

    this.attempts += 1;
    this.setStatus('reconnecting');
    const backoff = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts);
    const jitter = Math.random() * 400;
    this.retryTimer = setTimeout(() => this.connect(), backoff + jitter);
  }

  private reconnectNow = (): void => {
    if (this.disposed || this.status === 'live' || !this.wanted.length) return;
    this.ws?.close();
    this.ws = null;
    this.connect();
  };

  private send(message: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  private clearTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.retryTimer = null;
  }

  private setStatus(status: SocketStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.statusListeners.forEach((fn) => fn());
  }
}
