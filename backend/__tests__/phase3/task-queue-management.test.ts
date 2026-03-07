/**
 * Phase 3: Task Queue Management Tests
 * Tests basic task queuing, queue management, and priority ordering
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import TaskQueueManager, { Task, TaskQueueEntry } from '../../src/services/TaskQueueManager';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 3: Task Queue Management', () => {
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

  describe('Add Task to Queue', () => {
    test('should add a single task to queue', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['javascript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued).toHaveLength(1);
      expect(queued[0].taskId).toBe('task-1');
    });

    test('should add multiple tasks to queue', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          projectId,
          taskId: 'T-001',
          description: 'Test task 1',
          status: 'TODO',
          priority: 'MEDIUM',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          projectId,
          taskId: 'T-002',
          description: 'Test task 2',
          status: 'TODO',
          priority: 'LOW',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          projectId,
          taskId: 'T-003',
          description: 'Test task 3',
          status: 'TODO',
          priority: 'HIGH',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const task of tasks) {
        await taskQueueManager.queueTask(projectId, task);
      }

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued).toHaveLength(3);
    });

    test('should queue task with required capabilities', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Frontend task',
        status: 'TODO',
        priority: 'HIGH',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued[0].requiredCapabilities).toEqual(['react', 'typescript']);
    });

    test('should queue task with dependencies', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Dependent task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-0', 'task-2'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued[0]).toBeDefined();
    });
  });

  describe('Queue Ordering by Priority', () => {
    test('should order queue by priority (HIGH, MEDIUM, LOW)', async () => {
      const tasks: Task[] = [
        {
          id: 'low',
          projectId,
          taskId: 'T-001',
          description: 'Low priority',
          status: 'TODO',
          priority: 'LOW',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'high',
          projectId,
          taskId: 'T-002',
          description: 'High priority',
          status: 'TODO',
          priority: 'HIGH',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'medium',
          projectId,
          taskId: 'T-003',
          description: 'Medium priority',
          status: 'TODO',
          priority: 'MEDIUM',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Add in random order
      for (const task of tasks) {
        await taskQueueManager.queueTask(projectId, task);
      }

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued[0].priority).toBe('HIGH');
      expect(queued[1].priority).toBe('MEDIUM');
      expect(queued[2].priority).toBe('LOW');
    });

    test('should maintain FIFO order within same priority level', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          projectId,
          taskId: 'T-001',
          description: 'First task',
          status: 'TODO',
          priority: 'MEDIUM',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(Date.now() - 2000),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          projectId,
          taskId: 'T-002',
          description: 'Second task',
          status: 'TODO',
          priority: 'MEDIUM',
          dependencies: [],
          requiredCapabilities: [],
          createdAt: new Date(Date.now() - 1000),
          updatedAt: new Date(),
        },
      ];

      for (const task of tasks) {
        await taskQueueManager.queueTask(projectId, task);
      }

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued[0].taskId).toBe('task-1');
      expect(queued[1].taskId).toBe('task-2');
    });
  });

  describe('Get Queued Tasks', () => {
    test('should return empty array for non-existent project', async () => {
      const queued = await taskQueueManager.getQueuedTasks('non-existent');
      expect(queued).toEqual([]);
    });

    test('should return only unclaimed tasks', async () => {
      const task1: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task 1',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId,
        taskId: 'T-002',
        description: 'Task 2',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task1);
      await taskQueueManager.queueTask(projectId, task2);

      // Claim the first task
      const result = await taskQueueManager.claimTask(
        (await taskQueueManager.getQueuedTasks(projectId))[0].id,
        'agent-1',
        []
      );
      expect(result.claimed).toBe(true);

      // Should only return unclaimed task
      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued).toHaveLength(1);
      expect(queued[0].taskId).toBe('task-2');
    });
  });

  describe('Remove Task from Queue', () => {
    test('should remove a task from queue', async () => {
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

      await taskQueueManager.removeFromQueue(queueEntryId);

      const afterRemoval = await taskQueueManager.getQueuedTasks(projectId);
      expect(afterRemoval).toHaveLength(0);
    });

    test('should not error when removing non-existent queue entry', async () => {
      const result = await taskQueueManager.removeFromQueue('non-existent-id');
      expect(result).toBeUndefined();
    });

    test('should remove only the specified queue entry', async () => {
      const task1: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task 1',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId,
        taskId: 'T-002',
        description: 'Task 2',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task1);
      await taskQueueManager.queueTask(projectId, task2);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      await taskQueueManager.removeFromQueue(queued[0].id);

      const afterRemoval = await taskQueueManager.getQueuedTasks(projectId);
      expect(afterRemoval).toHaveLength(1);
      expect(afterRemoval[0].taskId).toBe('task-2');
    });
  });

  describe('Multiple Projects Isolation', () => {
    test('should isolate queues between projects', async () => {
      const projectId1 = 'project-1';
      const projectId2 = 'project-2';

      const task1: Task = {
        id: 'task-1',
        projectId: projectId1,
        taskId: 'T-001',
        description: 'Task 1',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId: projectId2,
        taskId: 'T-002',
        description: 'Task 2',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId1, task1);
      await taskQueueManager.queueTask(projectId2, task2);

      const queue1 = await taskQueueManager.getQueuedTasks(projectId1);
      const queue2 = await taskQueueManager.getQueuedTasks(projectId2);

      expect(queue1).toHaveLength(1);
      expect(queue2).toHaveLength(1);
      expect(queue1[0].taskId).toBe('task-1');
      expect(queue2[0].taskId).toBe('task-2');
    });
  });

  describe('Queue Statistics', () => {
    test('should return queue statistics', async () => {
      const task1: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task 1',
        status: 'TODO',
        priority: 'HIGH',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId,
        taskId: 'T-002',
        description: 'Task 2',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task3: Task = {
        id: 'task-3',
        projectId,
        taskId: 'T-003',
        description: 'Task 3',
        status: 'TODO',
        priority: 'LOW',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task1);
      await taskQueueManager.queueTask(projectId, task2);
      await taskQueueManager.queueTask(projectId, task3);

      const stats = await taskQueueManager.getQueueStats(projectId);

      expect(stats.projectId).toBe(projectId);
      expect(stats.totalQueued).toBe(3);
      expect(stats.claimed).toBe(0);
      expect(stats.unclaimed).toBe(3);
      expect(stats.highPriority).toBe(1);
      expect(stats.mediumPriority).toBe(1);
      expect(stats.lowPriority).toBe(1);
    });

    test('should include claimed tasks in statistics', async () => {
      const task1: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task 1',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId,
        taskId: 'T-002',
        description: 'Task 2',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task1);
      await taskQueueManager.queueTask(projectId, task2);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);

      const stats = await taskQueueManager.getQueueStats(projectId);

      expect(stats.totalQueued).toBe(2);
      expect(stats.claimed).toBe(1);
      expect(stats.unclaimed).toBe(1);
    });
  });

  describe('MessageBus Integration', () => {
    test('should emit task:available event when task is queued', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.projectId).toBe(projectId);
        done();
      });

      messageBus.on('task:available', handler);

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

      taskQueueManager.queueTask(projectId, task);
    });
  });
});
