import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameList } from './components/GameList';
import { MarketBoard } from './components/MarketBoard';
import { useNflGames } from './hooks/useNflGames';
import type { Game } from './lib/markets';

function slugFromHash(): string | null {
  const slug = decodeURIComponent(window.location.hash.slice(1));
  return slug || null;
}

/** Default to the next game that hasn't kicked off, else the first listed. */
function defaultGame(games: Game[]): Game | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = games.find((g) =>
    g.kickoff ? g.kickoff.getTime() > Date.now() : g.gameDate >= today,
  );
  return upcoming ?? games[0];
}

export default function App() {
  const games = useNflGames();
  const [slug, setSlug] = useState<string | null>(slugFromHash);

  // The selected game lives in the URL hash so a view can be bookmarked or shared.
  useEffect(() => {
    const onHash = () => setSlug(slugFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = useCallback((next: string) => {
    window.location.hash = encodeURIComponent(next);
    setSlug(next);
  }, []);

  const game = useMemo(
    () => games.games.find((g) => g.slug === slug) ?? defaultGame(games.games),
    [games.games, slug],
  );

  const loadingFirstTime = games.status === 'loading' && games.games.length === 0;

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-head">
          <p className="brand">NFL live markets</p>
          <button
            type="button"
            className="refresh"
            onClick={games.reload}
            disabled={games.status === 'loading'}
          >
            {games.status === 'loading' ? 'Loading…' : 'Refresh games'}
          </button>
        </div>

        {games.status === 'error' && (
          <div className="notice" role="alert">
            <p>{games.message}</p>
            <button type="button" onClick={games.reload}>Try again</button>
          </div>
        )}

        {loadingFirstTime && <p className="rail-note">Loading this week’s games…</p>}
        {games.status === 'ready' && games.games.length === 0 && (
          <p className="rail-note">No NFL games are open for trading right now.</p>
        )}

        <GameList games={games.games} selectedSlug={game?.slug ?? null} onSelect={select} />
      </aside>

      <main className="main">
        {game ? (
          <MarketBoard key={game.slug} game={game} />
        ) : (
          !loadingFirstTime && <p className="board-empty">Choose a game to see its live prices.</p>
        )}
      </main>
    </div>
  );
}
