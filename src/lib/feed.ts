import type { QuotePatch, QuoteStore } from './quoteStore';

// Handlers for the four CLOB market-channel messages we care about.
// The server sometimes batches messages into an array (the initial dump does),
// so everything funnels through applyFeedMessage.

type Level = { price?: string | number };

interface BookMessage {
  event_type: 'book';
  asset_id: string;
  bids?: Level[];
  asks?: Level[];
  // Older payloads used buys/sells; harmless to accept both.
  buys?: Level[];
  sells?: Level[];
  last_trade_price?: string;
  tick_size?: string;
}

interface PriceChangeMessage {
  event_type: 'price_change';
  price_changes?: { asset_id: string; best_bid?: string; best_ask?: string }[];
}

interface LastTradeMessage {
  event_type: 'last_trade_price';
  asset_id: string;
  price?: string;
  side?: string;
}

interface TickSizeMessage {
  event_type: 'tick_size_change';
  asset_id: string;
  new_tick_size?: string;
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function extreme(levels: Level[] | undefined, pick: 'max' | 'min'): number | null {
  if (!levels?.length) return null;
  let best: number | null = null;
  for (const level of levels) {
    const price = toNumber(level.price);
    if (price === undefined) continue;
    if (best === null || (pick === 'max' ? price > best : price < best)) best = price;
  }
  return best;
}

function applyBook(msg: BookMessage, store: QuoteStore): boolean {
  // The book is only needed once per asset to seed the row. After that the
  // price_change deltas carry best bid/ask directly.
  if (!store.isTracked(msg.asset_id) || store.isSeeded(msg.asset_id)) return false;

  const patch: QuotePatch = {
    // Don't trust the sort order of the arrays; scan for the real extremes.
    bestBid: extreme(msg.bids ?? msg.buys, 'max'),
    bestAsk: extreme(msg.asks ?? msg.sells, 'min'),
  };
  const last = toNumber(msg.last_trade_price);
  if (last !== undefined) patch.lastTrade = last;
  const tick = toNumber(msg.tick_size);
  if (tick !== undefined && tick > 0) patch.tickSize = tick;

  store.markSeeded(msg.asset_id);
  store.patch(msg.asset_id, patch);
  return true;
}

function applyPriceChange(msg: PriceChangeMessage, store: QuoteStore): boolean {
  let applied = false;
  for (const change of msg.price_changes ?? []) {
    const bestBid = toNumber(change.best_bid);
    const bestAsk = toNumber(change.best_ask);
    applied = store.patch(change.asset_id, { bestBid, bestAsk }) || applied;
  }
  return applied;
}

function applyLastTrade(msg: LastTradeMessage, store: QuoteStore): boolean {
  const price = toNumber(msg.price);
  if (price === undefined) return false;
  const side = msg.side === 'BUY' || msg.side === 'SELL' ? msg.side : null;
  return store.patch(msg.asset_id, { lastTrade: price, lastTradeSide: side });
}

function applyTickSize(msg: TickSizeMessage, store: QuoteStore): boolean {
  const tick = toNumber(msg.new_tick_size);
  if (tick === undefined || tick <= 0) return false;
  return store.patch(msg.asset_id, { tickSize: tick });
}

export function applyFeedMessage(payload: unknown, store: QuoteStore): void {
  if (Array.isArray(payload)) {
    for (const item of payload) applyFeedMessage(item, store);
    return;
  }
  if (!payload || typeof payload !== 'object') return;

  const msg = payload as { event_type?: string };
  switch (msg.event_type) {
    case 'book':
      applyBook(msg as BookMessage, store);
      break;
    case 'price_change':
      applyPriceChange(msg as PriceChangeMessage, store);
      break;
    case 'last_trade_price':
      applyLastTrade(msg as LastTradeMessage, store);
      break;
    case 'tick_size_change':
      applyTickSize(msg as TickSizeMessage, store);
      break;
    default:
      // best_bid_ask, new_market, etc. — not needed for this board.
      break;
  }
}
