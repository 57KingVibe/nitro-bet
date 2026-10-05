import { Driver } from '../types';
import { Market } from '../api';
import { MOCK_DRIVERS } from '../constants';

// Photos and team names come from the original design's driver list; unknown drivers get a generated avatar.
const META = new Map(MOCK_DRIVERS.map((d) => [d.name.toLowerCase(), d]));

export type PrevOdds = Record<string, number>;

/** Turns one market into driver cards. Odds movement is measured against the previous poll. */
export function buildCards(market: Market, prev: PrevOdds): { cards: Driver[]; next: PrevOdds } {
  const next: PrevOdds = {};
  const cards = market.outcomes.map((o) => {
    const odds = Number(o.odds);
    const before = prev[o.id] ?? odds;
    next[o.id] = odds;
    const meta = META.get(o.label.toLowerCase());
    return {
      id: o.id,
      name: o.label,
      team: meta?.team ?? '',
      odds,
      lastOdds: before,
      trend: odds > before ? 'up' : odds < before ? 'down' : 'stable',
      img: meta?.img ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(o.label)}`,
    } as Driver;
  });
  return { cards, next };
}
