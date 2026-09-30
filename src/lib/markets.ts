import type { GammaEvent, GammaMarket } from './gamma';

// One event per real game: team codes + kickoff date and nothing after it.
// This drops the half/quarter/player-stat sub-events that share the tag.
export const GAME_SLUG = /^nfl-[a-z]{2,4}-[a-z]{2,4}-\d{4}-\d{2}-\d{2}$/;

export type MarketKind = 'moneyline' | 'total';

export interface OutcomeRow {
  assetId: string;
  outcome: string;
  question: string;
  marketId: string;
}

export interface MarketGroup {
  id: string;
  question: string;
  kind: MarketKind;
  /** The O/U number for totals, null for the moneyline. */
  line: number | null;
  outcomes: OutcomeRow[];
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  awayCode: string;
  homeCode: string;
  /** YYYY-MM-DD taken from the slug; always present. */
  gameDate: string;
  /** Exact kickoff when Polymarket provides one. */
  kickoff: Date | null;
  moneyline: MarketGroup | null;
  totals: MarketGroup[];
}

/** Gamma encodes `outcomes` and `clobTokenIds` as JSON strings. Accept either shape. */
export function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Gamma sometimes uses "2026-09-27 17:00:00+00", which Date can't parse as-is. */
export function parseLooseDate(value: string | undefined): Date | null {
  if (!value) return null;
  let iso = value.trim().replace(' ', 'T');
  if (/[+-]\d{2}$/.test(iso)) iso += ':00';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toGroup(market: GammaMarket, kind: MarketKind, line: number | null): MarketGroup | null {
  const labels = parseStringList(market.outcomes);
  const tokens = parseStringList(market.clobTokenIds);
  if (labels.length === 0 || labels.length !== tokens.length) return null;

  const question = market.question.trim();
  return {
    id: market.id,
    question,
    kind,
    line,
    outcomes: labels.map((outcome, i) => ({
      assetId: tokens[i],
      outcome,
      question,
      marketId: market.id,
    })),
  };
}

/**
 * Keep only the full-game moneyline (question === title) and every full-game
 * total ("{title}: O/U {n}"). Team totals, 1H/2H/quarter lines and props fall
 * out because they don't match either shape exactly.
 */
export function pickGameMarkets(event: GammaEvent): Pick<Game, 'moneyline' | 'totals'> {
  const title = event.title.trim();
  const totalPattern = new RegExp(`^${escapeRegExp(title)}: O/U (\\d+(?:\\.\\d+)?)$`);

  let moneyline: MarketGroup | null = null;
  const totals: MarketGroup[] = [];

  for (const market of event.markets ?? []) {
    if (market.closed === true || typeof market.question !== 'string') continue;
    const question = market.question.trim();

    if (question === title && !moneyline) {
      moneyline = toGroup(market, 'moneyline', null);
      continue;
    }

    const match = totalPattern.exec(question);
    if (match) {
      const group = toGroup(market, 'total', Number(match[1]));
      if (group) totals.push(group);
    }
  }

  totals.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  return { moneyline, totals };
}

export function toGame(event: GammaEvent): Game {
  const [, away, home, y, m, d] = event.slug.split('-');
  const { moneyline, totals } = pickGameMarkets(event);
  const firstMarket = event.markets?.find((mk) => mk.gameStartTime);

  return {
    id: event.id,
    slug: event.slug,
    title: event.title.trim(),
    awayCode: away.toUpperCase(),
    homeCode: home.toUpperCase(),
    gameDate: `${y}-${m}-${d}`,
    kickoff: parseLooseDate(event.startTime) ?? parseLooseDate(firstMarket?.gameStartTime),
    moneyline,
    totals,
  };
}

export function selectGames(events: GammaEvent[]): Game[] {
  const seen = new Set<string>();
  const games: Game[] = [];

  for (const event of events) {
    if (!event?.slug || !GAME_SLUG.test(event.slug) || seen.has(event.slug)) continue;
    seen.add(event.slug);
    games.push(toGame(event));
  }

  // Day from the slug first (it's what the list groups by), then kickoff time.
  return games.sort(
    (a, b) =>
      a.gameDate.localeCompare(b.gameDate) ||
      (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0) ||
      a.title.localeCompare(b.title),
  );
}

/** Every token in display order: moneyline first, then totals low to high. */
export function assetIdsFor(game: Game): string[] {
  const groups = game.moneyline ? [game.moneyline, ...game.totals] : game.totals;
  return groups.flatMap((g) => g.outcomes.map((o) => o.assetId));
}
