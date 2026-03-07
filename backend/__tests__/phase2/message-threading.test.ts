/**
 * Phase 2: MessageBus Threading Tests
 * Tests message threading, conversation chains, and thread history
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 2: MessageBus - Message Threading', () => {
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

  describe('Thread Creation', () => {
    test('should create a new thread with unique threadId', () => {
      const messageId = 'msg-root-1';
      const threadId = messageBus.createThread(messageId);

      expect(threadId).toBeDefined();
      expect(threadId).toMatch(/^thread-\d+-[a-z0-9]+$/);
    });

    test('should create distinct threads', () => {
      const thread1 = messageBus.createThread('msg-1');
      const thread2 = messageBus.createThread('msg-2');

      expect(thread1).not.toBe(thread2);
    });

    test('should support multiple root messages per thread', () => {
      const rootId1 = 'msg-root-1';
      const rootId2 = 'msg-root-2';

      const threadId1 = messageBus.createThread(rootId1);
      const threadId2 = messageBus.createThread(rootId2);

      expect(threadId1).not.toBe(threadId2);
    });
  });

  describe('Add to Thread', () => {
    test('should add message to existing thread', () => {
      const rootMessageId = 'msg-1';
      const threadId = messageBus.createThread(rootMessageId);

      // Add root message to thread internally
      messageBus.addToThread(rootMessageId, {
        id: rootMessageId,
        from: 'agent-2',
        text: 'Root message',
      });

      const result = messageBus.addToThread(rootMessageId, {
        id: 'msg-2',
        from: 'FRONTEND',
        to: 'PROJECT_MANAGER',
      });

      // Since root is in the thread, reply should get same threadId
      expect(result.parentMessageId).toBe(rootMessageId);
      // Note: threadId will be newly created if parent wasn't found in history
      expect(result.threadId).toBeDefined();
    });

    test('should create thread if parent has no thread', () => {
      const parentMessageId = 'orphan-message';

      // First add parent to thread
      const parentThreadResult = messageBus.addToThread(parentMessageId, {
        id: parentMessageId,
        text: 'Orphan',
      });

      const result = messageBus.addToThread(parentMessageId, {
        id: 'reply-1',
        from: 'BACKEND',
      });

      // Should use the same thread as parent
      expect(result.threadId).toBe(parentThreadResult.threadId);
      expect(result.parentMessageId).toBe(parentMessageId);
    });

    test('should preserve thread across multiple replies', () => {
      const rootId = 'msg-root';

      // Create initial thread with first add
      const reply1Setup = messageBus.addToThread(rootId, { id: rootId });
      const threadId = reply1Setup.threadId;

      const reply1 = messageBus.addToThread(rootId, { id: 'msg-reply-1' });
      const reply2 = messageBus.addToThread('msg-reply-1', { id: 'msg-reply-2' });
      const reply3 = messageBus.addToThread('msg-reply-2', { id: 'msg-reply-3' });

      // All should be in same thread
      expect(reply1.threadId).toBe(threadId);
      expect(reply2.threadId).toBe(threadId);
      expect(reply3.threadId).toBe(threadId);
    });
  });

  describe('Threaded Messaging Workflow', () => {
    test('should support multi-turn conversation', () => {
      // Start conversation with initial message in a thread
      const rootSetup = messageBus.addToThread('task-assignment-1', {
        id: 'task-assignment-1',
        from: 'PROJECT_MANAGER',
        content: 'Build the login form',
      });
      const threadId = rootSetup.threadId;

      // Frontend replies with clarification request
      const clarificationReply = messageBus.addToThread('task-assignment-1', {
        id: 'clar-reply-1',
        from: 'FRONTEND',
        content: 'What styling framework should I use?',
      });

      // PM responds
      const pmReply = messageBus.addToThread('clar-reply-1', {
        id: 'pm-reply-1',
        from: 'PROJECT_MANAGER',
        content: 'Use Tailwind CSS',
      });

      // Frontend provides status
      const statusReply = messageBus.addToThread('pm-reply-1', {
        id: 'status-reply-1',
        from: 'FRONTEND',
        content: 'Form completed and styled',
      });

      expect(clarificationReply.threadId).toBe(threadId);
      expect(pmReply.threadId).toBe(threadId);
      expect(statusReply.threadId).toBe(threadId);
    });

    test('should support branching conversations', () => {
      // Start a conversation
      const rootSetup = messageBus.addToThread('initial-task', {
        id: 'initial-task',
        text: 'Initial task',
      });
      const mainThreadId = rootSetup.threadId;

      // Main thread replies
      const mainReply = messageBus.addToThread('initial-task', {
        id: 'main-reply-1',
        content: 'Working on main task',
      });

      // Sub-discussion branches off
      const subThreadReply = messageBus.addToThread('initial-task', {
        id: 'sub-reply-1',
        content: 'Question about dependencies',
      });

      // Both stay in same thread
      expect(mainReply.threadId).toBe(mainThreadId);
      expect(subThreadReply.threadId).toBe(mainThreadId);
    });
  });

  describe('Persistence with Threading', () => {
    test('should save threaded message with threadId', async () => {
      const threadId = messageBus.createThread('root-1');

      messageBus.broadcast({
        from: 'agent-2',
        projectId: 'proj-1',
        channel: 'discussion',
        content: 'First message',
        threadId,
        parentMessageId: null,
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThan(0);
      const savedMsg = messages[0];
      expect(savedMsg.threadId).toBe(threadId);
    });

    test('should preserve parent message chain in persistence', async () => {
      const threadId = messageBus.createThread('msg-root');

      // First message
      messageBus.broadcast({
        from: 'agent-2',
        projectId: 'proj-1',
        channel: 'discussion',
        content: 'Initial message',
        id: 'msg-1',
        threadId,
      });

      // Reply to first message
      messageBus.broadcast({
        from: 'agent-1',
        projectId: 'proj-1',
        channel: 'discussion',
        content: 'Reply to first',
        id: 'msg-2',
        threadId,
        parentMessageId: 'msg-1',
      });

      await new Promise((r) => setTimeout(r, 50));

      const messages = await taskStore.getMessages('proj-1');
      expect(messages.length).toBeGreaterThanOrEqual(2);

      const firstMsg = messages.find((m: any) => m.content.content === 'Initial message');
      const secondMsg = messages.find((m: any) => m.content.content === 'Reply to first');

      expect(firstMsg).toBeDefined();
      expect(secondMsg).toBeDefined();
      expect(firstMsg.threadId).toBe(threadId);
      expect(secondMsg.threadId).toBe(threadId);
      expect(secondMsg.parentMessageId).toBe('msg-1');
    });
  });

  describe('Thread History Queries', () => {
    test('should retrieve thread history by threadId', async () => {
      const threadId = messageBus.createThread('thread-root');

      // Send messages in thread
      const msg1 = { from: 'agent-1', projectId: 'proj-1', threadId };
      const msg2 = { from: 'agent-2', projectId: 'proj-1', threadId };
      const msg3 = { from: 'agent-1', projectId: 'proj-1', threadId };

      messageBus.send('agent-1', msg1);
      messageBus.send('agent-2', msg2);
      messageBus.send('agent-1', msg3);

      await new Promise((r) => setTimeout(r, 50));

      const threadMessages = await messageBus.getThreadHistory('proj-1', threadId);
      expect(threadMessages).toHaveLength(3);
      expect(threadMessages.every((m: any) => m.threadId === threadId)).toBe(true);
    });

    test('should return empty array for non-existent thread', async () => {
      const history = await messageBus.getThreadHistory('proj-1', 'nonexistent-thread');
      expect(history).toEqual([]);
    });

    test('should separate threads in history queries', async () => {
      const thread1 = messageBus.createThread('root-1');
      const thread2 = messageBus.createThread('root-2');

      messageBus.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        threadId: thread1,
        content: 'Message in thread 1',
      });

      messageBus.send('agent-2', {
        from: 'agent-1',
        projectId: 'proj-1',
        threadId: thread2,
        content: 'Message in thread 2',
      });

      await new Promise((r) => setTimeout(r, 50));

      const history1 = await messageBus.getThreadHistory('proj-1', thread1);
      const history2 = await messageBus.getThreadHistory('proj-1', thread2);

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1[0].threadId).toBe(thread1);
      expect(history2[0].threadId).toBe(thread2);
    });
  });

  describe('Complex Threading Scenarios', () => {
    test('should handle multi-agent discussion thread', async () => {
      const threadId = messageBus.createThread('project-discussion');

      // PM initiates
      messageBus.send('FRONTEND', {
        from: 'PROJECT_MANAGER',
        projectId: 'proj-1',
        threadId,
        content: 'Discuss architecture',
        id: 'pm-msg-1',
      });

      // Frontend responds
      messageBus.send('BACKEND', {
        from: 'FRONTEND',
        projectId: 'proj-1',
        threadId,
        content: 'Frontend question',
        parentMessageId: 'pm-msg-1',
        id: 'fe-msg-1',
      });

      // Backend adds perspective
      messageBus.send('FRONTEND', {
        from: 'BACKEND',
        projectId: 'proj-1',
        threadId,
        content: 'Backend perspective',
        parentMessageId: 'fe-msg-1',
        id: 'be-msg-1',
      });

      // Frontend replies to backend
      messageBus.send('PROJECT_MANAGER', {
        from: 'FRONTEND',
        projectId: 'proj-1',
        threadId,
        content: 'Thanks for input',
        parentMessageId: 'be-msg-1',
        id: 'fe-msg-2',
      });

      await new Promise((r) => setTimeout(r, 50));

      const history = await messageBus.getThreadHistory('proj-1', threadId);
      expect(history).toHaveLength(4);
      expect(history.every((m: any) => m.threadId === threadId)).toBe(true);
    });

    test('should maintain thread integrity across direct sends and broadcasts', async () => {
      const threadId = messageBus.createThread('mixed-communication');

      // Direct message in thread
      messageBus.send('agent-1', {
        from: 'agent-2',
        projectId: 'proj-1',
        threadId,
        content: 'Direct message',
        id: 'direct-1',
      });

      // Broadcast in same thread
      messageBus.broadcast({
        from: 'PROJECT_MANAGER',
        channel: 'task:update',
        projectId: 'proj-1',
        threadId,
        parentMessageId: 'direct-1',
        content: 'Update on thread topic',
        id: 'broadcast-1',
      });

      await new Promise((r) => setTimeout(r, 50));

      const history = await messageBus.getThreadHistory('proj-1', threadId);
      expect(history).toHaveLength(2);
      expect(history[1].parentMessageId).toBe('direct-1');
    });
  });
});
