import { describe, it, expect } from '@jest/globals';
import { AgentClaimingHelper } from '../../src/services/AgentClaimingHelper';
import { InMemoryTaskStore } from '../../src/services/taskStore/InMemoryTaskStore';

describe('AgentClaimingHelper with InMemoryTaskStore', () => {
  it('only one of two agents wins the claim, and the task record goes IN_PROGRESS', async () => {
    const store = new InMemoryTaskStore();
    store.seedTask({ id: 't1', taskId: 't1', projectId: 'p', status: 'TODO' });
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });

    const a = new AgentClaimingHelper({ agentId: 'a', agentType: 'LAYOUT', capabilities: ['html'] }, undefined, store);
    const b = new AgentClaimingHelper({ agentId: 'b', agentType: 'LAYOUT', capabilities: ['html'] }, undefined, store);

    const [aWon, bWon] = await Promise.all([a.claimTask('t1', 'p'), b.claimTask('t1', 'p')]);
    expect([aWon, bWon].filter(Boolean)).toHaveLength(1);
    expect((await store.getTaskById('t1'))!.status).toBe('IN_PROGRESS');
  });
});
