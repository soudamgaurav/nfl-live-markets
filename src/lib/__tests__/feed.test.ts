import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFeedMessage } from '../feed';
import { QuoteStore } from '../quoteStore';

let store: QuoteStore;

beforeEach(() => {
  store = new QuoteStore();
  store.track(['A', 'B']);
  store.flush();
});

const book = (asset: string, extra: object = {}) => ({
  event_type: 'book',
  asset_id: asset,
  // Deliberately unsorted: we must scan for the real best levels.
  bids: [{ price: '0.48', size: '10' }, { price: '0.52', size: '5' }, { price: '0.50', size: '1' }],
  asks: [{ price: '0.58', size: '3' }, { price: '0.55', size: '9' }],
  last_trade_price: '0.53',
  tick_size: '0.01',
  ...extra,
});

describe('book', () => {
  it('seeds best bid (max), best ask (min), last trade and tick size', () => {
    applyFeedMessage(book('A'), store);
    expect(store.get('A')).toMatchObject({ bestBid: 0.52, bestAsk: 0.55, lastTrade: 0.53, tickSize: 0.01 });
  });

  it('handles the initial dump arriving as an array', () => {
    applyFeedMessage([book('A'), book('B', { tick_size: '0.001' })], store);
    expect(store.get('B').tickSize).toBe(0.001);
    expect(store.get('A').bestBid).toBe(0.52);
  });

  it('is only applied once per asset', () => {
    applyFeedMessage(book('A'), store);
    applyFeedMessage(book('A', { bids: [{ price: '0.10' }] }), store);
    expect(store.get('A').bestBid).toBe(0.52);
  });

  it('re-seeds after a reconnect', () => {
    applyFeedMessage(book('A'), store);
    store.clearSeeded();
    applyFeedMessage(book('A', { bids: [{ price: '0.40' }] }), store);
    expect(store.get('A').bestBid).toBe(0.4);
  });

  it('treats an empty side as no quote', () => {
    applyFeedMessage(book('A', { asks: [] }), store);
    expect(store.get('A').bestAsk).toBeNull();
  });
});

describe('price_change', () => {
  it('reads best_bid / best_ask straight from each item', () => {
    applyFeedMessage(book('A'), store);
    applyFeedMessage(
      {
        event_type: 'price_change',
        price_changes: [
          { asset_id: 'A', price: '0.53', side: 'BUY', best_bid: '0.53', best_ask: '0.55' },
          { asset_id: 'B', price: '0.44', side: 'SELL', best_bid: '0.41', best_ask: '0.44' },
        ],
      },
      store,
    );
    expect(store.get('A')).toMatchObject({ bestBid: 0.53, bestAsk: 0.55, lastTrade: 0.53 });
    expect(store.get('B')).toMatchObject({ bestBid: 0.41, bestAsk: 0.44 });
  });

  it('ignores assets we are no longer tracking', () => {
    applyFeedMessage({ event_type: 'price_change', price_changes: [{ asset_id: 'OLD', best_bid: '0.2' }] }, store);
    expect(store.isTracked('OLD')).toBe(false);
  });
});

describe('last_trade_price and tick_size_change', () => {
  it('updates the last trade', () => {
    applyFeedMessage({ event_type: 'last_trade_price', asset_id: 'A', price: '0.61', side: 'BUY', size: '20' }, store);
    expect(store.get('A')).toMatchObject({ lastTrade: 0.61, lastTradeSide: 'BUY' });
  });

  it('updates tick size', () => {
    applyFeedMessage({ event_type: 'tick_size_change', asset_id: 'A', old_tick_size: '0.01', new_tick_size: '0.001' }, store);
    expect(store.get('A').tickSize).toBe(0.001);
  });
});

describe('render isolation', () => {
  it('notifies only the listener for the asset that changed, once per flush', () => {
    const onA = vi.fn();
    const onB = vi.fn();
    store.subscribe('A', onA);
    store.subscribe('B', onB);

    applyFeedMessage({ event_type: 'last_trade_price', asset_id: 'A', price: '0.60' }, store);
    applyFeedMessage({ event_type: 'last_trade_price', asset_id: 'A', price: '0.61' }, store);
    store.flush();

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
    expect(store.get('A').lastTrade).toBe(0.61);
  });

  it('does not notify when nothing actually changed', () => {
    const onA = vi.fn();
    store.subscribe('A', onA);
    applyFeedMessage({ event_type: 'last_trade_price', asset_id: 'A', price: '0.60' }, store);
    store.flush();
    applyFeedMessage({ event_type: 'price_change', price_changes: [{ asset_id: 'A' }] }, store);
    store.flush();
    expect(onA).toHaveBeenCalledTimes(1);
  });
});
