import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryTaskStore } from '../../../src/services/taskStore/InMemoryTaskStore';

describe('InMemoryTaskStore', () => {
  let store: InMemoryTaskStore;
  beforeEach(() => { store = new InMemoryTaskStore(); });

  it('enqueues and returns unclaimed entries ordered by priority then id', async () => {
    store.seedTask({ id: 't1', taskId: 't1', projectId: 'p', status: 'TODO' });
    store.seedTask({ id: 't2', taskId: 't2', projectId: 'p', status: 'TODO' });
    await store.enqueueTask({ taskId: 't2', projectId: 'p', agentType: 'LAYOUT', priority: 'MEDIUM', requiredCapabilities: [] });
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });

    const entries = await store.getUnclaimedQueueEntries('p');
    expect(entries.map(e => e.taskId)).toEqual(['t1', 't2']); // HIGH(asc 0) before MEDIUM(1)
  });

  it('enqueueTask is idempotent for the same (taskId, projectId) — matches the DB unique constraint', async () => {
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });

    expect((await store.countQueue('p')).total).toBe(1);
  });

  it('claimQueueEntry succeeds once then fails for a second agent (atomic)', async () => {
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    expect(await store.claimQueueEntry('t1', 'p', 'agent-a')).toBe(true);
    expect(await store.claimQueueEntry('t1', 'p', 'agent-b')).toBe(false);
  });

  it('getStaleClaims returns only claims older than the cutoff', async () => {
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    await store.claimQueueEntry('t1', 'p', 'agent-a');
    store.setClaimedAt('t1', new Date('2020-01-01T00:00:00Z'));

    const stale = await store.getStaleClaims('p', new Date('2020-01-01T00:10:00Z'));
    expect(stale.map(e => e.taskId)).toEqual(['t1']);
  });

  it('deadLetterTask sets terminal status, retryCount and blockerMessage', async () => {
    store.seedTask({ id: 't1', taskId: 't1', projectId: 'p', status: 'IN_PROGRESS' });
    await store.deadLetterTask('t1', { status: 'FAILED', retryCount: 3, blockerMessage: 'boom' });

    const t = await store.getTaskById('t1');
    expect(t).toMatchObject({ status: 'FAILED', retryCount: 3, blockerMessage: 'boom' });
  });

  it('countQueue reports total/unclaimed/claimed', async () => {
    await store.enqueueTask({ taskId: 'a', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    await store.enqueueTask({ taskId: 'b', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    await store.claimQueueEntry('a', 'p', 'agent-a');

    expect(await store.countQueue('p')).toEqual({ total: 2, unclaimed: 1, claimed: 1 });
  });
});
