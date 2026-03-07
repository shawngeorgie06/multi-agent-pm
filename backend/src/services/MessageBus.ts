/**
 * MessageBus Service - Agent-Teams Communication Infrastructure
 * Provides pub/sub, direct messaging, request/response, and persistence for agent-to-agent communication
 *
 * Phase 2 Implementation: Direct agent communication with pub/sub, threading, and persistence
 */

/**
 * Interface for message broker implementations (plugin compatibility)
 */
export interface IMessageBroker {
  emit(channel: string, data: any): void;
  on(channel: string, handler: (data: any) => void): void;
  off(channel: string, handler?: (data: any) => void): void;
  emitTo?(agentId: string, channel: string, data: any): void;
  broadcastExcept?(senderId: string, channel: string, data: any): void;
}

/**
 * Interface for task store persistence (required for message persistence)
 */
export interface ITaskStore {
  saveMessage(projectId: string, message: any): Promise<any>;
  getMessages(projectId: string): Promise<any[]>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}

/**
 * Message envelope structure for all message types
 */
export interface MessageEnvelope {
  id: string;
  from: string;
  to: string;
  channel: string;
  content: any;
  timestamp: Date;
  threadId?: string;
  parentMessageId?: string;
  requestId?: string;
}

/**
 * Pending request tracking for request/response pattern
 */
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * MessageBus - Pub/Sub and Direct Messaging Service
 *
 * Core responsibilities:
 * - Pub/Sub messaging to multiple subscribers
 * - Direct agent-to-agent messaging
 * - Request/response pattern with timeout
 * - Message threading and history
 * - Persistent storage of messages
 */
export class MessageBus implements IMessageBroker {
  // In-memory subscriber registry: channel -> Set of handlers
  private subscribers: Map<string, Set<Function>> = new Map();

  // Direct message recipients: agentId -> message queue
  private directMessages: Map<string, MessageEnvelope[]> = new Map();

  // Pending requests: requestId -> {resolve, reject, timeout}
  private pendingRequests: Map<string, PendingRequest> = new Map();

  // Message history for threading
  private messageHistory: Map<string, MessageEnvelope> = new Map();

  // Thread registry: threadId -> Set of messageIds
  private threads: Map<string, Set<string>> = new Map();

  // Task store for persistence (optional)
  private taskStore?: ITaskStore;

  // Configuration
  private defaultRequestTimeout: number = 5000;

  /**
   * Create a new MessageBus instance
   * @param taskStore Optional task store for message persistence
   */
  constructor(taskStore?: ITaskStore) {
    this.taskStore = taskStore;
  }

