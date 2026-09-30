// Polymarket prices live between 0 and 1. We show them in cents, which reads
// as implied probability: 0.53 -> "53¢" (≈53%).

export function decimalsForTick(tick: number): number {
  if (!(tick > 0)) return 2;
  const [, fraction = ''] = tick.toFixed(10).replace(/0+$/, '').split('.');
  return fraction.length;
}

export function roundToTick(value: number, tick: number): number {
  if (!(tick > 0)) return value;
  const decimals = decimalsForTick(tick);
  return Number((Math.round(value / tick) * tick).toFixed(decimals));
}

export function formatCents(value: number | null, tick: number): string {
  if (value === null) return '—';
  const centDecimals = Math.max(0, decimalsForTick(tick) - 2);
  return `${(roundToTick(value, tick) * 100).toFixed(centDecimals)}¢`;
}

export function spreadOf(bid: number | null, ask: number | null, tick: number): number | null {
  if (bid === null || ask === null) return null;
  return roundToTick(roundToTick(ask, tick) - roundToTick(bid, tick), tick);
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** gameDate is YYYY-MM-DD; build it at local noon so timezones can't shift the day. */
export function formatGameDay(gameDate: string): string {
  const [y, m, d] = gameDate.split('-').map(Number);
  return dayFormat.format(new Date(y, m - 1, d, 12));
}

export function formatKickoff(kickoff: Date | null): string | null {
  return kickoff ? timeFormat.format(kickoff) : null;
}
