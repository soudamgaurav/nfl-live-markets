import { applyFeedMessage } from './feed';
import { MarketSocket } from './marketSocket';
import { QuoteStore } from './quoteStore';

// App-wide singletons. One socket for the whole session keeps subscription
// switching on a single connection, and survives React StrictMode's
// double-mount in development.
export const quoteStore = new QuoteStore();

export const marketSocket = new MarketSocket({
  onMessage: (payload) => applyFeedMessage(payload, quoteStore),
  onDisconnect: () => quoteStore.clearSeeded(),
});
