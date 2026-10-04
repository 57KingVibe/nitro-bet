// Pure betting rules: no database, no env. The services call these inside a transaction.
import { HttpError } from './http-error.js';
import { payoutMinor } from './money.js';

/**
 * Throws an HttpError if the wager must be refused; otherwise returns the odds and payout that will be locked in.
 * `row` is one joined outcome+market row as the database returns it.
 */
export function validateWager({ row, stakeMinor, balanceMinor, acceptedOddsCenti, now, minStakeMinor, maxStakeMinor, excludedUntil }) {
  if (excludedUntil && new Date(excludedUntil) > now) {
    throw new HttpError(403, 'Your account is self-excluded.', 'SELF_EXCLUDED');
  }
  if (!row) throw new HttpError(404, 'Outcome not found.', 'OUTCOME_NOT_FOUND');
  if (row.status !== 'open' || (row.closes_at && new Date(row.closes_at) <= now)) {
    throw new HttpError(409, 'This market is closed.', 'MARKET_CLOSED');
  }
  if (stakeMinor < minStakeMinor) throw new HttpError(400, 'Stake is below the minimum.', 'STAKE_TOO_LOW');
  if (stakeMinor > maxStakeMinor) throw new HttpError(400, 'Stake is above the maximum.', 'STAKE_TOO_HIGH');
  // Standard sportsbook rule: refuse if the price got WORSE than the player saw; accept if it improved.
  if (acceptedOddsCenti != null && row.odds_centi < acceptedOddsCenti) {
    const err = new HttpError(409, 'The odds changed. Please confirm the new price.', 'ODDS_CHANGED');
    err.currentOddsCenti = row.odds_centi;
    throw err;
  }
  if (balanceMinor < stakeMinor) throw new HttpError(402, 'Insufficient balance.', 'INSUFFICIENT_FUNDS');
  return { oddsCenti: row.odds_centi, potentialPayoutMinor: payoutMinor(stakeMinor, row.odds_centi) };
}

/**
 * Real-money mode is switched off in code until ID verification and payments are built, so a wrong environment
 * variable can never start taking real stakes.
 */
export function assertRealMoneyReady(realMoneyEnabled, kycAndPaymentsBuilt = false) {
  if (realMoneyEnabled && !kycAndPaymentsBuilt) {
    throw new HttpError(503, 'Real-money betting is not available yet.', 'REAL_MONEY_NOT_READY');
  }
}

/** wagers: [{ id, playerId, currency, outcomeId, stakeMinor, oddsCenti }] */
export function planSettlement(wagers, winningOutcomeId) {
  return wagers.map((w) =>
    w.outcomeId === winningOutcomeId
      ? { wagerId: w.id, playerId: w.playerId, currency: w.currency, status: 'won', payoutMinor: payoutMinor(w.stakeMinor, w.oddsCenti) }
      : { wagerId: w.id, playerId: w.playerId, currency: w.currency, status: 'lost', payoutMinor: 0 }
  );
}

export const planVoid = (wagers) =>
  wagers.map((w) => ({ wagerId: w.id, playerId: w.playerId, currency: w.currency, refundMinor: w.stakeMinor }));
