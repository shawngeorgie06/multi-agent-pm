/**
 * Phase 3: Capability Matching Tests
 * Tests capability validation, matching algorithms, and edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import TaskQueueManager, { Task } from '../../src/services/TaskQueueManager';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 3: Capability Matching', () => {
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

  describe('Exact Capability Match', () => {
    test('should match with exact same capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript'],
        ['react', 'typescript']
      );

      expect(result).toBe(true);
    });

    test('should match single capability exactly', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['javascript'],
        ['javascript']
      );

      expect(result).toBe(true);
    });

    test('should match empty requirements', async () => {
      const result = await taskQueueManager.validateCapabilityMatch([], ['react', 'typescript']);

      expect(result).toBe(true);
    });

    test('should match with undefined requirements', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        undefined as any,
        ['react', 'typescript']
      );

      expect(result).toBe(true);
    });
  });

  describe('Superset Capability Match', () => {
    test('should match when agent has more capabilities than required', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react'],
        ['react', 'typescript', 'javascript']
      );

      expect(result).toBe(true);
    });

    test('should match superset with multiple requirements', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript'],
        ['react', 'typescript', 'javascript', 'css', 'html']
      );

      expect(result).toBe(true);
    });

    test('should match even with extra agent capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['html', 'css'],
        ['html', 'css', 'javascript', 'react', 'angular', 'vue']
      );

      expect(result).toBe(true);
    });
  });

  describe('Missing Capability Failures', () => {
    test('should fail when agent lacks single required capability', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript'],
        ['react'] // Missing typescript
      );

      expect(result).toBe(false);
    });

    test('should fail when agent lacks multiple capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript', 'nodejs'],
        ['react'] // Missing typescript and nodejs
      );

      expect(result).toBe(false);
    });

    test('should fail when agent has no capabilities but task requires some', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript'],
        [] // Empty capabilities
      );

      expect(result).toBe(false);
    });

    test('should fail with undefined agent capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript'],
        undefined as any
      );

      expect(result).toBe(false);
    });
  });

  describe('Case-Insensitive Matching', () => {
    test('should match capabilities with different cases', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['React', 'TypeScript'],
        ['react', 'typescript']
      );

      expect(result).toBe(true);
    });

    test('should match mixed case requirements', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['REACT', 'typescript'],
        ['react', 'TypeScript', 'JavaScript']
      );

      expect(result).toBe(true);
    });

    test('should handle all uppercase comparison', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['NODEJS', 'EXPRESS'],
        ['nodejs', 'express', 'mongodb']
      );

      expect(result).toBe(true);
    });

    test('should handle all lowercase comparison', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'vue'],
        ['REACT', 'VUE', 'ANGULAR']
      );

      expect(result).toBe(true);
    });
  });

  describe('Complex Requirement Matching', () => {
    test('should match complex frontend stack', async () => {
      const required = ['react', 'typescript', 'webpack', 'babel'];
      const available = ['react', 'typescript', 'webpack', 'babel', 'jest', 'eslint'];

      const result = await taskQueueManager.validateCapabilityMatch(required, available);

      expect(result).toBe(true);
    });

    test('should match complex backend stack', async () => {
      const required = ['nodejs', 'express', 'postgresql', 'redis'];
      const available = ['nodejs', 'express', 'postgresql', 'redis', 'mongoose', 'docker'];

      const result = await taskQueueManager.validateCapabilityMatch(required, available);

      expect(result).toBe(true);
    });

    test('should fail on complex stack with one missing capability', async () => {
      const required = ['nodejs', 'express', 'postgresql', 'redis'];
      const available = ['nodejs', 'express', 'postgresql']; // Missing redis

      const result = await taskQueueManager.validateCapabilityMatch(required, available);

      expect(result).toBe(false);
    });

    test('should match with many capabilities', async () => {
      const required = ['skill1', 'skill2', 'skill3'];
      const available = Array.from({ length: 100 }, (_, i) => `skill${i + 1}`);

      const result = await taskQueueManager.validateCapabilityMatch(required, available);

      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty arrays correctly', async () => {
      const result = await taskQueueManager.validateCapabilityMatch([], []);

      expect(result).toBe(true);
    });

    test('should handle whitespace in capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react'],
        ['react', 'vue angular'] // One capability with space
      );

      // Should still match because we're checking exact string match after lowercasing
      expect(result).toBe(true);
    });

    test('should handle duplicate capabilities in requirements', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'react', 'typescript'],
        ['react', 'typescript', 'javascript']
      );

      expect(result).toBe(true);
    });

    test('should handle duplicate capabilities in agent capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react', 'typescript'],
        ['react', 'react', 'typescript', 'typescript', 'javascript']
      );

      expect(result).toBe(true);
    });
  });

  describe('Integration with Task Claiming', () => {
    test('should claim task with matching capability stack', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Full-stack task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'nodejs', 'postgresql'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-fullstack',
        ['react', 'vue', 'nodejs', 'python', 'postgresql', 'mongodb']
      );

      expect(result.claimed).toBe(true);
    });

    test('should reject claim with partial capability match', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Full-stack task',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['react', 'nodejs', 'postgresql'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      const result = await taskQueueManager.claimTask(
        queued[0].id,
        'agent-frontend',
        ['react', 'vue'] // Missing nodejs and postgresql
      );

      expect(result.claimed).toBe(false);
    });

    test('should match multiple agents with different capability sets', async () => {
      const task: Task = {
        id: 'task-1',
        projectId,
        taskId: 'T-001',
        description: 'Task requiring javascript',
        status: 'TODO',
        priority: 'MEDIUM',
        dependencies: [],
        requiredCapabilities: ['javascript'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await taskQueueManager.queueTask(projectId, task);
      const queued = await taskQueueManager.getQueuedTasks(projectId);

      // Frontend agent
      const result1 = await taskQueueManager.claimTask(queued[0].id, 'agent-frontend', [
        'javascript',
        'react',
        'css',
      ]);

      expect(result1.claimed).toBe(true);
    });
  });

  describe('Capability Matching with Empty States', () => {
    test('should reject when agent has empty capability list and task requires skills', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(['react'], []);

      expect(result).toBe(false);
    });

    test('should accept any agent when task has empty requirements', async () => {
      const result = await taskQueueManager.validateCapabilityMatch([], ['react']);

      expect(result).toBe(true);
    });

    test('should handle null/undefined gracefully', async () => {
      const result1 = await taskQueueManager.validateCapabilityMatch(null as any, ['react']);
      expect(result1).toBe(true); // null treated as empty

      const result2 = await taskQueueManager.validateCapabilityMatch(['react'], null as any);
      expect(result2).toBe(false);
    });
  });

  describe('Capability Name Variations', () => {
    test('should match framework names correctly', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react.js'],
        ['react.js', 'typescript']
      );

      expect(result).toBe(true);
    });

    test('should match version-specific capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['node:18', 'npm:8'],
        ['node:18', 'npm:8', 'yarn']
      );

      expect(result).toBe(true);
    });

    test('should match semantic versioning in capabilities', async () => {
      const result = await taskQueueManager.validateCapabilityMatch(
        ['react@18.0.0', 'typescript@4.9.0'],
        ['react@18.0.0', 'typescript@4.9.0', 'webpack@5.0.0']
      );

      expect(result).toBe(true);
    });
  });
});
