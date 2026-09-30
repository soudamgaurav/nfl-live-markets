import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketSocket } from '../marketSocket';

class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  json() {
    return this.sent.filter((s) => s !== 'PING').map((s) => JSON.parse(s));
  }
}

let sockets: FakeSocket[];
let messages: unknown[];
let socket: MarketSocket;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
  sockets = [];
  messages = [];
  socket = new MarketSocket({
    onMessage: (m) => messages.push(m),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s as unknown as WebSocket;
    },
  });
});

afterEach(() => {
  socket.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MarketSocket', () => {
  it('sends the market handshake with initial_dump once open', () => {
    socket.setAssets(['a', 'b']);
    expect(sockets).toHaveLength(1);
    sockets[0].open();
    expect(sockets[0].json()).toEqual([{ assets_ids: ['a', 'b'], type: 'market', initial_dump: true }]);
    expect(socket.getStatus()).toBe('live');
  });

  it('switches games on the same connection by diffing subscriptions', () => {
    socket.setAssets(['a', 'b']);
    sockets[0].open();
    socket.setAssets(['c', 'd']);

    expect(sockets).toHaveLength(1);
    expect(sockets[0].json().slice(1)).toEqual([
      { operation: 'unsubscribe', assets_ids: ['a', 'b'] },
      { operation: 'subscribe', assets_ids: ['c', 'd'], initial_dump: true },
    ]);
  });

  it('pings every 10 seconds and ignores PONG', () => {
    socket.setAssets(['a']);
    sockets[0].open();
    vi.advanceTimersByTime(30_000);
    expect(sockets[0].sent.filter((s) => s === 'PING')).toHaveLength(3);

    sockets[0].onmessage?.({ data: 'PONG' });
    sockets[0].onmessage?.({ data: '{"event_type":"book"}' });
    expect(messages).toEqual([{ event_type: 'book' }]);
  });

  it('reconnects after a drop and resubscribes to the current game', () => {
    socket.setAssets(['a']);
    sockets[0].open();
    socket.setAssets(['x', 'y']);
    sockets[0].close();
    expect(socket.getStatus()).toBe('reconnecting');

    vi.advanceTimersByTime(20_000);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(sockets[1].json()).toEqual([{ assets_ids: ['x', 'y'], type: 'market', initial_dump: true }]);
  });
});
