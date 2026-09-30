// Thin client for Polymarket's public Gamma REST API.
// The API caps every page at 100 events no matter what `limit` says,
// so we keep walking `offset` until a page comes back short.

const GAMMA_URL = 'https://gamma-api.polymarket.com/events';
const PAGE_SIZE = 100;
// Safety valve so a misbehaving API can't send us into an endless loop.
const MAX_PAGES = 30;

export interface GammaMarket {
  id: string;
  question: string;
  outcomes?: string | string[];
  clobTokenIds?: string | string[];
  active?: boolean;
  closed?: boolean;
  gameStartTime?: string;
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  startDate?: string;
  startTime?: string;
  markets?: GammaMarket[];
}

export async function fetchActiveNflEvents(signal?: AbortSignal): Promise<GammaEvent[]> {
  const events: GammaEvent[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      tag_slug: 'nfl',
      active: 'true',
      closed: 'false',
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });

    const res = await fetch(`${GAMMA_URL}?${params}`, { signal });
    if (!res.ok) {
      throw new Error(`Polymarket returned ${res.status} while loading NFL events.`);
    }

    const batch: unknown = await res.json();
    if (!Array.isArray(batch)) {
      throw new Error('Polymarket sent an unexpected response for NFL events.');
    }

    events.push(...(batch as GammaEvent[]));
    if (batch.length < PAGE_SIZE) break;
  }

  return events;
}
