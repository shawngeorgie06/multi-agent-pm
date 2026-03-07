/**
 * Phase 2: MessageBus Delivery Tests
 * Tests basic pub/sub and direct messaging delivery patterns
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 2: MessageBus - Pub/Sub Delivery', () => {
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

  describe('Emit/Subscribe Pattern', () => {
    test('should emit to single subscriber', (done) => {
      const handler = jest.fn((data) => {
        expect(data).toEqual({ message: 'test' });
        done();
      });

      messageBus.on('test-channel', handler);
      messageBus.emit('test-channel', { message: 'test' });
    });

    test('should emit to multiple subscribers', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      messageBus.on('broadcast', handler1);
      messageBus.on('broadcast', handler2);
      messageBus.on('broadcast', handler3);

      messageBus.emit('broadcast', { data: 'test' });

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
        expect(handler3).toHaveBeenCalledTimes(1);
        expect(handler1).toHaveBeenCalledWith({ data: 'test' });
        done();
      }, 10);
    });

    test('should maintain FIFO subscriber order', (done) => {
      const callOrder: number[] = [];
      const handler1 = () => callOrder.push(1);
      const handler2 = () => callOrder.push(2);
      const handler3 = () => callOrder.push(3);

      messageBus.on('ordered', handler1);
      messageBus.on('ordered', handler2);
      messageBus.on('ordered', handler3);

      messageBus.emit('ordered', {});

      setTimeout(() => {
        expect(callOrder).toEqual([1, 2, 3]);
        done();
      }, 10);
    });

    test('should handle different channel isolation', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageBus.on('channel-a', handler1);
      messageBus.on('channel-b', handler2);

      messageBus.emit('channel-a', { test: 'a' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    test('should not emit to non-existent channel', () => {
      const handler = jest.fn();
      messageBus.on('existing', handler);

      messageBus.emit('nonexistent', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Unsubscribe Pattern', () => {
    test('should remove specific handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageBus.on('channel', handler1);
      messageBus.on('channel', handler2);

      messageBus.off('channel', handler1);
      messageBus.emit('channel', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test('should remove all handlers when no handler specified', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageBus.on('channel', handler1);
      messageBus.on('channel', handler2);

      messageBus.off('channel');
      messageBus.emit('channel', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    test('should handle unsubscribe from non-existent channel gracefully', () => {
      expect(() => {
        messageBus.off('nonexistent');
      }).not.toThrow();
    });
  });

  describe('Subscriber Count', () => {
    test('should track subscriber count correctly', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      expect(messageBus.getSubscriberCount('test')).toBe(0);

      messageBus.on('test', handler1);
      expect(messageBus.getSubscriberCount('test')).toBe(1);

      messageBus.on('test', handler2);
      expect(messageBus.getSubscriberCount('test')).toBe(2);

      messageBus.off('test', handler1);
      expect(messageBus.getSubscriberCount('test')).toBe(1);

      messageBus.off('test');
      expect(messageBus.getSubscriberCount('test')).toBe(0);
    });
  });

  describe('Error Handling in Handlers', () => {
    test('should continue emitting to other handlers if one throws', () => {
      const handler1 = jest.fn(() => {
        throw new Error('Handler error');
      });
      const handler2 = jest.fn();

      messageBus.on('test', handler1);
      messageBus.on('test', handler2);

      messageBus.emit('test', {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Phase 2: MessageBus - Direct Messaging', () => {
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

  describe('Direct Send', () => {
    test('should send message to specific recipient', (done) => {
      const handler = jest.fn((envelope) => {
        expect(envelope.to).toBe('agent-123');
        expect(envelope.content.text).toBe('Direct message');
        done();
      });

      messageBus.on('direct:agent-123', handler);

      messageBus.send('agent-123', {
        from: 'agent-456',
        projectId: 'proj-1',
        text: 'Direct message',
      });
    });

    test('should queue messages for offline agent', () => {
      messageBus.send('offline-agent', {
        from: 'agent-1',
        projectId: 'proj-1',
        text: 'Test message',
      });

      const messages = messageBus.getAgentMessages('offline-agent');
      expect(messages).toHaveLength(1);
      expect(messages[0].to).toBe('offline-agent');
    });

    test('should accumulate multiple direct messages', () => {
      messageBus.send('agent-1', { from: 'agent-2', projectId: 'proj-1', text: 'Msg 1' });
      messageBus.send('agent-1', { from: 'agent-3', projectId: 'proj-1', text: 'Msg 2' });
      messageBus.send('agent-1', { from: 'agent-4', projectId: 'proj-1', text: 'Msg 3' });

      const messages = messageBus.getAgentMessages('agent-1');
      expect(messages).toHaveLength(3);
    });
  });

  describe('EmitTo Pattern', () => {
    test('should emit directly to specific agent', (done) => {
      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('target-agent');
        done();
      });

      messageBus.on('task:assigned', handler);
      messageBus.emitTo('target-agent', 'task:assigned', { agentId: 'target-agent' });
    });

    test('should queue message for emitTo', () => {
      messageBus.emitTo('agent-123', 'event', { data: 'test' });

      const messages = messageBus.getAgentMessages('agent-123');
      expect(messages).toHaveLength(1);
      expect(messages[0].channel).toBe('event');
    });
  });

  describe('BroadcastExcept Pattern', () => {
    test('should broadcast to all agents except sender', () => {
      const handler = jest.fn();
      messageBus.on('task:available', handler);

      messageBus.broadcastExcept('agent-1', 'task:available', { taskId: 'task-123' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: 'task-123' });
    });
  });

  describe('Agent Message Queue', () => {
    test('should retrieve agent message queue', () => {
      messageBus.send('agent-1', { from: 'agent-2', projectId: 'proj-1', text: 'Test' });

      const messages = messageBus.getAgentMessages('agent-1');
      expect(messages).toHaveLength(1);
    });

    test('should clear agent message queue', () => {
      messageBus.send('agent-1', { from: 'agent-2', projectId: 'proj-1', text: 'Test' });
      expect(messageBus.getAgentMessages('agent-1')).toHaveLength(1);

      messageBus.clearAgentMessages('agent-1');
      expect(messageBus.getAgentMessages('agent-1')).toHaveLength(0);
    });
  });

  describe('Broadcast', () => {
    test('should broadcast to all subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageBus.on('broadcast', handler1);
      messageBus.on('project:started', handler2);

      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'project:started',
        projectId: 'proj-1',
        message: 'Project started',
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});
