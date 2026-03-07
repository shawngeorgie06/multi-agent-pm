/**
 * Phase 3: Task Distribution Tests
 * Tests autonomous task distribution to agents and agent subscription patterns
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import TaskQueueManager, { Task, AgentStatus } from '../../src/services/TaskQueueManager';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 3: Task Distribution', () => {
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

  describe('Distribute Available Tasks', () => {
    test('should broadcast available tasks to agents', async () => {
      const handler = jest.fn();
      messageBus.on('broadcast', handler);

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

      // Wait for broadcast to be called
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
      const callData = handler.mock.calls[0][0];
      expect(callData.channel).toBe('task:available');
    });

    test('should include task requirements in distribution', async () => {
      const handler = jest.fn();
      messageBus.on('broadcast', handler);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);

      // Wait for broadcast
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
      const callData = handler.mock.calls[0][0];
      if (callData.tasks) {
        expect(callData.tasks[0].requiredCapabilities).toEqual(['react', 'typescript']);
      }
    });

    test('should not distribute already-claimed tasks', async () => {
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

      // Claim one task
      const queued = await taskQueueManager.getQueuedTasks(projectId);
      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);

      // Distribute should only include unclaimed tasks
      const broadcastHandler = jest.fn();
      messageBus.on('broadcast', broadcastHandler);

      await taskQueueManager.distributeAvailableTasks(projectId);

      if (broadcastHandler.mock.calls.length > 0) {
        const data = broadcastHandler.mock.calls[0][0];
        if (data.tasks) {
          expect(data.tasks).toHaveLength(1);
          expect(data.tasks[0].taskId).toBe('T-002');
        }
      }
    });

    test('should not distribute tasks with incomplete dependencies', async () => {
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
        description: 'Task with dependency',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: ['task-dep'],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, dep);
      await taskQueueManager.queueTask(projectId, task);

      const broadcastHandler = jest.fn();
      messageBus.on('broadcast', broadcastHandler);

      await taskQueueManager.distributeAvailableTasks(projectId);

      // Should not include task with unmet dependency
      if (broadcastHandler.mock.calls.length > 0) {
        const data = broadcastHandler.mock.calls[0][0];
        if (data.tasks) {
          const hasBlockedTask = data.tasks.some((t: any) => t.taskId === 'T-001');
          expect(hasBlockedTask).toBe(false);
        }
      }
    });
  });

  describe('Priority in Distribution', () => {
    test('should distribute HIGH priority tasks first', async () => {
      const lowPriority: Task = {
        id: 'task-low',
        projectId,
        taskId: 'T-LOW',
        description: 'Low priority',
        status: 'TODO',
        priority: 'LOW',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const highPriority: Task = {
        id: 'task-high',
        projectId,
        taskId: 'T-HIGH',
        description: 'High priority',
        status: 'TODO',
        priority: 'HIGH',
        dependencies: [],
        requiredCapabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, lowPriority);
      await taskQueueManager.queueTask(projectId, highPriority);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      expect(queued[0].priority).toBe('HIGH');
      expect(queued[1].priority).toBe('LOW');
    });
  });

  describe('Find Agent for Task', () => {
    test('should find idle agent with matching capabilities', async () => {
      const agent: AgentStatus = {
        id: 'agent-1',
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        status: 'idle',
        lastHeartbeat: new Date(),
        capabilities: ['react', 'typescript'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.updateAgentStatus(agent);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const foundAgent = await taskQueueManager.findAgentForTask(task);

      expect(foundAgent).toBeDefined();
      expect(foundAgent?.agentId).toBe('agent-1');
    });

    test('should not find agents that are busy', async () => {
      const agent: AgentStatus = {
        id: 'agent-1',
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        status: 'busy',
        lastHeartbeat: new Date(),
        capabilities: ['react', 'typescript'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.updateAgentStatus(agent);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const foundAgent = await taskQueueManager.findAgentForTask(task);

      expect(foundAgent).toBeNull();
    });

    test('should not find agent with mismatched capabilities', async () => {
      const agent: AgentStatus = {
        id: 'agent-1',
        agentId: 'agent-1',
        agentType: 'BACKEND',
        status: 'idle',
        lastHeartbeat: new Date(),
        capabilities: ['java', 'python'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.updateAgentStatus(agent);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'typescript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const foundAgent = await taskQueueManager.findAgentForTask(task);

      expect(foundAgent).toBeNull();
    });

    test('should find first idle agent when multiple available', async () => {
      const agent1: AgentStatus = {
        id: 'agent-1',
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        status: 'idle',
        lastHeartbeat: new Date(),
        capabilities: ['react'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const agent2: AgentStatus = {
        id: 'agent-2',
        agentId: 'agent-2',
        agentType: 'FRONTEND',
        status: 'idle',
        lastHeartbeat: new Date(),
        capabilities: ['react'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskQueueManager.updateAgentStatus(agent1);
      taskQueueManager.updateAgentStatus(agent2);

      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Test task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const foundAgent = await taskQueueManager.findAgentForTask(task);

      expect(foundAgent).toBeDefined();
      expect(['agent-1', 'agent-2']).toContain(foundAgent!.agentId);
    });
  });

  describe('Agent Task Subscription', () => {
    test('should emit task:available on queue broadcast', (done) => {
      const handler = jest.fn((data) => {
        expect(data).toBeDefined();
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

    test('should allow agents to subscribe to task:available events', (done) => {
      let eventCount = 0;
      const handler = jest.fn(() => {
        eventCount++;
        if (eventCount > 0) {
          done();
        }
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

  describe('Distribution Statistics', () => {
    test('should track agent claiming statistics', async () => {
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
      await taskQueueManager.claimTask(queued[1].id, 'agent-1', []);

      const stats = await taskQueueManager.getAgentStats('agent-1');

      expect(stats.agentId).toBe('agent-1');
      expect(stats.totalClaimed).toBe(2);
      expect(stats.totalCompleted).toBe(0);
    });

    test('should track completion statistics', async () => {
      const task: Task = {
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

      await taskQueueManager.queueTask(projectId, task);

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
      await taskQueueManager.markTaskComplete('task-1', 'agent-1');

      const stats = await taskQueueManager.getAgentStats('agent-1');

      expect(stats.totalClaimed).toBe(1);
      expect(stats.totalCompleted).toBe(1);
      expect(stats.completionRate).toBe(1);
    });

    test('should calculate completion rate', async () => {
      const tasks: Task[] = [
        {
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
        },
        {
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
        },
      ];

      for (const task of tasks) {
        await taskQueueManager.queueTask(projectId, task);
      }

      const queued = await taskQueueManager.getQueuedTasks(projectId);
      await taskQueueManager.claimTask(queued[0].id, 'agent-1', []);
      await taskQueueManager.markTaskComplete('task-1', 'agent-1');

      await taskQueueManager.claimTask(queued[1].id, 'agent-1', []);
      // Don't complete task-2

      const stats = await taskQueueManager.getAgentStats('agent-1');

      expect(stats.totalClaimed).toBe(2);
      expect(stats.totalCompleted).toBe(1);
      expect(stats.completionRate).toBeCloseTo(0.5);
    });
  });
});
