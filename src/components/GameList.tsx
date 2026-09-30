import { useMemo, useState } from 'react';
import { formatGameDay, formatKickoff } from '../lib/format';
import type { Game } from '../lib/markets';

interface Props {
  games: Game[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

export function GameList({ games, selectedSlug, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const byDay = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? games.filter((g) => `${g.title} ${g.awayCode} ${g.homeCode}`.toLowerCase().includes(q))
      : games;

    const days = new Map<string, Game[]>();
    for (const game of filtered) {
      const list = days.get(game.gameDate) ?? [];
      list.push(game);
      days.set(game.gameDate, list);
    }
    return [...days.entries()];
  }, [games, query]);

  return (
    <nav className="games" aria-label="NFL games">
      {games.length > 6 && (
        <label className="games-search">
          <span className="visually-hidden">Find a team</span>
          <input
            type="search"
            placeholder="Find a team"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}

      {query && byDay.length === 0 && <p className="games-empty">No games match “{query}”.</p>}

      {byDay.map(([day, list]) => (
        <section key={day} className="games-day" aria-labelledby={`day-${day}`}>
          <h2 id={`day-${day}`} className="games-day-title">{formatGameDay(day)}</h2>
          <ul>
            {list.map((game) => {
              const selected = game.slug === selectedSlug;
              const time = formatKickoff(game.kickoff);
              return (
                <li key={game.slug}>
                  <button
                    type="button"
                    className="game"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(game.slug)}
                  >
                    <span className="game-codes" aria-hidden="true">
                      {game.awayCode}
                      <span className="game-vs">v</span>
                      {game.homeCode}
                    </span>
                    <span className="game-title">{game.title}</span>
                    {time && <span className="game-time">{time}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
