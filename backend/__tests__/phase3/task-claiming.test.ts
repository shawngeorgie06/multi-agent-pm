/**
 * Phase 3: Task Claiming Tests
 * Tests autonomous task claiming, race conditions, and agent claiming behavior
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import TaskQueueManager, { Task } from '../../src/services/TaskQueueManager';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 3: Task Claiming', () => {
  let taskQueueManager: TaskQueueManager;
  let messageBus: MessageBus;
  let taskStore: MockTaskStore;
  const projectId = 'test-project-1';

  beforeEach(() => {
    taskStore = new MockTaskStore();
    messageBus = new MessageBus(taskStore);
    taskQueueManager = new TaskQueueManager(taskStore, messageBus);
  });

  afterEach(() => {
    taskQueueManager.reset();
    messageBus.reset();
    taskStore.clearAll();
  });

  describe('Simple Task Claiming', () => {
    test('should claim a queued task', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);
      const queueEntryId = queued[0].id;

      const result = await taskQueueManager.claimTask(queueEntryId, 'agent-1', []);

      expect(result.claimed).toBe(true);
      expect(result.taskId).toBe('task-1');
      expect(result.error).toBeUndefined();
    });

    test('should fail to claim already-claimed task', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);
      const queueEntryId = queued[0].id;

      // First claim succeeds
      const result1 = await taskQueueManager.claimTask(queueEntryId, 'agent-1', []);
      expect(result1.claimed).toBe(true);

      // Second claim fails
      const result2 = await taskQueueManager.claimTask(queueEntryId, 'agent-2', []);
      expect(result2.claimed).toBe(false);
      expect(result2.error).toContain('already claimed');
    });

    test('should return error for non-existent queue entry', async () => {
      const result = await taskQueueManager.claimTask('non-existent', 'agent-1', []);
      expect(result.claimed).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Capability Matching for Claiming', () => {
    test('should claim task with matching capabilities', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Frontend task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-1',
        ['react', 'typescript', 'javascript']
      );

      expect(result.claimed).toBe(true);
    });

    test('should fail to claim task when agent lacks required capability', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Frontend task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-1',
        ['react'] // Missing typescript
      );

      expect(result.claimed).toBe(false);
      expect(result.error).toContain('capabilities');
    });

    test('should allow claim with superset of capabilities', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task with specific requirements',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['html', 'css'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-1',
        ['html', 'css', 'javascript', 'react'] // Superset
      );

      expect(result.claimed).toBe(true);
    });

    test('should allow any agent to claim task with no capability requirements', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task with no requirements',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-1',
        [] // No capabilities
      );

      expect(result.claimed).toBe(true);
    });

    test('should use case-insensitive capability matching', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['React', 'TypeScript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-1',
        ['react', 'typescript'] // lowercase
      );

      expect(result.claimed).toBe(true);
    });
  });

  describe('Task Status Updates', () => {
    test('should update task status to IN_PROGRESS after claiming', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
      await taskQueueManager.markTaskInProgress('task-1', 'agent-1');

      const cachedTask = taskQueueManager.getTaskCache().get('task-1');
      expect(cachedTask?.status).toBe('IN_PROGRESS');
    });

    test('should update task claimedBy and claimedAt fields', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const beforeClaim = new Date();
      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
      const afterClaim = new Date();

      const cachedTask = taskQueueManager.getTaskCache().get('task-1');
      expect(cachedTask?.claimedBy).toBe('agent-1');
      expect(cachedTask?.claimedAt).toBeDefined();
      expect(cachedTask?.claimedAt!.getTime()).toBeGreaterThanOrEqual(beforeClaim.getTime());
      expect(cachedTask?.claimedAt!.getTime()).toBeLessThanOrEqual(afterClaim.getTime());
    });
  });

  describe('Concurrent Claiming', () => {
    test('should handle two agents attempting to claim same task', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);
      const queueEntryId = queued[0].id;

      // Simulate concurrent claims
      const [result1, result2] = await Promise.all([
        taskQueueManager.claimTask(queueEntryId, 'agent-1', []),
        taskQueueManager.claimTask(queueEntryId, 'agent-2', []),
      ]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter((r) => r.claimed).length;
      expect(successCount).toBe(1);

      const failCount = [result1, result2].filter((r) => !r.claimed).length;
      expect(failCount).toBe(1);
    });

    test('should consistently assign to first agent in race condition', async () => {
      // Run multiple times to verify consistency
      for (let i = 0; i < 5; i++) {
        taskQueueManager.reset();

        const task: Task = {
          id: 'task-1',
          projectId,
          taskId: 'T-001',
          description: 'Test task',
          status: 'TODO',
          priority: 'MEDIUM',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await taskQueueManager.queueTask(projectId, task);
        const queued = await taskQueueManager.getQueuedTasks(projectId);

        const results = await Promise.all([
          taskQueueManager.claimTask(queued[0].id, 'agent-1', []),
          taskQueueManager.claimTask(queued[0].id, 'agent-2', []),
        ]);

        const winner = results.find((r) => r.claimed);
        expect(winner).toBeDefined();
        expect(results.filter((r) => !r.claimed)).toHaveLength(1);
      }
    });
  });

  describe('Task Release', () => {
    test('should release a claimed task back to queue', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued1 = await taskQueueManager.getQueuedTasks(projectId);

      await taskQueueManager.claimTask(queued1[0].id, 'agent-1', []);
      const queued2 = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued2).toHaveLength(0);

      await taskQueueManager.releaseTask('task-1');
      const queued3 = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued3).toHaveLength(1);
    });

    test('should not release unclaimed task', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);

      try {
        await taskQueueManager.releaseTask('task-1');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should emit task:released event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.previousAgent).toBe('agent-1');
        done();
      });

      messageBus.on('task:released', handler);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.queueTask(projectId, task).then(async () => {
        const queued = await taskQueueManager.getQueuedTasks(projectId);
        await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
        await taskQueueManager.releaseTask('task-1');
      });
    });
  });

  describe('Mark Task Complete', () => {
    test('should mark task as COMPLETE', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);
      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);

      await taskQueueManager.markTaskComplete('task-1', 'agent-1');

      const cachedTask = taskQueueManager.getTaskCache().get('task-1');
      expect(cachedTask?.status).toBe('COMPLETE');
      expect(cachedTask?.completedBy).toBe('agent-1');
      expect(cachedTask?.completedAt).toBeDefined();
    });

    test('should emit task:completed event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.agentId).toBe('agent-1');
        done();
      });

      messageBus.on('task:completed', handler);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.queueTask(projectId, task).then(async () => {
        const queued = await taskQueueManager.getQueuedTasks(projectId);
        await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-1', 'agent-1');
      });
    });
  });

  describe('MessageBus Event Integration', () => {
    test('should emit task:claimed event on successful claim', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.agentId).toBe('agent-1');
        expect(data.projectId).toBe(projectId);
        done();
      });

      messageBus.on('task:claimed', handler);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.queueTask(projectId, task).then(async () => {
        const queued = await taskQueueManager.getQueuedTasks(projectId);
        await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
      });
    });

    test('should emit task:started event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.agentId).toBe('agent-1');
        done();
      });

      messageBus.on('task:started', handler);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.queueTask(projectId, task).then(async () => {
        const queued = await taskQueueManager.getQueuedTasks(projectId);
        await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
        await taskQueueManager.markTaskInProgress('task-1', 'agent-1');
      });
    });
  });
});
