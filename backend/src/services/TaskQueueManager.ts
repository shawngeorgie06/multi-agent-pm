/**
 * TaskQueueManager Service - Agent Task Queue and Claiming
 * Manages task queuing, agent task distribution, and autonomous task claiming
 *
 * Phase 3 Implementation: Task queueing, capability matching, and autonomous claiming
 */

import { MessageBus, ITaskStore } from './MessageBus';

/**
 * Logger interface for extensibility
 */
export interface ILogger {
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

/**
 * Default logger implementation (console-based)
 */
class ConsoleLogger implements ILogger {
  info(message: string, data?: any): void {
    console.log(`[TaskQueueManager] ${message}`, data || '');
  }

  error(message: string, error?: any): void {
    console.error(`[TaskQueueManager] ${message}`, error || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[TaskQueueManager] ${message}`, data || '');
  }

  debug(message: string, data?: any): void {
    if (process.env.DEBUG) {
      console.debug(`[TaskQueueManager] ${message}`, data || '');
    }
  }
}

/**
 * Task interface matching the database schema
 */
export interface Task {
  id: string;
  projectId: string;
  taskId: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED' | 'FAILED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedHours?: number;
  actualHours?: number;
  dependencies: string[];
  blockerMessage?: string;
  generatedCode?: string;
  assignedAgent?: string;
  claimedBy?: string;
  claimedAt?: Date;
  completedBy?: string;
  completedAt?: Date;
  requiredCapabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TaskQueueEntry interface (from TaskQueue model)
 */
export interface TaskQueueEntry {
  id: string;
  taskId: string;
  projectId: string;
  agentType: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  requiredCapabilities: string[];
  claimedBy?: string;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent status interface
 */
export interface AgentStatus {
  id: string;
  agentId: string;
  agentType: string;
  status: 'idle' | 'busy' | 'offline';
  lastHeartbeat: Date;
  capabilities: string[];
  currentTaskId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  projectId: string;
  totalQueued: number;
  claimed: number;
  unclaimed: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  oldestTaskAge: number; // milliseconds
  averageWaitTime: number; // milliseconds
}

/**
 * Agent statistics
 */
export interface AgentStats {
  agentId: string;
  totalClaimed: number;
  totalCompleted: number;
  completionRate: number;
  averageClaimTime: number; // milliseconds
  currentlyWorking: boolean;
}

/**
 * Task claim result
 */
export interface TaskClaimResult {
  claimed: boolean;
  taskId?: string;
  error?: string;
}

/**
 * TaskQueueManager - Task Queue and Agent Claiming Service
 */
export class TaskQueueManager {
  // In-memory task queue: projectId -> TaskQueueEntry[]
  private taskQueues: Map<string, TaskQueueEntry[]> = new Map();

  // Task store for persistence
  private taskStore: ITaskStore;

  // Message bus for event distribution
  private messageBus: MessageBus;

  // Logger instance
  private logger: ILogger;

  // Task metadata cache: taskId -> Task
  private taskCache: Map<string, Task> = new Map();

  // Agent status cache: agentId -> AgentStatus
  private agentCache: Map<string, AgentStatus> = new Map();

  // Claim tracking: queueEntryId -> { agentId, claimedAt, version }
  private claimLocks: Map<string, { agentId: string; claimedAt: Date; version: number }> = new Map();

  /**
   * Constructor
   * @param taskStore Task store for persistence
   * @param messageBus MessageBus for event distribution
   * @param logger Optional logger instance
   */
  constructor(taskStore: ITaskStore, messageBus: MessageBus, logger?: ILogger) {
    this.taskStore = taskStore;
    this.messageBus = messageBus;
    this.logger = logger || new ConsoleLogger();

    this.logger.info('TaskQueueManager initialized');
  }

  /**
   * Queue a new task for agent claiming
   * @param projectId Project ID
   * @param task Task to queue
   */
  async queueTask(projectId: string, task: Task): Promise<void> {
    try {
      // Create queue entry
      const queueEntry: TaskQueueEntry = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        taskId: task.id,
        projectId,
        agentType: task.assignedAgent || 'ANY',
        priority: task.priority,
        requiredCapabilities: task.requiredCapabilities || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to in-memory queue
      if (!this.taskQueues.has(projectId)) {
        this.taskQueues.set(projectId, []);
      }

      const queue = this.taskQueues.get(projectId)!;
      queue.push(queueEntry);

      // Sort by priority (HIGH first, then MEDIUM, then LOW)
      this.sortQueueByPriority(queue);

      // Cache task metadata
      this.taskCache.set(task.id, task);

      this.logger.info(`Task queued`, {
        taskId: task.id,
        projectId,
        priority: task.priority,
      });

      // Emit event for distribution
      this.messageBus.emit('task:available', {
        queueEntryId: queueEntry.id,
        taskId: task.id,
        projectId,
        priority: task.priority,
        requiredCapabilities: task.requiredCapabilities,
      });

      // Distribute to available agents
      await this.distributeAvailableTasks(projectId);
    } catch (error) {
      this.logger.error('Failed to queue task', error);
      throw error;
    }
  }

  /**
   * Get all queued tasks for a project
   * @param projectId Project ID
   * @returns Array of TaskQueueEntry objects
   */
  async getQueuedTasks(projectId: string): Promise<TaskQueueEntry[]> {
    const queue = this.taskQueues.get(projectId) || [];
    // Return only unclaimed tasks
    return queue.filter((entry) => !entry.claimedBy);
  }

  /**
   * Remove a task from the queue
   * @param queueEntryId Queue entry ID
   */
  async removeFromQueue(queueEntryId: string): Promise<void> {
    try {
      // Find and remove from all project queues
      for (const [projectId, queue] of this.taskQueues.entries()) {
        const index = queue.findIndex((entry) => entry.id === queueEntryId);
        if (index !== -1) {
          queue.splice(index, 1);
          this.logger.info(`Task removed from queue`, { queueEntryId, projectId });
          return;
        }
      }

      this.logger.warn(`Queue entry not found`, { queueEntryId });
    } catch (error) {
      this.logger.error('Failed to remove from queue', error);
      throw error;
    }
  }

  /**
   * Claim a task for an agent
   * Handles concurrent claiming with race condition protection
   *
   * @param queueEntryId Queue entry ID
   * @param agentId Agent ID claiming the task
   * @param capabilities Agent capabilities
   * @returns Claim result with success status
   */
  async claimTask(
    queueEntryId: string,
    agentId: string,
    capabilities: string[]
  ): Promise<TaskClaimResult> {
    try {
      // Find queue entry
      let queueEntry: TaskQueueEntry | null = null;
      let projectId: string | null = null;

      for (const [projId, queue] of this.taskQueues.entries()) {
        const entry = queue.find((e) => e.id === queueEntryId);
        if (entry) {
          queueEntry = entry;
          projectId = projId;
          break;
        }
      }

      if (!queueEntry || !projectId) {
        return {
          claimed: false,
          error: 'Queue entry not found',
        };
      }

      // Check if already claimed
      if (queueEntry.claimedBy) {
        return {
          claimed: false,
          error: `Task already claimed by ${queueEntry.claimedBy}`,
        };
      }

      // Get task metadata
      const task = this.taskCache.get(queueEntry.taskId);
      if (!task) {
        return {
          claimed: false,
          error: 'Task not found in cache',
        };
      }

      // Check dependencies can be started
      const canStart = await this.canTaskBeStarted(task.id);
      if (!canStart) {
        return {
          claimed: false,
          error: 'Task dependencies not met',
        };
      }

      // Validate capability match
      const isCapableMatch = await this.validateCapabilityMatch(
        queueEntry.requiredCapabilities,
        capabilities
      );
      if (!isCapableMatch) {
        return {
          claimed: false,
          error: 'Agent capabilities do not match task requirements',
        };
      }

      // Atomic claiming with version check (race condition protection)
      const claimTime = new Date();

      // Simulate atomic operation - check again that it's still unclaimed
      const currentEntry = this.taskQueues
        .get(projectId)
        ?.find((e) => e.id === queueEntryId);

      if (!currentEntry || currentEntry.claimedBy) {
        return {
          claimed: false,
          error: 'Task was claimed by another agent',
        };
      }

      // Claim the task
      currentEntry.claimedBy = agentId;
      currentEntry.claimedAt = claimTime;
      currentEntry.updatedAt = claimTime;

      // Update task cache
      task.claimedBy = agentId;
      task.claimedAt = claimTime;
      task.status = 'IN_PROGRESS';
      this.taskCache.set(task.id, task);

      // Store claim lock for tracking
      this.claimLocks.set(queueEntryId, {
        agentId,
        claimedAt: claimTime,
        version: 1,
      });

      this.logger.info(`Task claimed by agent`, {
        queueEntryId,
        taskId: task.id,
        agentId,
        projectId,
      });

      // Emit task:claimed event
      this.messageBus.emit('task:claimed', {
        queueEntryId,
        taskId: task.id,
        agentId,
        projectId,
        timestamp: claimTime,
      });

      return {
        claimed: true,
        taskId: task.id,
      };
    } catch (error) {
      this.logger.error('Failed to claim task', error);
      return {
        claimed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark a task as in progress
   * @param taskId Task ID
   * @param agentId Agent ID working on task
   */
  async markTaskInProgress(taskId: string, agentId: string): Promise<void> {
    try {
      const task = this.taskCache.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.claimedBy !== agentId) {
        throw new Error(`Task not claimed by agent ${agentId}`);
      }

      task.status = 'IN_PROGRESS';
      this.taskCache.set(taskId, task);

      this.messageBus.emit('task:started', {
        taskId,
        agentId,
        timestamp: new Date(),
      });

      this.logger.info(`Task marked in progress`, { taskId, agentId });
    } catch (error) {
      this.logger.error('Failed to mark task in progress', error);
      throw error;
    }
  }

  /**
   * Mark a task as complete
   * @param taskId Task ID
   * @param agentId Agent ID that completed it
   */
  async markTaskComplete(taskId: string, agentId: string): Promise<void> {
    try {
      const task = this.taskCache.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.claimedBy !== agentId) {
        throw new Error(`Task not claimed by agent ${agentId}`);
      }

      task.status = 'COMPLETE';
      task.completedBy = agentId;
      task.completedAt = new Date();
      this.taskCache.set(taskId, task);

      this.messageBus.emit('task:completed', {
        taskId,
        agentId,
        timestamp: task.completedAt,
      });

      this.logger.info(`Task marked complete`, { taskId, agentId });
    } catch (error) {
      this.logger.error('Failed to mark task complete', error);
      throw error;
    }
  }

  /**
   * Release a claimed task back to the queue
   * @param taskId Task ID
   */
  async releaseTask(taskId: string): Promise<void> {
    try {
      const task = this.taskCache.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (!task.claimedBy) {
        throw new Error(`Task ${taskId} is not claimed`);
      }

      const previousAgent = task.claimedBy;
      task.claimedBy = undefined;
      task.claimedAt = undefined;
      task.status = 'TODO';
      this.taskCache.set(taskId, task);

      // Find and unclaim queue entry
      for (const queue of this.taskQueues.values()) {
        const queueEntry = queue.find((e) => e.taskId === taskId && e.claimedBy === previousAgent);
        if (queueEntry) {
          queueEntry.claimedBy = undefined;
          queueEntry.claimedAt = undefined;
          this.claimLocks.delete(queueEntry.id);
          break;
        }
      }

      this.messageBus.emit('task:released', {
        taskId,
        previousAgent,
        timestamp: new Date(),
      });

      this.logger.info(`Task released`, { taskId, previousAgent });
    } catch (error) {
      this.logger.error('Failed to release task', error);
      throw error;
    }
  }

  /**
   * Distribute available tasks to agents
   * Broadcasts task:available events for agents to claim
   *
   * @param projectId Project ID
   */
  async distributeAvailableTasks(projectId: string): Promise<void> {
    try {
      const queue = this.taskQueues.get(projectId) || [];

      // Find unclaimed, dependency-satisfied tasks
      const availableTasks = [];
      for (const queueEntry of queue) {
        if (queueEntry.claimedBy) {
          continue; // Already claimed
        }

        const task = this.taskCache.get(queueEntry.taskId);
        if (!task) {
          continue;
        }

        // Check if dependencies are met
        const canStart = await this.canTaskBeStarted(task.id);
        if (canStart) {
          availableTasks.push({
            queueEntryId: queueEntry.id,
            taskId: task.id,
            priority: queueEntry.priority,
            requiredCapabilities: queueEntry.requiredCapabilities,
          });
        }
      }

      if (availableTasks.length > 0) {
        this.logger.info(`Distributing ${availableTasks.length} available tasks`, { projectId });
        this.messageBus.broadcast({
          from: 'TaskQueueManager',
          channel: 'task:available',
          projectId,
          tasks: availableTasks,
        });
      }
    } catch (error) {
      this.logger.error('Failed to distribute tasks', error);
    }
  }

  /**
   * Find an agent suitable for a task
   * @param task Task to find agent for
   * @returns AgentStatus if found, null otherwise
   */
  async findAgentForTask(task: Task): Promise<AgentStatus | null> {
    try {
      // Get list of available agents from cache
      const agents = Array.from(this.agentCache.values());

      // Filter for idle agents
      const idleAgents = agents.filter((a) => a.status === 'idle');

      if (idleAgents.length === 0) {
        return null;
      }

      // Find agent that matches capabilities
      for (const agent of idleAgents) {
        const isMatch = await this.validateCapabilityMatch(
          task.requiredCapabilities || [],
          agent.capabilities
        );
        if (isMatch) {
          return agent;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to find agent for task', error);
      return null;
    }
  }

  /**
   * Validate that agent capabilities match task requirements
   * @param requiredCapabilities Required capabilities
   * @param agentCapabilities Agent's capabilities
   * @returns true if match, false otherwise
   */
  async validateCapabilityMatch(
    requiredCapabilities: string[],
    agentCapabilities: string[]
  ): Promise<boolean> {
    try {
      // Empty requirements match any agent
      if (!requiredCapabilities || requiredCapabilities.length === 0) {
        return true;
      }

      // Empty agent capabilities match no requirements
      if (!agentCapabilities || agentCapabilities.length === 0) {
        return false;
      }

      // Normalize to lowercase for case-insensitive comparison
      const required = requiredCapabilities.map((c) => c.toLowerCase());
      const available = agentCapabilities.map((c) => c.toLowerCase());

      // Check if agent has all required capabilities
      return required.every((req) => available.includes(req));
    } catch (error) {
      this.logger.error('Failed to validate capability match', error);
      return false;
    }
  }

  /**
   * Check if a task can be started (all dependencies complete)
   * @param taskId Task ID
   * @returns true if task can start, false otherwise
   */
  async canTaskBeStarted(taskId: string): Promise<boolean> {
    try {
      const task = this.taskCache.get(taskId);
      if (!task) {
        return false;
      }

      // No dependencies = can start
      if (!task.dependencies || task.dependencies.length === 0) {
        return true;
      }

      // Check all dependencies are complete
      return await this.checkDependencyCompletion(task.dependencies);
    } catch (error) {
      this.logger.error('Failed to check if task can start', error);
      return false;
    }
  }

  /**
   * Get task dependencies
   * @param taskId Task ID
   * @returns Array of dependent Task objects
   */
  async getTaskDependencies(taskId: string): Promise<Task[]> {
    try {
      const task = this.taskCache.get(taskId);
      if (!task || !task.dependencies) {
        return [];
      }

      const dependencies: Task[] = [];
      for (const depId of task.dependencies) {
        const depTask = this.taskCache.get(depId);
        if (depTask) {
          dependencies.push(depTask);
        }
      }

      return dependencies;
    } catch (error) {
      this.logger.error('Failed to get task dependencies', error);
      return [];
    }
  }

  /**
   * Check if all dependencies are complete
   * @param dependencies Array of task IDs
   * @returns true if all complete, false otherwise
   */
  async checkDependencyCompletion(dependencies: string[]): Promise<boolean> {
    try {
      if (!dependencies || dependencies.length === 0) {
        return true;
      }

      for (const depId of dependencies) {
        const depTask = this.taskCache.get(depId);
        if (!depTask || depTask.status !== 'COMPLETE') {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to check dependency completion', error);
      return false;
    }
  }

  /**
   * Get queue statistics for a project
   * @param projectId Project ID
   * @returns QueueStats object
   */
  async getQueueStats(projectId: string): Promise<QueueStats> {
    try {
      const queue = this.taskQueues.get(projectId) || [];

      const claimed = queue.filter((e) => e.claimedBy).length;
      const unclaimed = queue.length - claimed;

      const highPriority = queue.filter((e) => e.priority === 'HIGH').length;
      const mediumPriority = queue.filter((e) => e.priority === 'MEDIUM').length;
      const lowPriority = queue.filter((e) => e.priority === 'LOW').length;

      // Calculate age of oldest task
      let oldestTaskAge = 0;
      if (queue.length > 0) {
        const now = new Date();
        const oldest = queue.reduce((min, e) => (e.createdAt < min.createdAt ? e : min));
        oldestTaskAge = now.getTime() - oldest.createdAt.getTime();
      }

      // Calculate average wait time for claimed tasks
      let averageWaitTime = 0;
      const claimedTasks = queue.filter((e) => e.claimedAt);
      if (claimedTasks.length > 0) {
        const totalWait = claimedTasks.reduce((sum, e) => {
          const wait = e.claimedAt!.getTime() - e.createdAt.getTime();
          return sum + wait;
        }, 0);
        averageWaitTime = totalWait / claimedTasks.length;
      }

      return {
        projectId,
        totalQueued: queue.length,
        claimed,
        unclaimed,
        highPriority,
        mediumPriority,
        lowPriority,
        oldestTaskAge,
        averageWaitTime,
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats', error);
      throw error;
    }
  }

  /**
   * Get statistics for an agent
   * @param agentId Agent ID
   * @returns AgentStats object
   */
  async getAgentStats(agentId: string): Promise<AgentStats> {
    try {
      let totalClaimed = 0;
      let totalCompleted = 0;
      let totalClaimTime = 0;

      // Count tasks claimed and completed by this agent
      for (const queue of this.taskQueues.values()) {
        for (const entry of queue) {
          if (entry.claimedBy === agentId) {
            totalClaimed++;
            if (entry.claimedAt) {
              totalClaimTime += entry.claimedAt.getTime() - entry.createdAt.getTime();
            }
          }
        }
      }

      // Count completed tasks
      for (const task of this.taskCache.values()) {
        if (task.completedBy === agentId) {
          totalCompleted++;
        }
      }

      const completionRate = totalClaimed > 0 ? totalCompleted / totalClaimed : 0;
      const averageClaimTime = totalClaimed > 0 ? totalClaimTime / totalClaimed : 0;

      const agent = this.agentCache.get(agentId);
      const currentlyWorking = agent ? agent.status === 'busy' : false;

      return {
        agentId,
        totalClaimed,
        totalCompleted,
        completionRate,
        averageClaimTime,
        currentlyWorking,
      };
    } catch (error) {
      this.logger.error('Failed to get agent stats', error);
      throw error;
    }
  }

  /**
   * Update agent status in cache
   * @param agent Agent status
   */
  updateAgentStatus(agent: AgentStatus): void {
    this.agentCache.set(agent.agentId, agent);
  }

  /**
   * Get agent from cache
   * @param agentId Agent ID
   * @returns AgentStatus or undefined
   */
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agentCache.get(agentId);
  }

  /**
   * PRIVATE: Sort queue by priority
   */
  private sortQueueByPriority(queue: TaskQueueEntry[]): void {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    queue.sort((a, b) => {
      return priorityOrder[a.priority as keyof typeof priorityOrder] -
        priorityOrder[b.priority as keyof typeof priorityOrder];
    });
  }

  /**
   * Reset the task queue manager (for testing)
   */
  reset(): void {
    this.taskQueues.clear();
    this.taskCache.clear();
    this.agentCache.clear();
    this.claimLocks.clear();
  }

  /**
   * Get all queues (for testing)
   */
  getAllQueues(): Map<string, TaskQueueEntry[]> {
    return this.taskQueues;
  }

  /**
   * Get task cache (for testing)
   */
  getTaskCache(): Map<string, Task> {
    return this.taskCache;
  }
}

export default TaskQueueManager;
