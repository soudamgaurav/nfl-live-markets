# NFL Live Markets

A real-time dashboard for Polymarket NFL game markets. Pick a game and watch the
moneyline and every full-game over/under line update live, straight from
Polymarket's public Gamma REST API and CLOB WebSocket. No backend, no proxy.

Built with React 18, TypeScript and Vite.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
```

Node 18+ is required.

## What it does

- **Game selection.** Walks `/events?tag_slug=nfl&active=true&closed=false` in
  pages of 100 until a short page comes back, keeps only slugs matching
  `^nfl-[a-z]{2,4}-[a-z]{2,4}-\d{4}-\d{2}-\d{2}$`, and de-duplicates across
  pages. Games are grouped by day in the left rail, with a team search once the
  slate is long. The selected game is kept in the URL hash, so a view can be
  bookmarked or shared.
- **Market scope.** Moneyline is the one market whose `question` equals the
  event title. Totals are every market matching `"{title}: O/U {number}"`
  exactly, so team totals, 1H/2H/quarter lines and props fall out. Totals are
  sorted by line. `outcomes` and `clobTokenIds` arrive as JSON strings and are
  paired by index; a market whose counts don't match is skipped instead of
  producing wrong rows.
- **Live table.** One row per outcome token: Outcome (question + label), Best
  bid, Best ask, Last trade, Spread.
- **Streaming.** One WebSocket for the whole session.
  - `book` seeds best bid (highest price in `bids[]`), best ask (lowest price in
    `asks[]`), `last_trade_price` and `tick_size`. The arrays are scanned rather
    than assuming sort order. A book is applied once per asset; after a
    reconnect the next book re-seeds.
  - `price_change` reads each item's own `best_bid` / `best_ask`.
  - `last_trade_price` updates the last trade from `price`.
  - `tick_size_change` updates the tick used for rounding and display.
  - A literal `PING` every 10 seconds; `PONG` replies are ignored.
  - Switching games diffs the old and new token sets and sends `unsubscribe`
    and `subscribe` on the same connection.
  - Dropped connections reconnect with capped exponential backoff (plus jitter)
    and resubscribe to whatever game is on screen. Going back online triggers
    an immediate retry.
- **Flashes.** Cells flash green when a value rises and red when it falls, then
  fade over 500ms. With reduced motion enabled, the color change stays but the
  fade is dropped.

## How updates stay cheap

The brief asks for no full-table re-renders, so quotes don't live in React
state at all.

`QuoteStore` is a small external store keyed by asset id. Each `QuoteRow`
subscribes to only its own asset through `useSyncExternalStore`. When a
`price_change` for "O/U 44.5 Over" arrives, only that row re-renders; the table,
the other rows and the header don't. Notifications are coalesced into one flush
per animation frame, so a burst of ten messages for the same asset costs one
render. Updates that don't actually change a visible value are dropped before
they reach React. Messages for assets from a previously selected game are
ignored.

The "updated Xs ago" badge ticks every second on its own, again without
touching the table.

## Display choices

Prices are shown in cents (0.53 → `53¢`), which reads directly as implied
probability. Precision follows the tick size: a 0.01 tick shows `53¢`, a 0.001
tick shows `53.1¢`. Spread is computed from the tick-rounded ask and bid so
floating-point noise can't show up as `2.9999¢` or trigger a false flash.

Markets flagged `closed: true` inside an open event are left out, since they
can't be traded and never stream.

## Project layout

```
src/
  lib/
    gamma.ts          Gamma REST client with offset pagination
    markets.ts        slug filter, moneyline/totals selection, parsing
    feed.ts           handlers for book / price_change / last_trade_price / tick_size_change
    quoteStore.ts     per-asset external store with frame-batched notifications
    marketSocket.ts   connection, handshake, subscription diffing, ping, reconnect
    live.ts           app-wide store and socket instances
    format.ts         tick rounding, cents formatting, dates
    __tests__/        Vitest suites for all of the above
  hooks/              useQuote, useNflGames, useSocketStatus
  components/         GameList, MarketBoard, QuoteRow, FlashCell, ConnectionStatus
```

## Tests

27 unit tests cover the slug filter and market selection (including titles with
regex characters and malformed token lists), every feed message type,
book-once seeding and re-seeding after reconnect, per-asset render isolation,
tick rounding, and the socket's handshake, subscription diffing, ping interval
and reconnect-then-resubscribe path (using a fake WebSocket).

## If I had more time

- Virtualize the table if a game ever lists far more lines than it does today.
- Highlight the "main" total line (the one priced closest to 50¢).
- An end-to-end test against a recorded feed.

## AI tool usage

<!-- The assignment asks for this. Edit to reflect exactly how you worked. -->

I used Claude (Anthropic, Claude Opus 5.5) during this assignment. It helped
with the unit tests, and this README from the
assignment brief. I have implemented the code, ran the test suite and build, checked
the behavior against the live Polymarket feed, and made the final decisions on
structure and scope.
"# nfl-live-markets" 
