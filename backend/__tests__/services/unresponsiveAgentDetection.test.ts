/**
 * Tests that TaskDistributionService tracks agent heartbeats and identifies
 * agents that have gone silent (dead) so their tasks can be reclaimed.
 *
 * These exercise only the in-memory selection (getUnresponsiveAgents) driven
 * through the real event bus, so no database is required.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskDistributionService } from '../../src/services/TaskDistributionService';
import { TaskQueueManager } from '../../src/services/TaskQueueManager';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('TaskDistributionService unresponsive-agent detection', () => {
  let messageBus: MessageBus;
  let service: TaskDistributionService;

  beforeEach(() => {
    const taskStore = new MockTaskStore();
    messageBus = new MessageBus(taskStore);
    const taskQueueManager = new TaskQueueManager(taskStore, messageBus);
    service = new TaskDistributionService(messageBus, taskQueueManager);
    service.setAgentHeartbeatTimeout(20_000);
  });

  const registerAgent = (agentId: string) =>
    messageBus.broadcast({ event: 'agent:registered', agentId, agentType: 'FRONTEND', capabilities: ['html'] });

  it('does not flag a freshly registered agent', () => {
    registerAgent('agent-1');
    expect(service.getUnresponsiveAgents()).toHaveLength(0);
  });

  it('flags an agent whose last heartbeat is older than the timeout', () => {
    registerAgent('agent-1');

    // Backdate the agent's last heartbeat past the timeout.
    const agent = service.getAgentStatus('agent-1')!;
    agent.lastHeartbeat = new Date(Date.now() - 30_000);

    const unresponsive = service.getUnresponsiveAgents();
    expect(unresponsive.map((a) => a.agentId)).toEqual(['agent-1']);
  });

  it('a fresh heartbeat clears the unresponsive state', () => {
    registerAgent('agent-1');
    service.getAgentStatus('agent-1')!.lastHeartbeat = new Date(Date.now() - 30_000);
    expect(service.getUnresponsiveAgents()).toHaveLength(1);

    // Agent recovers and beats again.
    messageBus.broadcast({ event: 'agent:heartbeat', agentId: 'agent-1', state: 'idle' });
    expect(service.getUnresponsiveAgents()).toHaveLength(0);
  });

  it('only flags the dead agent, not its live peers', () => {
    registerAgent('agent-1');
    registerAgent('agent-2');
    service.getAgentStatus('agent-1')!.lastHeartbeat = new Date(Date.now() - 30_000);

    const unresponsive = service.getUnresponsiveAgents();
    expect(unresponsive.map((a) => a.agentId)).toEqual(['agent-1']);
  });
});
