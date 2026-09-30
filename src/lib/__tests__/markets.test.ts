import { describe, expect, it } from 'vitest';
import type { GammaEvent, GammaMarket } from '../gamma';
import { assetIdsFor, GAME_SLUG, parseLooseDate, pickGameMarkets, selectGames } from '../markets';

const market = (id: string, question: string, extra: Partial<GammaMarket> = {}): GammaMarket => ({
  id,
  question,
  outcomes: '["Yes","No"]',
  clobTokenIds: `["${id}-a","${id}-b"]`,
  ...extra,
});

const chiefsDolphins: GammaEvent = {
  id: '1',
  slug: 'nfl-kc-mia-2026-09-27',
  title: 'Chiefs vs. Dolphins',
  markets: [
    market('ml', 'Chiefs vs. Dolphins', { outcomes: '["Chiefs","Dolphins"]' }),
    market('t435', 'Chiefs vs. Dolphins: O/U 43.5', { outcomes: '["Over","Under"]' }),
    market('t415', 'Chiefs vs. Dolphins: O/U 41.5', { outcomes: '["Over","Under"]' }),
    market('t45', 'Chiefs vs. Dolphins: O/U 45', { outcomes: '["Over","Under"]' }),
    market('team', 'Chiefs Team Total: O/U 24.5'),
    market('half', 'Chiefs vs. Dolphins 1H: O/U 21.5'),
    market('halfsuffix', 'Chiefs vs. Dolphins: O/U 21.5 1H'),
    market('q1', 'Chiefs vs. Dolphins: 1Q O/U 10.5'),
    market('spread', 'Spread: Chiefs (-3.5)'),
    market('prop', 'Patrick Mahomes: Passing Yards O/U 275.5'),
    market('closed', 'Chiefs vs. Dolphins: O/U 60.5', { closed: true }),
  ],
};

describe('GAME_SLUG', () => {
  it('matches one event per game and rejects sub-events', () => {
    expect(GAME_SLUG.test('nfl-kc-mia-2026-09-27')).toBe(true);
    expect(GAME_SLUG.test('nfl-lar-sf-2026-10-04')).toBe(true);
    expect(GAME_SLUG.test('nfl-kc-mia-2026-09-27-1h')).toBe(false);
    expect(GAME_SLUG.test('nfl-kc-mia-2026-09-27-player-props')).toBe(false);
    expect(GAME_SLUG.test('nfl-super-bowl-champion-2027')).toBe(false);
  });
});

describe('pickGameMarkets', () => {
  const { moneyline, totals } = pickGameMarkets(chiefsDolphins);

  it('finds the moneyline by exact title match', () => {
    expect(moneyline?.id).toBe('ml');
    expect(moneyline?.outcomes.map((o) => o.outcome)).toEqual(['Chiefs', 'Dolphins']);
    expect(moneyline?.outcomes.map((o) => o.assetId)).toEqual(['ml-a', 'ml-b']);
  });

  it('keeps every full-game total, sorted by line, and nothing else', () => {
    expect(totals.map((t) => t.line)).toEqual([41.5, 43.5, 45]);
    expect(totals.every((t) => t.outcomes.length === 2)).toBe(true);
  });

  it('skips markets whose outcomes and tokens do not line up', () => {
    const broken: GammaEvent = {
      ...chiefsDolphins,
      markets: [market('ml', 'Chiefs vs. Dolphins', { clobTokenIds: '["only-one"]' })],
    };
    expect(pickGameMarkets(broken).moneyline).toBeNull();
  });

  it('handles titles with regex characters safely', () => {
    const event: GammaEvent = {
      id: '2',
      slug: 'nfl-ne-nyj-2026-10-01',
      title: 'Patriots vs. Jets (London)',
      markets: [market('t', 'Patriots vs. Jets (London): O/U 38.5')],
    };
    expect(pickGameMarkets(event).totals).toHaveLength(1);
  });
});

describe('selectGames', () => {
  it('filters to game slugs, de-duplicates across pages, and sorts by date', () => {
    const later: GammaEvent = { ...chiefsDolphins, id: '9', slug: 'nfl-buf-nyj-2026-10-04', title: 'Bills vs. Jets' };
    const games = selectGames([
      later,
      chiefsDolphins,
      chiefsDolphins,
      { id: '3', slug: 'nfl-kc-mia-2026-09-27-1h', title: 'Chiefs vs. Dolphins 1H' },
      { id: '4', slug: 'nfl-afc-champion', title: 'AFC Champion' },
    ]);
    expect(games.map((g) => g.slug)).toEqual(['nfl-kc-mia-2026-09-27', 'nfl-buf-nyj-2026-10-04']);
    expect(games[0]).toMatchObject({ awayCode: 'KC', homeCode: 'MIA', gameDate: '2026-09-27' });
  });

  it('lists moneyline tokens before totals', () => {
    const [game] = selectGames([chiefsDolphins]);
    expect(assetIdsFor(game)).toEqual(['ml-a', 'ml-b', 't415-a', 't415-b', 't435-a', 't435-b', 't45-a', 't45-b']);
  });
});

describe('parseLooseDate', () => {
  it('reads Gamma’s space-separated timestamps', () => {
    expect(parseLooseDate('2026-09-27 17:00:00+00')?.toISOString()).toBe('2026-09-27T17:00:00.000Z');
    expect(parseLooseDate('not a date')).toBeNull();
  });
});
