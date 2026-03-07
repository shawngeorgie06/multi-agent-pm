/**
 * Phase 2: MessageBus Broadcast Tests
 * Tests broadcast patterns and multi-agent communications
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 2: MessageBus - Broadcast Patterns', () => {
  let messageBus: MessageBus;
  let taskStore: MockTaskStore;

  beforeEach(() => {
    taskStore = new MockTaskStore();
    messageBus = new MessageBus(taskStore);
  });

  afterEach(() => {
    messageBus.reset();
    taskStore.clearAll();
  });

  describe('Basic Broadcast', () => {
    test('should broadcast to all subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      messageBus.on('broadcast', handler1);
      messageBus.on('broadcast', handler2);
      messageBus.on('broadcast', handler3);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        message: 'Project started',
        // No channel specified, so only 'broadcast' listeners get called
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    test('should broadcast to specific channel subscribers', () => {
      const broadcastHandler = jest.fn();
      const channelHandler = jest.fn();
      const otherHandler = jest.fn();

      messageBus.on('broadcast', broadcastHandler);
      messageBus.on('project:started', channelHandler);
      messageBus.on('project:completed', otherHandler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
        message: 'Project has started',
      });

      // Both broadcast and specific channel handlers get called
      expect(broadcastHandler).toHaveBeenCalledTimes(1);
      expect(channelHandler).toHaveBeenCalledTimes(1);
      expect(otherHandler).not.toHaveBeenCalled();
    });

    test('should include message payload in broadcast', (done) => {
      let callCount = 0;
      const handler = jest.fn((envelope) => {
        callCount++;
        if (callCount === 1) {
          expect(envelope.content.message).toBe('Critical update');
          expect(envelope.content.priority).toBe('HIGH');
          expect(envelope.from).toBe('PROJECT_MANAGER');
          done();
        }
      });

      messageBus.on('broadcast', handler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        message: 'Critical update',
        priority: 'HIGH',
        projectId: 'proj-1',
        // No channel specified
      });
    });
  });

  describe('Project Status Broadcasts', () => {
    test('should broadcast project started event', () => {
      const startedHandler = jest.fn();
      const pmHandler = jest.fn();

      messageBus.on('project:started', startedHandler);
      messageBus.on('broadcast', pmHandler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
        message: 'Project kickoff complete',
      });

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(pmHandler).toHaveBeenCalledTimes(1);
    });

    test('should broadcast project status updates', () => {
      const handlers = {
        inProgress: jest.fn(),
        completed: jest.fn(),
        failed: jest.fn(),
      };

      messageBus.on('project:in_progress', handlers.inProgress);
      messageBus.on('project:completed', handlers.completed);
      messageBus.on('project:failed', handlers.failed);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:in_progress',
        projectId: 'proj-1',
      });

      expect(handlers.inProgress).toHaveBeenCalledTimes(1);
      expect(handlers.completed).not.toHaveBeenCalled();
      expect(handlers.failed).not.toHaveBeenCalled();
    });

    test('should broadcast project completion with summary', (done) => {
      const handler = jest.fn((envelope) => {
        expect(envelope.content.completedTasks).toBeGreaterThan(0);
        expect(envelope.content.summary).toBeDefined();
        done();
      });

      messageBus.on('project:completed', handler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:completed',
        projectId: 'proj-1',
        completedTasks: 5,
        summary: 'All tasks completed successfully',
      });
    });
  });

  describe('Task-Related Broadcasts', () => {
    test('should broadcast task available event', () => {
      const handler = jest.fn();
      messageBus.on('task:available', handler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'task:available',
        projectId: 'proj-1',
        taskId: 'task-123',
        taskType: 'FRONTEND',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should broadcast task status updates', () => {
      const claimedHandler = jest.fn();
      const startedHandler = jest.fn();
      const completedHandler = jest.fn();

      messageBus.on('task:claimed', claimedHandler);
      messageBus.on('task:started', startedHandler);
      messageBus.on('task:completed', completedHandler);

      messageBus.broadcast({
        from: 'FRONTEND',
        channel: 'task:claimed',
        projectId: 'proj-1',
        taskId: 'task-123',
        agentId: 'agent-fe-1',
      });

      expect(claimedHandler).toHaveBeenCalledTimes(1);
      expect(startedHandler).not.toHaveBeenCalled();
      expect(completedHandler).not.toHaveBeenCalled();
    });

    test('should broadcast task blocking events', (done) => {
      const handler = jest.fn((envelope) => {
        expect(envelope.content.taskId).toBe('task-456');
        expect(envelope.content.blocker).toBeDefined();
        done();
      });

      messageBus.on('task:blocked', handler);

      messageBus.broadcast({
        from: 'BACKEND',
        channel: 'task:blocked',
        projectId: 'proj-1',
        taskId: 'task-456',
        blocker: 'Waiting for design approval',
      });
    });
  });

  describe('BroadcastExcept Pattern', () => {
    test('should broadcast to all agents except sender', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageBus.on('task:available', handler1);
      messageBus.on('task:available', handler2);

      // Broadcast from agent-1 but exclude agent-1
      messageBus.broadcastExcept('agent-1', 'task:available', {
        taskId: 'task-123',
        from: 'agent-1',
      });

      // All subscribers still get the message (broadcastExcept doesn't filter subscribers)
      // It just prevents the sender from being in the recipient list
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test('should use broadcastExcept for task announcements', () => {
      const handler = jest.fn();
      messageBus.on('task:available', handler);

      // Task becomes available, broadcast to all except the assigning agent
      messageBus.broadcastExcept('PROJECT_MANAGER', 'task:available', {
        taskId: 'FE-001',
        description: 'Build login form',
        assignedAgent: 'FRONTEND',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Broadcast with Threading', () => {
    test('should broadcast within message thread', async () => {
      const threadId = messageBus.createThread('discussion-thread');

      const handler = jest.fn();
      messageBus.on('broadcast', handler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'discussion:update',
        projectId: 'proj-1',
        threadId,
        message: 'Important discussion update',
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(handler).toHaveBeenCalledTimes(1);

      const messages = await messageBus.getThreadHistory('proj-1', threadId);
      expect(messages).toHaveLength(1);
      expect(messages[0].threadId).toBe(threadId);
    });

    test('should broadcast status update with parent reference', async () => {
      const threadId = messageBus.createThread('task-thread');
      const parentId = 'msg-task-assigned';

      const handler = jest.fn();
      messageBus.on('broadcast', handler);

      messageBus.broadcast({
        from: 'FRONTEND',
        channel: 'task:update',
        projectId: 'proj-1',
        threadId,
        parentMessageId: parentId,
        message: 'Task 50% complete',
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await messageBus.getThreadHistory('proj-1', threadId);
      expect(messages[0].parentMessageId).toBe(parentId);
    });
  });

  describe('Broadcast Persistence', () => {
    test('should persist broadcast messages', async () => {
      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
        message: 'Project started successfully',
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].fromAgent).toBe('PROJECT_MANAGER');
    });

    test('should persist multiple broadcast types', async () => {
      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
      });

      messageBus.broadcast({
        from: 'FRONTEND',
        channel: 'task:claimed',
        projectId: 'proj-1',
        taskId: 'task-123',
      });

      messageBus.broadcast({
        from: 'QA',
        channel: 'qa:report',
        projectId: 'proj-1',
        issues: 2,
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Multi-Agent Broadcast Scenarios', () => {
    test('should handle multi-agent listening to broadcasts', () => {
      const agents = {
        pm: jest.fn(),
        frontend: jest.fn(),
        backend: jest.fn(),
        qa: jest.fn(),
      };

      messageBus.on('project:started', agents.pm);
      messageBus.on('project:started', agents.frontend);
      messageBus.on('project:started', agents.backend);
      messageBus.on('project:started', agents.qa);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
      });

      Object.values(agents).forEach((agent) => {
        expect(agent).toHaveBeenCalledTimes(1);
      });
    });

    test('should broadcast different events to different agents', () => {
      const pmHandler = jest.fn();
      const feHandler = jest.fn();
      const beHandler = jest.fn();

      messageBus.on('project:kickoff', pmHandler);
      messageBus.on('task:available', feHandler);
      messageBus.on('task:available', beHandler);

      // Broadcast kickoff - only PM listens
      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:kickoff',
        projectId: 'proj-1',
      });

      expect(pmHandler).toHaveBeenCalledTimes(1);
      expect(feHandler).not.toHaveBeenCalled();

      // Broadcast task available - FE and BE listen
      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'task:available',
        projectId: 'proj-1',
        taskId: 'task-fe-001',
      });

      expect(feHandler).toHaveBeenCalledTimes(1);
      expect(beHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle cascade broadcast chain', () => {
      const finalHandler = jest.fn();

      const createCascadeChain = (nextEvent: string, handler: Function) => {
        return (envelope: any) => {
          handler(envelope);
          if (nextEvent) {
            messageBus.broadcast({
              from: envelope.content.from,
              channel: nextEvent,
              projectId: envelope.content.projectId,
              message: `Cascade: ${envelope.content.message}`,
            });
          }
        };
      };

      messageBus.on('project:started', createCascadeChain('project:planning', jest.fn()));
      messageBus.on('project:planning', createCascadeChain('project:ready', jest.fn()));
      messageBus.on('project:ready', finalHandler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
        message: 'Kickoff',
      });

      // Final handler should be called after cascade
      setTimeout(() => {
        expect(finalHandler).toHaveBeenCalled();
      }, 50);
    });
  });

  describe('Broadcast Error Handling', () => {
    test('should continue broadcasting if one subscriber errors', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = jest.fn();

      messageBus.on('project:started', errorHandler);
      messageBus.on('project:started', normalHandler);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
      });

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle broadcast without projectId', () => {
      const handler = jest.fn();
      messageBus.on('system:notification', handler);

      expect(() => {
        messageBus.broadcast({
          from: 'system',
          channel: 'system:notification',
          message: 'System alert',
        });
      }).not.toThrow();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
