import { useEffect, useMemo } from 'react';
import { formatGameDay, formatKickoff } from '../lib/format';
import { marketSocket, quoteStore } from '../lib/live';
import { assetIdsFor, type Game, type MarketGroup } from '../lib/markets';
import { ConnectionStatus } from './ConnectionStatus';
import { QuoteRow } from './QuoteRow';

interface Props {
  game: Game;
}

function Section({ title, note, groups }: { title: string; note?: string; groups: MarketGroup[] }) {
  return (
    <tbody>
      <tr className="section-row">
        <th scope="rowgroup" colSpan={5}>
          {title}
          {note && <span className="section-note">{note}</span>}
        </th>
      </tr>
      {groups.flatMap((group) =>
        group.outcomes.map((row, i) => (
          <QuoteRow key={row.assetId} row={row} startsMarket={i === 0} />
        )),
      )}
    </tbody>
  );
}

export function MarketBoard({ game }: Props) {
  const assetIds = useMemo(() => assetIdsFor(game), [game]);

  // Point the store and the socket at this game's tokens. The socket diffs
  // against what it already has and unsubscribes/subscribes on the same
  // connection, so switching games never reconnects.
  useEffect(() => {
    quoteStore.track(assetIds);
    marketSocket.setAssets(assetIds);
  }, [assetIds]);

  const time = formatKickoff(game.kickoff);
  const lineCount = game.totals.length;
  const hasMarkets = game.moneyline !== null || lineCount > 0;

  return (
    <section className="board" aria-labelledby="board-title">
      <header className="board-head">
        <div>
          <h1 id="board-title" className="board-title">{game.title}</h1>
          <p className="board-meta">
            {formatGameDay(game.gameDate)}
            {time && `, ${time}`}
            {hasMarkets &&
              `. ${assetIds.length} contracts, ${lineCount} total ${lineCount === 1 ? 'line' : 'lines'}`}
          </p>
        </div>
        <ConnectionStatus />
      </header>

      {!hasMarkets ? (
        <p className="board-empty">
          Polymarket hasn’t listed a moneyline or full-game totals for this game yet. Pick another
          game, or refresh the schedule later.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="quotes">
            <caption className="visually-hidden">
              Live prices for {game.title}. Prices in cents equal implied probability.
            </caption>
            <thead>
              <tr>
                <th scope="col">Outcome</th>
                <th scope="col" className="num">Best bid</th>
                <th scope="col" className="num">Best ask</th>
                <th scope="col" className="num">Last trade</th>
                <th scope="col" className="num">Spread</th>
              </tr>
            </thead>
            {game.moneyline && <Section title="Moneyline" groups={[game.moneyline]} />}
            {lineCount > 0 && (
              <Section
                title="Game totals"
                note={
                  lineCount > 1
                    ? `${game.totals[0].line} to ${game.totals[lineCount - 1].line} points`
                    : undefined
                }
                groups={game.totals}
              />
            )}
          </table>
        </div>
      )}
      <p className="board-foot">
        Prices are in cents, so 53¢ reads as a 53% chance. Data streams directly from Polymarket.
      </p>
    </section>
  );
}
