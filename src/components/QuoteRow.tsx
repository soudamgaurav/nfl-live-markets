import { memo } from 'react';
import { useQuote } from '../hooks/useQuote';
import { formatCents, spreadOf } from '../lib/format';
import type { OutcomeRow } from '../lib/markets';
import { FlashCell } from './FlashCell';

interface Props {
  row: OutcomeRow;
  startsMarket: boolean;
}

export const QuoteRow = memo(function QuoteRow({ row, startsMarket }: Props) {
  const quote = useQuote(row.assetId);
  const { bestBid, bestAsk, lastTrade, tickSize } = quote;
  const spread = spreadOf(bestBid, bestAsk, tickSize);
  const waiting = quote.updatedAt === null;

  return (
    <tr className={startsMarket ? 'market-start' : undefined} aria-busy={waiting || undefined}>
      <th scope="row" className="outcome">
        <span className="outcome-label">{row.outcome}</span>
        <span className="outcome-market">{row.question}</span>
      </th>
      <FlashCell value={bestBid} label="Best bid">{formatCents(bestBid, tickSize)}</FlashCell>
      <FlashCell value={bestAsk} label="Best ask">{formatCents(bestAsk, tickSize)}</FlashCell>
      <FlashCell value={lastTrade} label="Last trade" className="last">
        {formatCents(lastTrade, tickSize)}
      </FlashCell>
      <FlashCell value={spread} label="Spread" className="spread">
        {formatCents(spread, tickSize)}
      </FlashCell>
    </tr>
  );
});
