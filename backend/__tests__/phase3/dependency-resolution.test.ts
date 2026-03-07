/**
 * Phase 3: Dependency Resolution Tests
 * Tests task dependencies blocking/unblocking and complex dependency scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import TaskQueueManager, { Task } from '../../src/services/TaskQueueManager';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 3: Dependency Resolution', () => {
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

  describe('No Dependencies', () => {
    test('should allow task with no dependencies to start immediately', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task without dependencies',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const canStart = await taskQueueManager.canTaskBeStarted('task-1');

      expect(canStart).toBe(true);
    });

    test('should allow task with empty dependency array to start', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task with empty deps',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const canStart = await taskQueueManager.canTaskBeStarted('task-1');

      expect(canStart).toBe(true);
    });
  });

  describe('Single Dependency', () => {
    test('should block task when dependency is incomplete', async () => {
      const depTask: Task = {
        id: 'task-dep',
        projectId,
        taskId: 'T-DEP',
        description: 'Dependency task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Dependent task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, depTask);
      await taskQueueManager.queueTask(projectId, task);

      const canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(false);
    });

    test('should allow task to start when dependency completes', async () => {
      const depTask: Task = {
        id: 'task-dep',
        projectId,
        taskId: 'T-DEP',
        description: 'Dependency task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Dependent task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, depTask);
      await taskQueueManager.queueTask(projectId, task);

      // Before completion
      let canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(false);

      // Claim and mark dependency complete
      let depQueued = await taskQueueManager.getQueuedTasks(projectId);
      let depQueueEntry = depQueued.find((e) => e.taskId === 'task-dep');
      if (depQueueEntry) {
        await taskQueueManager.claimTask(depQueueEntry.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-dep', 'agent-1');
      }

      // After completion
      canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(true);
    });
  });

  describe('Multiple Dependencies', () => {
    test('should block task when one of multiple dependencies is incomplete', async () => {
      const dep1: Task = {
        id: 'task-dep1',
        projectId,
        taskId: 'T-DEP1',
        description: 'Dependency 1',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dep2: Task = {
        id: 'task-dep2',
        projectId,
        taskId: 'T-DEP2',
        description: 'Dependency 2',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task with multiple dependencies',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep1', 'task-dep2'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep1);
      await taskQueueManager.queueTask(projectId, dep2);
      await taskQueueManager.queueTask(projectId, task);

      // Block even with partial completion
      let canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(false);

      // Get queue entries and claim first dependency
      let queued = await taskQueueManager.getQueuedTasks(projectId);
      let dep1Entry = queued.find((e) => e.taskId === 'task-dep1');
      let dep2Entry = queued.find((e) => e.taskId === 'task-dep2');

      if (dep1Entry) {
        await taskQueueManager.claimTask(dep1Entry.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-dep1', 'agent-1');
      }
      canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(false);

      // Get fresh queue and complete second dependency
      queued = await taskQueueManager.getQueuedTasks(projectId);
      dep2Entry = queued.find((e) => e.taskId === 'task-dep2');
      if (dep2Entry) {
        await taskQueueManager.claimTask(dep2Entry.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-dep2', 'agent-1');
      }
      canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(true);
    });

    test('should allow task with all dependencies complete', async () => {
      const dep1: Task = {
        id: 'task-dep1',
        projectId,
        taskId: 'T-DEP1',
        description: 'Dependency 1',
        status: 'COMPLETE',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dep2: Task = {
        id: 'task-dep2',
        projectId,
        taskId: 'T-DEP2',
        description: 'Dependency 2',
        status: 'COMPLETE',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task with completed dependencies',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep1', 'task-dep2'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Manually set up completed tasks in cache
      await taskQueueManager.queueTask(projectId, dep1);
      await taskQueueManager.queueTask(projectId, dep2);
      await taskQueueManager.queueTask(projectId, task);

      const canStart = await taskQueueManager.canTaskBeStarted('task-1');
      expect(canStart).toBe(true);
    });
  });

  describe('Chain Dependencies (A->B->C)', () => {
    test('should handle linear dependency chain', async () => {
      const taskA: Task = {
        id: 'task-a',
        projectId,
        taskId: 'T-A',
        description: 'Task A',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskB: Task = {
        id: 'task-b',
        projectId,
        taskId: 'T-B',
        description: 'Task B',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-a'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskC: Task = {
        id: 'task-c',
        projectId,
        taskId: 'T-C',
        description: 'Task C',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-b'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, taskA);
      await taskQueueManager.queueTask(projectId, taskB);
      await taskQueueManager.queueTask(projectId, taskC);

      // All should be blocked initially
      expect(await taskQueueManager.canTaskBeStarted('task-a')).toBe(true);
      expect(await taskQueueManager.canTaskBeStarted('task-b')).toBe(false);
      expect(await taskQueueManager.canTaskBeStarted('task-c')).toBe(false);

      // Get queue entries
      let queued = await taskQueueManager.getQueuedTasks(projectId);
      let queueA = queued.find((e) => e.taskId === 'task-a');

      // Complete A
      if (queueA) {
        await taskQueueManager.claimTask(queueA.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-a', 'agent-1');
      }
      expect(await taskQueueManager.canTaskBeStarted('task-b')).toBe(true);
      expect(await taskQueueManager.canTaskBeStarted('task-c')).toBe(false);

      // Complete B
      queued = await taskQueueManager.getQueuedTasks(projectId);
      let queueB = queued.find((e) => e.taskId === 'task-b');
      if (queueB) {
        await taskQueueManager.claimTask(queueB.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-b', 'agent-1');
      }
      expect(await taskQueueManager.canTaskBeStarted('task-c')).toBe(true);
    });
  });

  describe('Parallel Dependencies (A->C, B->C)', () => {
    test('should handle parallel convergent dependencies', async () => {
      const taskA: Task = {
        id: 'task-a',
        projectId,
        taskId: 'T-A',
        description: 'Task A',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskB: Task = {
        id: 'task-b',
        projectId,
        taskId: 'T-B',
        description: 'Task B',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskC: Task = {
        id: 'task-c',
        projectId,
        taskId: 'T-C',
        description: 'Task C (depends on A and B)',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-a', 'task-b'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, taskA);
      await taskQueueManager.queueTask(projectId, taskB);
      await taskQueueManager.queueTask(projectId, taskC);

      // C should be blocked
      expect(await taskQueueManager.canTaskBeStarted('task-c')).toBe(false);

      // Get queue entries
      let queued = await taskQueueManager.getQueuedTasks(projectId);
      let queueA = queued.find((e) => e.taskId === 'task-a');
      let queueB = queued.find((e) => e.taskId === 'task-b');

      // Complete only A
      if (queueA) {
        await taskQueueManager.claimTask(queueA.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-a', 'agent-1');
      }
      expect(await taskQueueManager.canTaskBeStarted('task-c')).toBe(false);

      // Complete B
      if (queueB) {
        await taskQueueManager.claimTask(queueB.id, 'agent-1', []);
        await taskQueueManager.markTaskComplete('task-b', 'agent-1');
      }
      expect(await taskQueueManager.canTaskBeStarted('task-c')).toBe(true);
    });
  });

  describe('Get Task Dependencies', () => {
    test('should return task dependencies', async () => {
      const dep1: Task = {
        id: 'task-dep1',
        projectId,
        taskId: 'T-DEP1',
        description: 'Dependency 1',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep1'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep1);
      await taskQueueManager.queueTask(projectId, task);

      const deps = await taskQueueManager.getTaskDependencies('task-1');
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe('task-dep1');
    });

    test('should return empty array for task with no dependencies', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);

      const deps = await taskQueueManager.getTaskDependencies('task-1');
      expect(deps).toHaveLength(0);
    });
  });

  describe('Check Dependency Completion', () => {
    test('should verify all dependencies are complete', async () => {
      const dep1: Task = {
        id: 'task-dep1',
        projectId,
        taskId: 'T-DEP1',
        description: 'Dependency 1',
        status: 'COMPLETE',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dep2: Task = {
        id: 'task-dep2',
        projectId,
        taskId: 'T-DEP2',
        description: 'Dependency 2',
        status: 'COMPLETE',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep1);
      await taskQueueManager.queueTask(projectId, dep2);

      const allComplete = await taskQueueManager.checkDependencyCompletion([
        'task-dep1',
        'task-dep2',
      ]);

      expect(allComplete).toBe(true);
    });

    test('should detect incomplete dependencies', async () => {
      const dep1: Task = {
        id: 'task-dep1',
        projectId,
        taskId: 'T-DEP1',
        description: 'Dependency 1',
        status: 'COMPLETE',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dep2: Task = {
        id: 'task-dep2',
        projectId,
        taskId: 'T-DEP2',
        description: 'Dependency 2',
        status: 'TODO', // Incomplete
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep1);
      await taskQueueManager.queueTask(projectId, dep2);

      const allComplete = await taskQueueManager.checkDependencyCompletion([
        'task-dep1',
        'task-dep2',
      ]);

      expect(allComplete).toBe(false);
    });
  });

  describe('Claiming with Dependency Checks', () => {
    test('should prevent claiming task with incomplete dependencies', async () => {
      const dep: Task = {
        id: 'task-dep',
        projectId,
        taskId: 'T-DEP',
        description: 'Dependency',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep);
      await taskQueueManager.queueTask(projectId, task);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      const taskQueueEntry = queued.find((e) => e.taskId === 'task-1');

      const result = await taskQueueManager.claimTask(taskQueueEntry!.id, 'agent-1', []);

      expect(result.claimed).toBe(false);
      expect(result.error).toContain('dependencies');
    });

    test('should allow claiming task with completed dependencies', async () => {
      const dep: Task = {
        id: 'task-dep',
        projectId,
        taskId: 'T-DEP',
        description: 'Dependency',
        status: 'COMPLETE',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep);
      await taskQueueManager.queueTask(projectId, task);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      const taskQueueEntry = queued.find((e) => e.taskId === 'task-1');

      const result = await taskQueueManager.claimTask(taskQueueEntry!.id, 'agent-1', []);

      expect(result.claimed).toBe(true);
    });
  });
});
