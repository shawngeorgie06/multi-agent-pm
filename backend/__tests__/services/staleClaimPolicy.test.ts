/**
 * Unit tests for the stale-claim policy.
 *
 * Pure logic (no DB) defining when a task's claim is considered abandoned —
 * e.g. an agent crashed or hung while holding the task — so it can be reclaimed
 * and given to another agent instead of staying stuck forever.
 */

import { describe, it, expect } from '@jest/globals';
import {
  CLAIM_STALE_TIMEOUT_MS,
  isClaimStale,
  staleClaimCutoff,
} from '../../src/services/StaleClaimPolicy';

describe('StaleClaimPolicy', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('treats a fresh claim as not stale', () => {
    const claimedAt = new Date(now.getTime() - 1000); // 1s ago
    expect(isClaimStale(claimedAt, now, 60_000)).toBe(false);
  });

  it('treats a claim older than the timeout as stale', () => {
    const claimedAt = new Date(now.getTime() - 120_000); // 2m ago
    expect(isClaimStale(claimedAt, now, 60_000)).toBe(true);
  });

  it('is not stale exactly at the timeout boundary', () => {
    const claimedAt = new Date(now.getTime() - 60_000); // exactly timeout ago
    expect(isClaimStale(claimedAt, now, 60_000)).toBe(false);
  });

  it('treats a null/undefined claim time as not stale (nothing to reclaim)', () => {
    expect(isClaimStale(null, now, 60_000)).toBe(false);
    expect(isClaimStale(undefined, now, 60_000)).toBe(false);
  });

  it('computes a cutoff date the timeout before now', () => {
    const cutoff = staleClaimCutoff(now, 60_000);
    expect(cutoff.getTime()).toBe(now.getTime() - 60_000);
    // Anything claimed before the cutoff is stale.
    expect(isClaimStale(new Date(cutoff.getTime() - 1), now, 60_000)).toBe(true);
  });

  it('uses CLAIM_STALE_TIMEOUT_MS as the default window', () => {
    const justInside = new Date(now.getTime() - (CLAIM_STALE_TIMEOUT_MS - 1000));
    const justOutside = new Date(now.getTime() - (CLAIM_STALE_TIMEOUT_MS + 1000));
    expect(isClaimStale(justInside, now)).toBe(false);
    expect(isClaimStale(justOutside, now)).toBe(true);
  });
});