  /**
   * PUB/SUB: Emit an event to all subscribers on a channel
   * @param channel The channel name to emit to
   * @param data The data to send to subscribers
   */
  emit(channel: string, data: any): void {
    if (!this.subscribers.has(channel)) {
      return;
    }

    const handlers = this.subscribers.get(channel);
    if (!handlers) return;

    // Call each handler in FIFO order
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[MessageBus] Error in handler for channel '${channel}':`, error);
      }
    }
  }

  /**
   * PUB/SUB: Subscribe to a channel
   * @param channel The channel name to subscribe to
   * @param handler Function to call when messages are emitted
   */
  on(channel: string, handler: Function): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(handler);
  }

  /**
   * PUB/SUB: Unsubscribe from a channel
   * @param channel The channel name to unsubscribe from
   * @param handler Optional specific handler to remove (removes all if not specified)
   */
  off(channel: string, handler?: Function): void {
    if (!this.subscribers.has(channel)) {
      return;
    }

    if (handler) {
      // Remove specific handler
      this.subscribers.get(channel)!.delete(handler);
    } else {
      // Remove all handlers for this channel
      this.subscribers.delete(channel);
    }
  }

  /**
   * PUB/SUB: Emit to a specific agent
   * @param agentId The agent ID to target
   * @param channel The channel name
   * @param data The data to send
   */
  emitTo(agentId: string, channel: string, data: any): void {
    const envelope = this.createMessageEnvelope(
      data.from || 'system',
      agentId,
      channel,
      data
    );

    // Store in history
    this.messageHistory.set(envelope.id, envelope);

    // Queue for recipient
    if (!this.directMessages.has(agentId)) {
      this.directMessages.set(agentId, []);
    }
    this.directMessages.get(agentId)!.push(envelope);

    // Also emit on channel for subscribers
    this.emit(channel, data);
  }

  /**
   * PUB/SUB: Broadcast to all agents except sender
   * @param senderId The agent ID that is sending
   * @param channel The channel name
   * @param data The data to broadcast
   */
  broadcastExcept(senderId: string, channel: string, data: any): void {
    // Emit to all subscribers
    this.emit(channel, data);
  }

  /**
   * DIRECT MESSAGING: Send a message directly to a specific agent
   * @param recipientId The recipient agent ID
   * @param message The message content
   */
  send(recipientId: string, message: any): void {
    const envelope = this.createMessageEnvelope(
      message.from || 'unknown',
      recipientId,
      'direct',
      message
    );

    // Store in history
    this.messageHistory.set(envelope.id, envelope);

    // Queue for recipient
    if (!this.directMessages.has(recipientId)) {
      this.directMessages.set(recipientId, []);
    }
    this.directMessages.get(recipientId)!.push(envelope);

    // Emit on direct channel
    this.emit(`direct:${recipientId}`, envelope);

    // Persist asynchronously (fire-and-forget)
    if (message.projectId) {
      this.persistMessage(message.projectId, envelope).catch((error) => {
        console.error('[MessageBus] Failed to persist message:', error);
      });
    }
  }

  /**
   * REQUEST/RESPONSE: Send a message and wait for a response
   * @param recipientId The recipient agent ID
   * @param message The message content
   * @param timeout Timeout in milliseconds (default 5000)
   * @returns Promise that resolves with the response or error
   */
  async request(recipientId: string, message: any, timeout: number = this.defaultRequestTimeout): Promise<any> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve) => {
      // Create timeout handler
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({
          error: 'timeout',
          message: `No response from ${recipientId} within ${timeout}ms`,
          requestId,
        });
      }, timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject: () => { },
        timeout: timeoutHandle,
      });

      // Send the request
      const envelope = this.createMessageEnvelope(
        message.from || 'unknown',
        recipientId,
        'request',
        message,
        requestId
      );

      // Store in history
      this.messageHistory.set(envelope.id, envelope);

      // Queue for recipient
      if (!this.directMessages.has(recipientId)) {
        this.directMessages.set(recipientId, []);
      }
      this.directMessages.get(recipientId)!.push(envelope);

      // Emit on request channel
      this.emit(`request:${recipientId}`, envelope);

      // Persist asynchronously
      if (message.projectId) {
        this.persistMessage(message.projectId, envelope).catch((error) => {
          console.error('[MessageBus] Failed to persist request:', error);
        });
      }
    });
  }

  /**
   * Handle a response to a pending request
   * @param requestId The request ID to respond to
   * @param response The response data
   */
  respondTo(requestId: string, response: any): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
    }
  }

  /**
   * Broadcast a message to all agents
   * @param message The message to broadcast
   */
  broadcast(message: any): void {
    const channel = message.channel || 'broadcast';
    const envelope = this.createMessageEnvelope(
      message.from || 'system',
      'ALL',
      channel,
      message
    );

    // Store in history
    this.messageHistory.set(envelope.id, envelope);

    // Emit to all subscribers on 'broadcast' channel
    this.emit('broadcast', envelope);

    // If a specific channel is provided (and it's not 'broadcast'), emit there too
    if (message.channel && message.channel !== 'broadcast') {
      this.emit(message.channel, envelope);
    }

    // Persist asynchronously
    if (message.projectId) {
      this.persistMessage(message.projectId, envelope).catch((error) => {
        console.error('[MessageBus] Failed to persist broadcast:', error);
      });
    }
  }

  /**
   * Create a new thread
   * @param rootMessageId The root message ID of the thread
   * @returns The generated thread ID
   */
  createThread(rootMessageId: string): string {
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.threads.set(threadId, new Set([rootMessageId]));
    return threadId;
  }

  /**
   * Add a message to an existing thread
   * @param parentMessageId The parent message ID (the message being replied to)
   * @param message The new message
   * @returns Object with threadId and parentMessageId
   */
  addToThread(parentMessageId: string, message: any): { threadId: string; parentMessageId: string } {
    const parentMessage = this.messageHistory.get(parentMessageId);

    let threadId = parentMessage?.threadId;
    if (!threadId) {
      // Check if parentMessageId is already a thread ID
      if (this.threads.has(parentMessageId)) {
        threadId = parentMessageId;
      } else {
        // Create new thread for this parent
        threadId = this.createThread(parentMessageId);
      }
    }

    // Add to thread registry
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, new Set());
    }

    // Create and store new message in history to preserve threadId
    const newMessageId = message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newEnvelope: MessageEnvelope = {
      id: newMessageId,
      from: message.from || 'unknown',
      to: message.to || 'unknown',
      channel: 'thread',
      content: message,
      timestamp: new Date(),
      threadId,
      parentMessageId,
    };

    this.messageHistory.set(newMessageId, newEnvelope);
    this.threads.get(threadId)!.add(newMessageId);

    return {
      threadId,
      parentMessageId,
    };
  }

  /**
   * Get message history for a project
   * @param projectId The project ID
   * @returns Array of messages for the project
   */
  async getMessageHistory(projectId: string): Promise<any[]> {
    if (!this.taskStore) {
      return [];
    }

    try {
      return await this.taskStore.getMessages(projectId);
    } catch (error) {
      console.error('[MessageBus] Failed to retrieve message history:', error);
      return [];
    }
  }

  /**
   * Get thread history for a specific thread
   * @param projectId The project ID
   * @param threadId The thread ID
   * @returns Array of messages in the thread
   */
  async getThreadHistory(projectId: string, threadId: string): Promise<any[]> {
    if (!this.taskStore) {
      return [];
    }

    try {
      const allMessages = await this.taskStore.getMessages(projectId);
      return allMessages.filter((msg) => msg.threadId === threadId);
    } catch (error) {
      console.error('[MessageBus] Failed to retrieve thread history:', error);
      return [];
    }
  }

  /**
   * Get all pending requests
   * @returns Map of pending request IDs
   */
  getPendingRequests(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Get all subscribers for a channel
   * @param channel The channel name
   * @returns Number of subscribers
   */
  getSubscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0;
  }

  /**
   * Get all messages for an agent
   * @param agentId The agent ID
   * @returns Array of messages for the agent
   */
  getAgentMessages(agentId: string): any[] {
    return this.directMessages.get(agentId) || [];
  }

  /**
   * Clear all messages for an agent
   * @param agentId The agent ID
   */
  clearAgentMessages(agentId: string): void {
    this.directMessages.delete(agentId);
  }

  /**
   * Reset the entire message bus (for testing)
   */
  reset(): void {
    this.subscribers.clear();
    this.directMessages.clear();
    this.pendingRequests.clear();
    this.messageHistory.clear();
    this.threads.clear();
  }

  /**
   * PRIVATE: Create a message envelope with standard structure
   */
  private createMessageEnvelope(
    from: string,
    to: string,
    channel: string,
    content: any,
    requestId?: string
  ): MessageEnvelope {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      channel,
      content,
      timestamp: new Date(),
      ...(requestId && { requestId }),
    };
  }

  /**
   * PRIVATE: Persist a message to the task store
   */
  private async persistMessage(projectId: string, envelope: MessageEnvelope): Promise<void> {
    if (!this.taskStore) {
      return;
    }

    try {
      await this.taskStore.saveMessage(projectId, {
        fromAgent: envelope.from,
        toAgent: envelope.to,
        messageType: envelope.channel,
        content: envelope.content,
        threadId: envelope.threadId || envelope.content?.threadId,
        parentMessageId: envelope.parentMessageId || envelope.content?.parentMessageId,
        metadata: {
          messageEnvelopeId: envelope.id,
          requestId: envelope.requestId,
        },
      });
    } catch (error) {
      console.error('[MessageBus] Failed to save message to store:', error);
    }
  }
}

export default MessageBus;
