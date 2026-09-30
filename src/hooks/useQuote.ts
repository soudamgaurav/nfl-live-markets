import { useCallback, useSyncExternalStore } from 'react';
import { quoteStore } from '../lib/live';
import type { Quote } from '../lib/quoteStore';

/** Subscribe a component to a single asset's quote and nothing else. */
export function useQuote(assetId: string): Quote {
  const subscribe = useCallback((cb: () => void) => quoteStore.subscribe(assetId, cb), [assetId]);
  const getSnapshot = useCallback(() => quoteStore.get(assetId), [assetId]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
