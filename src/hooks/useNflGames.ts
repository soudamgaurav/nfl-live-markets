import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActiveNflEvents } from '../lib/gamma';
import { selectGames, type Game } from '../lib/markets';

export type GamesState =
  | { status: 'loading'; games: Game[] }
  | { status: 'ready'; games: Game[] }
  | { status: 'error'; games: Game[]; message: string };

export function useNflGames(): GamesState & { reload: () => void } {
  const [state, setState] = useState<GamesState>({ status: 'loading', games: [] });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState((s) => ({ status: 'loading', games: s.games }));

    fetchActiveNflEvents(ctrl.signal)
      .then((events) => {
        if (!ctrl.signal.aborted) setState({ status: 'ready', games: selectGames(events) });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Could not reach Polymarket.';
        setState((s) => ({ status: 'error', games: s.games, message }));
      });
  }, []);

  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
