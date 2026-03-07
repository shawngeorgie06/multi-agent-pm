/**
 * Phase 2: MessageBus Request/Response Tests
 * Tests request/response pattern with timeout and response handling
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 2: MessageBus - Request/Response Pattern', () => {
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

  describe('Request Pattern', () => {
    test('should send request with requestId', async () => {
      const handler = jest.fn();
      messageBus.on('request:agent-1', handler);

      const promise = messageBus.request('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        question: 'Can you do this task?',
      });

      // Allow time for handler to be called
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      const call = handler.mock.calls[0][0];
      expect(call.requestId).toBeDefined();
      expect(call.from).toBe('agent-2');
    });

    test('should queue request message for recipient', async () => {
      await messageBus.request('offline-agent', {
        from: 'agent-1',
        projectId: 'proj-1',
        question: 'Test',
      });

      const messages = messageBus.getAgentMessages('offline-agent');
      expect(messages).toHaveLength(1);
      expect(messages[0].requestId).toBeDefined();
    });

    test('should timeout after default 5000ms', async () => {
      const startTime = Date.now();
      const response = await messageBus.request(
        'nonresponsive-agent',
        {
          from: 'agent-1',
          projectId: 'proj-1',
          question: 'Will this timeout?',
        },
        1000 // 1 second timeout for faster test
      );

      const elapsed = Date.now() - startTime;

      expect(response.error).toBe('timeout');
      expect(response.requestId).toBeDefined();
      expect(elapsed).toBeGreaterThanOrEqual(900); // Allow small variance
    });

    test('should timeout with custom timeout value', async () => {
      const startTime = Date.now();
      const response = await messageBus.request(
        'agent-1',
        { from: 'agent-2', projectId: 'proj-1', question: 'Test' },
        2000 // 2 second custom timeout
      );

      const elapsed = Date.now() - startTime;

      expect(response.error).toBe('timeout');
      expect(elapsed).toBeGreaterThanOrEqual(1900);
    });

    test('should resolve with response when respondTo is called', async () => {
      let capturedRequestId: string = '';

      const handler = (envelope: any) => {
        capturedRequestId = envelope.requestId;
        // Simulate agent responding
        messageBus.respondTo(capturedRequestId, {
          status: 'ok',
          result: 'Task completed',
        });
      };

      messageBus.on('request:agent-1', handler);

      const response = await messageBus.request(
        'agent-1',
        {
          from: 'agent-2',
          projectId: 'proj-1',
          question: 'Can you process this?',
        },
        5000
      );

      expect(response.status).toBe('ok');
      expect(response.result).toBe('Task completed');
    });

    test('should handle multiple concurrent requests', async () => {
      const handler1 = jest.fn((envelope) => {
        messageBus.respondTo(envelope.requestId, { agent: 'agent-1', result: 'done' });
      });

      const handler2 = jest.fn((envelope) => {
        messageBus.respondTo(envelope.requestId, { agent: 'agent-2', result: 'done' });
      });

      messageBus.on('request:agent-1', handler1);
      messageBus.on('request:agent-2', handler2);

      const [response1, response2, response3] = await Promise.all([
        messageBus.request('agent-1', { from: 'requester', projectId: 'proj-1' }, 2000),
        messageBus.request('agent-2', { from: 'requester', projectId: 'proj-1' }, 2000),
        messageBus.request('agent-1', { from: 'requester', projectId: 'proj-1' }, 2000),
      ]);

      expect(response1.agent).toBe('agent-1');
      expect(response2.agent).toBe('agent-2');
      expect(response3.agent).toBe('agent-1');
    });

    test('should handle error response from respondTo', async () => {
      const handler = (envelope: any) => {
        messageBus.respondTo(envelope.requestId, {
          error: 'Agent busy',
          canRetry: true,
        });
      };

      messageBus.on('request:agent-1', handler);

      const response = await messageBus.request(
        'agent-1',
        { from: 'agent-2', projectId: 'proj-1' },
        3000
      );

      expect(response.error).toBe('Agent busy');
      expect(response.canRetry).toBe(true);
    });
  });

  describe('Pending Request Management', () => {
    test('should track pending requests', async () => {
      const request1 = messageBus.request('agent-1', { from: 'agent-2', projectId: 'proj-1' }, 5000);
      const request2 = messageBus.request('agent-3', { from: 'agent-2', projectId: 'proj-1' }, 5000);

      await new Promise((r) => setTimeout(r, 10));

      const pending = messageBus.getPendingRequests();
      expect(pending.length).toBeGreaterThanOrEqual(2);
    });

    test('should clear pending request after response', async () => {
      const handler = (envelope: any) => {
        messageBus.respondTo(envelope.requestId, { status: 'ok' });
      };

      messageBus.on('request:agent-1', handler);

      const response = await messageBus.request(
        'agent-1',
        { from: 'agent-2', projectId: 'proj-1' },
        5000
      );

      expect(response.status).toBe('ok');

      const pending = messageBus.getPendingRequests();
      expect(pending.length).toBe(0);
    });

    test('should clear pending request after timeout', async () => {
      await messageBus.request('offline-agent', { from: 'agent-1', projectId: 'proj-1' }, 500);

      const pending = messageBus.getPendingRequests();
      expect(pending.length).toBe(0);
    });

    test('should ignore response for unknown request', () => {
      expect(() => {
        messageBus.respondTo('unknown-request-id', { status: 'ok' });
      }).not.toThrow();
    });
  });

  describe('Request with Project Context', () => {
    test('should persist request to task store', async () => {
      await messageBus.request('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        question: 'Can you help?',
      }, 100);

      // Small delay for async persistence
      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      const message = messages.find((m: any) => m.messageType === 'request');
      expect(message).toBeDefined();
    });

    test('should handle request without projectId gracefully', async () => {
      const handler = (envelope: any) => {
        messageBus.respondTo(envelope.requestId, { status: 'ok' });
      };

      messageBus.on('request:agent-1', handler);

      const response = await messageBus.request(
        'agent-1',
        { from: 'agent-2', question: 'No project ID' },
        2000
      );

      expect(response.status).toBe('ok');
    });
  });

  describe('Complex Workflow Scenarios', () => {
    test('should handle cascading request/response chain', async () => {
      const handler1 = (envelope: any) => {
        // Agent 1 makes a request to Agent 2
        messageBus.request('agent-2', {
          from: 'agent-1',
          projectId: 'proj-1',
          question: 'Can you help me?',
        }, 2000).then((response: any) => {
          messageBus.respondTo(envelope.requestId, {
            status: 'completed',
            fromDependency: response,
          });
        });
      };

      const handler2 = (envelope: any) => {
        messageBus.respondTo(envelope.requestId, {
          status: 'ok',
          message: 'Sure!',
        });
      };

      messageBus.on('request:agent-1', handler1);
      messageBus.on('request:agent-2', handler2);

      const response = await messageBus.request(
        'agent-1',
        { from: 'user', projectId: 'proj-1' },
        5000
      );

      expect(response.status).toBe('completed');
      expect(response.fromDependency.message).toBe('Sure!');
    });

    test('should handle request with task claiming workflow', async () => {
      // PM requests task from agent
      const handler = (envelope: any) => {
        if (envelope.content.action === 'claim-task') {
          messageBus.respondTo(envelope.requestId, {
            claimed: true,
            taskId: 'task-123',
            agentId: 'agent-1',
          });
        }
      };

      messageBus.on('request:agent-1', handler);

      const response = await messageBus.request(
        'agent-1',
        {
          from: 'PROJECT_MANAGER',
          projectId: 'proj-1',
          action: 'claim-task',
          taskId: 'task-123',
        },
        3000
      );

      expect(response.claimed).toBe(true);
      expect(response.taskId).toBe('task-123');
    });
  });
});
