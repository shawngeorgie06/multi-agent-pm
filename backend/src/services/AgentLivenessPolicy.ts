/**
 * Agent liveness policy.
 *
 * Agents broadcast an `agent:heartbeat` every 5 seconds while they are alive
 * (see BaseAgent.startHeartbeat). If an agent crashes or hangs it stops beating
 * but never sends `agent:offline`, so the distribution layer must infer death
 * from the absence of recent heartbeats. This module defines, as pure testable
 * logic, when an agent has been silent long enough to be treated as dead so its
 * in-flight tasks can be reclaimed.
 *
 * The timeout must tolerate a few missed beats (transient hiccups, GC pauses)
 * before declaring an agent dead, to avoid reclaiming tasks from agents that
 * are merely slow.
 */

/**
 * How long an agent may go without a heartbeat before it is considered dead.
 * Agents beat every 5s, so 20s tolerates ~3 missed beats.
 */
export const AGENT_HEARTBEAT_TIMEOUT_MS = 20 * 1000;

/**
 * Whether an agent whose last heartbeat was at `lastHeartbeat` is unresponsive
 * as of `now`.
 *
 * A missing heartbeat time is treated as alive: an agent that has never beaten
 * (e.g. just registered) has not yet provided evidence of death. A heartbeat
 * exactly at the boundary is treated as still alive (strictly-older-than).
 *
 * @param lastHeartbeat when the agent last beat (null/undefined if unknown)
 * @param now reference time (defaults to current time)
 * @param timeoutMs silence window (defaults to {@link AGENT_HEARTBEAT_TIMEOUT_MS})
 */
export function isAgentUnresponsive(
  lastHeartbeat: Date | null | undefined,
  now: Date = new Date(),
  timeoutMs: number = AGENT_HEARTBEAT_TIMEOUT_MS
): boolean {
  if (!lastHeartbeat) return false;
  return now.getTime() - lastHeartbeat.getTime() > timeoutMs;
}
