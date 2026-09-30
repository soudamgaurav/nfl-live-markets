// A tiny external store keyed by asset id.
//
// Why not React state? A busy game can push dozens of price changes a second.
// Keeping quotes outside React and letting each row subscribe to *its own*
// asset means an update to "O/U 44.5 Over" re-renders exactly one row, never
// the table. Notifications are coalesced into one flush per animation frame.

export interface Quote {
  bestBid: number | null;
  bestAsk: number | null;
  lastTrade: number | null;
  lastTradeSide: 'BUY' | 'SELL' | null;
  tickSize: number;
  updatedAt: number | null;
}

export type QuotePatch = Partial<Omit<Quote, 'updatedAt'>>;

const DEFAULT_TICK = 0.01;

export const EMPTY_QUOTE: Quote = Object.freeze({
  bestBid: null,
  bestAsk: null,
  lastTrade: null,
  lastTradeSide: null,
  tickSize: DEFAULT_TICK,
  updatedAt: null,
});

type Listener = () => void;

const schedule: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16);

export class QuoteStore {
  private quotes = new Map<string, Quote>();
  private seeded = new Set<string>();
  private listeners = new Map<string, Set<Listener>>();
  private dirty = new Set<string>();
  private flushQueued = false;

  /** Replace the set of assets we care about. Anything else is dropped. */
  track(assetIds: string[]): void {
    const next = new Set(assetIds);
    for (const id of [...this.quotes.keys()]) {
      if (!next.has(id)) {
        this.quotes.delete(id);
        this.seeded.delete(id);
      }
    }
    for (const id of next) {
      if (!this.quotes.has(id)) {
        this.quotes.set(id, EMPTY_QUOTE);
        this.markDirty(id);
      }
    }
  }

  isTracked(assetId: string): boolean {
    return this.quotes.has(assetId);
  }

  isSeeded(assetId: string): boolean {
    return this.seeded.has(assetId);
  }

  markSeeded(assetId: string): void {
    this.seeded.add(assetId);
  }

  /** After a reconnect the server sends fresh books; let them seed again. */
  clearSeeded(): void {
    this.seeded.clear();
  }

  get(assetId: string): Quote {
    return this.quotes.get(assetId) ?? EMPTY_QUOTE;
  }

  /** Returns true if something visible actually changed. */
  patch(assetId: string, changes: QuotePatch): boolean {
    const prev = this.quotes.get(assetId);
    if (!prev) return false; // stale message for an asset we've moved away from

    let changed = false;
    for (const key of Object.keys(changes) as (keyof QuotePatch)[]) {
      if (changes[key] !== undefined && changes[key] !== prev[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return false;

    const next: Quote = { ...prev, updatedAt: Date.now() };
    for (const key of Object.keys(changes) as (keyof QuotePatch)[]) {
      const value = changes[key];
      if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value;
    }
    this.quotes.set(assetId, next);
    this.markDirty(assetId);
    return true;
  }

  subscribe(assetId: string, listener: Listener): () => void {
    let set = this.listeners.get(assetId);
    if (!set) {
      set = new Set();
      this.listeners.set(assetId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(assetId);
    };
  }

  /** Exposed for tests; normally runs once per frame. */
  flush = (): void => {
    this.flushQueued = false;
    const ids = [...this.dirty];
    this.dirty.clear();
    for (const id of ids) this.listeners.get(id)?.forEach((fn) => fn());
  };

  private markDirty(assetId: string): void {
    this.dirty.add(assetId);
    if (!this.flushQueued) {
      this.flushQueued = true;
      schedule(this.flush);
    }
  }
}
