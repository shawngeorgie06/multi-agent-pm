/**
 * Stale-claim policy.
 *
 * When an agent claims a task it stamps `claimedAt`. If that agent then crashes
 * or hangs without reporting completion/failure (and without sending an explicit
 * agent:offline event), the claim is never released and the task is stuck
 * forever. This module defines, as pure testable logic, when a claim is old
 * enough to be considered abandoned so it can be reclaimed and redistributed.
 *
 * The timeout is deliberately generous: it must be longer than the slowest
 * legitimate task so that a still-running agent is never reclaimed out from
 * under itself (which would cause duplicate execution).
 */

/** How long a claim may sit before it is considered abandoned (10 minutes). */
export const CLAIM_STALE_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The instant before which any claim is considered stale. Useful for building a
 * database query filter (e.g. `claimedAt < cutoff`).
 *
 * @param now reference time (defaults to current time)
 * @param timeoutMs staleness window (defaults to {@link CLAIM_STALE_TIMEOUT_MS})
 */
export function staleClaimCutoff(
  now: Date = new Date(),
  timeoutMs: number = CLAIM_STALE_TIMEOUT_MS
): Date {
  return new Date(now.getTime() - timeoutMs);
}

/**
 * Whether a claim made at `claimedAt` is stale as of `now`.
 *
 * A missing claim time means the task isn't claimed, so there is nothing to
 * reclaim — that is reported as not stale. A claim exactly at the boundary is
 * treated as still valid (strictly-older-than comparison).
 *
 * @param claimedAt when the task was claimed (null/undefined if unclaimed)
 * @param now reference time (defaults to current time)
 * @param timeoutMs staleness window (defaults to {@link CLAIM_STALE_TIMEOUT_MS})
 */
export function isClaimStale(
  claimedAt: Date | null | undefined,
  now: Date = new Date(),
  timeoutMs: number = CLAIM_STALE_TIMEOUT_MS
): boolean {
  if (!claimedAt) return false;
  return claimedAt.getTime() < staleClaimCutoff(now, timeoutMs).getTime();
}
