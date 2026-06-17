import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskDistributionService } from '../../src/services/TaskDistributionService';
import { MessageBus } from '../../src/services/MessageBus';
import { InMemoryTaskStore } from '../../src/services/taskStore/InMemoryTaskStore';

function makeService(store: InMemoryTaskStore) {
  const bus = new MessageBus();
  const service = new TaskDistributionService(bus, {} as any, undefined, store);
  return { bus, service };
}

describe('TaskDistributionService reliability (end-to-end via TaskStore fake)', () => {
  let store: InMemoryTaskStore;
  beforeEach(() => { store = new InMemoryTaskStore(); });

  it('requeues a failed task and bumps retryCount when under the cap', async () => {
    store.seedTask({ id: 't1', taskId: 't1', projectId: 'p', status: 'IN_PROGRESS', retryCount: 0 });
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    await store.claimQueueEntry('t1', 'p', 'agent-a');
    const { bus } = makeService(store);

    bus.broadcast({ event: 'task:failed', projectId: 'p', taskId: 't1', agentId: 'agent-a', error: 'boom' });
    await new Promise(r => setTimeout(r, 20));

    const t = await store.getTaskById('t1');
    expect(t!.retryCount).toBe(1);
    expect(t!.status).not.toBe('FAILED');
    expect((await store.getUnclaimedQueueEntries('p')).map(e => e.taskId)).toContain('t1');
  });

  it('dead-letters a task once it exceeds the retry cap', async () => {
    store.seedTask({ id: 't1', taskId: 't1', projectId: 'p', status: 'IN_PROGRESS', retryCount: 3 });
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    const { bus } = makeService(store);

    bus.broadcast({ event: 'task:failed', projectId: 'p', taskId: 't1', agentId: 'agent-a', error: 'boom' });
    await new Promise(r => setTimeout(r, 20));

    const t = await store.getTaskById('t1');
    expect(t!.status).toBe('FAILED');
    expect(t!.blockerMessage).toMatch(/Failed after/);
    expect(await store.countQueue('p')).toMatchObject({ total: 0 });
  });

  it('reclaims a stale claim so the task becomes distributable again', async () => {
    store.seedTask({ id: 't1', taskId: 't1', projectId: 'p', status: 'IN_PROGRESS' });
    await store.enqueueTask({ taskId: 't1', projectId: 'p', agentType: 'LAYOUT', priority: 'HIGH', requiredCapabilities: [] });
    await store.claimQueueEntry('t1', 'p', 'dead-agent');
    store.setClaimedAt('t1', new Date(Date.now() - 60 * 60 * 1000));
    const { service } = makeService(store);

    await (service as any).reclaimStaleClaims('p');
    expect((await store.getUnclaimedQueueEntries('p')).map(e => e.taskId)).toContain('t1');
  });
});
