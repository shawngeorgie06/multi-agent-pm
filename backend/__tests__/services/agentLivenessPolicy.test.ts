/**
 * Unit tests for the agent liveness policy.
 *
 * Pure logic (no DB) defining when an agent is considered dead because it has
 * stopped sending heartbeats, so its in-flight tasks can be reclaimed.
 */

import { describe, it, expect } from '@jest/globals';
import {
  AGENT_HEARTBEAT_TIMEOUT_MS,
  isAgentUnresponsive,
} from '../../src/services/AgentLivenessPolicy';

describe('AgentLivenessPolicy', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('treats a recently-beating agent as alive', () => {
    const lastHeartbeat = new Date(now.getTime() - 3000); // 3s ago (beats every 5s)
    expect(isAgentUnresponsive(lastHeartbeat, now, 20_000)).toBe(false);
  });

  it('treats an agent silent past the timeout as unresponsive', () => {
    const lastHeartbeat = new Date(now.getTime() - 25_000); // 25s ago
    expect(isAgentUnresponsive(lastHeartbeat, now, 20_000)).toBe(true);
  });

  it('is not unresponsive exactly at the timeout boundary', () => {
    const lastHeartbeat = new Date(now.getTime() - 20_000);
    expect(isAgentUnresponsive(lastHeartbeat, now, 20_000)).toBe(false);
  });

  it('treats a missing last-heartbeat as alive (not yet enough data to declare dead)', () => {
    expect(isAgentUnresponsive(null, now, 20_000)).toBe(false);
    expect(isAgentUnresponsive(undefined, now, 20_000)).toBe(false);
  });

  it('uses AGENT_HEARTBEAT_TIMEOUT_MS as the default window', () => {
    const justInside = new Date(now.getTime() - (AGENT_HEARTBEAT_TIMEOUT_MS - 1000));
    const justOutside = new Date(now.getTime() - (AGENT_HEARTBEAT_TIMEOUT_MS + 1000));
    expect(isAgentUnresponsive(justInside, now)).toBe(false);
    expect(isAgentUnresponsive(justOutside, now)).toBe(true);
  });

  it('default timeout is comfortably larger than the 5s heartbeat interval', () => {
    // Must tolerate a couple of missed beats before declaring death.
    expect(AGENT_HEARTBEAT_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
  });
});
