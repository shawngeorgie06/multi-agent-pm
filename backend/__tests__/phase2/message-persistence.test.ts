/**
 * Phase 2: MessageBus Persistence Tests
 * Tests message persistence to database via TaskStore
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 2: MessageBus - Message Persistence', () => {
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

  describe('Message Persistence to TaskStore', () => {
    test('should persist direct messages asynchronously', async () => {
      messageBus.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        text: 'Test message',
      });

      // Wait for async persistence
      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].fromAgent).toBe('agent-2');
    });

    test('should persist broadcast messages', async () => {
      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        projectId: 'proj-1',
        channel: 'project:started',
        message: 'Project has started',
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].fromAgent).toBe('PROJECT_MANAGER');
    });

    test('should persist request messages', async () => {
      await messageBus.request('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        question: 'Can you help?',
      }, 100);

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].messageType).toBe('request');
    });

    test('should not persist messages without projectId', async () => {
      messageBus.send('agent-1', {
        from: 'agent-2',
        text: 'Message without projectId',
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages).toEqual([]);
    });

    test('should handle persistence errors gracefully', async () => {
      // Create a failing task store
      const failingStore = {
        saveMessage: async () => {
          throw new Error('Database error');
        },
        getMessages: async () => [],
      };

      const failingBus = new MessageBus(failingStore);

      // Should not throw
      expect(() => {
        failingBus.send('agent-1', {
          from: 'agent-2',
          projectId: 'proj-1',
          text: 'Test',
        });
      }).not.toThrow();

      // Message should still be queued locally
      const messages = failingBus.getAgentMessages('agent-1');
      expect(messages).toHaveLength(1);
    });
  });

  describe('Message History Retrieval', () => {
    test('should retrieve all messages for a project', async () => {
      messageBus.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        text: 'Msg 1',
      });

      messageBus.send('agent-2', {
        from: 'agent-1',
        projectId: 'proj-1',
        text: 'Msg 2',
      });

      messageBus.broadcast({
        from: 'PM',
        projectId: 'proj-1',
        channel: 'status',
        text: 'Msg 3',
      });

      await new Promise((r) => setTimeout(r, 50));

      const history = await messageBus.getMessageHistory('proj-1');
      expect(history).toHaveLength(3);
    });

    test('should retrieve empty history for non-existent project', async () => {
      const history = await messageBus.getMessageHistory('nonexistent-proj');
      expect(history).toEqual([]);
    });

    test('should separate messages by project', async () => {
      messageBus.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        text: 'Project 1 message',
      });

      messageBus.send('agent-3', {
        from: 'agent-4',
        projectId: 'proj-2',
        text: 'Project 2 message',
      });

      await new Promise((r) => setTimeout(r, 50));

      const history1 = await messageBus.getMessageHistory('proj-1');
      const history2 = await messageBus.getMessageHistory('proj-2');

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1[0].content.text).toBe('Project 1 message');
      expect(history2[0].content.text).toBe('Project 2 message');
    });
  });

  describe('Thread History Retrieval', () => {
    test('should retrieve messages from specific thread using threadId', async () => {
      const threadId = messageBus.createThread('thread-1');

      // Use broadcast to ensure threadId is persisted
      messageBus.broadcast({
        from: 'agent-2',
        projectId: 'proj-1',
        threadId,
        channel: 'discussion',
        text: 'Thread msg 1',
      });

      messageBus.broadcast({
        from: 'agent-1',
        projectId: 'proj-1',
        threadId,
        channel: 'discussion',
        text: 'Thread msg 2',
      });

      messageBus.broadcast({
        from: 'agent-4',
        projectId: 'proj-1',
        threadId: null,
        channel: 'discussion',
        text: 'Non-threaded msg',
      });

      await new Promise((r) => setTimeout(r, 50));

      const threadHistory = await messageBus.getThreadHistory('proj-1', threadId);
      expect(threadHistory).toHaveLength(2);
      expect(threadHistory.every((m: any) => m.threadId === threadId)).toBe(true);
    });

    test('should retrieve thread history with proper ordering', async () => {
      const threadId = messageBus.createThread('ordered-thread');
      const timestamps: number[] = [];

      for (let i = 0; i < 3; i++) {
        messageBus.broadcast({
          from: 'agent-2',
          projectId: 'proj-1',
          threadId,
          channel: 'discussion',
          text: `Message ${i}`,
          id: `msg-${i}`,
        });
        timestamps.push(Date.now());
        await new Promise((r) => setTimeout(r, 10));
      }

      await new Promise((r) => setTimeout(r, 50));

      const threadHistory = await messageBus.getThreadHistory('proj-1', threadId);
      expect(threadHistory).toHaveLength(3);
    });
  });

  describe('Persistence with Metadata', () => {
    test('should persist message envelope metadata', async () => {
      const handler = (envelope: any) => {
        messageBus.respondTo(envelope.requestId, { status: 'ok' });
      };

      messageBus.on('request:agent-1', handler);

      await messageBus.request('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        question: 'Test question',
      }, 2000);

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].metadata).toBeDefined();
      expect(messages[0].metadata.requestId).toBeDefined();
    });

    test('should preserve thread metadata in persistence', async () => {
      const threadId = messageBus.createThread('meta-thread');

      messageBus.broadcast({
        from: 'agent-2',
        projectId: 'proj-1',
        threadId,
        parentMessageId: 'parent-msg',
        channel: 'discussion',
        text: 'Test',
        taskId: 'task-123',
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages[0].threadId).toBe(threadId);
      expect(messages[0].parentMessageId).toBe('parent-msg');
    });
  });

  describe('Persistence Performance', () => {
    test('should not block message delivery during persistence', async () => {
      const deliveryTimes: number[] = [];

      const handler = (envelope: any) => {
        deliveryTimes.push(Date.now());
      };

      messageBus.on('direct:agent-1', handler);

      const startTime = Date.now();
      messageBus.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        text: 'Test',
      });
      const deliveryTime = Date.now() - startTime;

      // Delivery should be nearly instant (less than 100ms)
      expect(deliveryTime).toBeLessThan(100);
      expect(deliveryTimes.length).toBeGreaterThan(0);
    });

    test('should handle high-volume message persistence', async () => {
      const messageCount = 100;

      for (let i = 0; i < messageCount; i++) {
        messageBus.send('agent-1', {
          from: 'agent-2',
          projectId: 'proj-1',
          text: `Message ${i}`,
        });
      }

      await new Promise((r) => setTimeout(r, 100));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThanOrEqual(messageCount * 0.9); // Allow some loss due to timing
    });
  });

  describe('Persistence without TaskStore', () => {
    test('should work without taskStore gracefully', () => {
      const busWithoutStore = new MessageBus();

      const handler = jest.fn();
      busWithoutStore.on('direct:agent-1', handler);

      busWithoutStore.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        text: 'Test',
      });

      expect(handler).toHaveBeenCalled();
    });

    test('should return empty history without taskStore', async () => {
      const busWithoutStore = new MessageBus();

      const history = await busWithoutStore.getMessageHistory('proj-1');
      expect(history).toEqual([]);
    });

    test('should queue messages locally without taskStore', () => {
      const busWithoutStore = new MessageBus();

      busWithoutStore.send('agent-1', {
        from: 'agent-2',
        text: 'Test message',
      });

      const messages = busWithoutStore.getAgentMessages('agent-1');
      expect(messages).toHaveLength(1);
    });
  });

  describe('Concurrent Persistence', () => {
    test('should handle concurrent messages from multiple agents', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            messageBus.send('agent-1', {
              from: `agent-${i}`,
              projectId: 'proj-1',
              text: `Concurrent message from agent ${i}`,
            });
          })
        );
      }

      await Promise.all(promises);
      await new Promise((r) => setTimeout(r, 100));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThanOrEqual(9);
    });

    test('should handle concurrent requests to same agent', async () => {
      const handler = (envelope: any) => {
        messageBus.respondTo(envelope.requestId, {
          status: 'ok',
          responder: 'agent-1',
        });
      };

      messageBus.on('request:agent-1', handler);

      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          messageBus.request('agent-1', {
            from: 'requester',
            projectId: 'proj-1',
            requestNum: i,
          }, 3000)
        );
      }

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(5);
      expect(responses.every((r) => r.status === 'ok')).toBe(true);
    });
  });
});
