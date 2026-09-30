import { useSyncExternalStore } from 'react';
import { marketSocket } from '../lib/live';

export function useSocketStatus() {
  return useSyncExternalStore(marketSocket.subscribeStatus, marketSocket.getStatus);
}
