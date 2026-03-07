/**
 * ParallelExecutionEngine Service - Distributed Parallel Execution Orchestration
 * Coordinates multiple agents executing tasks in parallel, manages agent lifecycles,
 * handles errors/retries, and monitors execution across the agent team.
 *
 * Phase 4 Implementation: Agent lifecycle, parallel task execution, error handling, monitoring, and load balancing
 */

import { MessageBus, ITaskStore } from './MessageBus';

/**
 * Agent state enumeration
 */
export enum AgentState {
  IDLE = 'idle',
  BUSY = 'busy',
  OFFLINE = 'offline',
  ERROR = 'error',
}

/**
 * Task execution status
 */
export enum TaskExecutionStatus {
  QUEUED = 'queued',
  CLAIMED = 'claimed',
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Agent registration info
 */
export interface RegisteredAgent {
  agentId: string;
  agentType: string;
  capabilities: string[];
  state: AgentState;
  lastHeartbeat: Date;
  currentTaskId?: string;
  taskCount: number;
  completedCount: number;
}

/**
 * Task execution record
 */
export interface TaskExecutionRecord {
  taskId: string;
  projectId: string;
  agentId: string;
  status: TaskExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  queuedTasks: number;
  averageTaskDuration: number;
  completionRate: number;
  retryRate: number;
  failureRate: number;
  agentUtilization: number;
  timestamp: Date;
}

/**
 * Agent performance stats
 */
export interface AgentPerformanceStats {
  agentId: string;
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  averageTaskDuration: number;
  completionRate: number;
  currentlyBusy: boolean;
  uptime: number; // milliseconds
}

/**
 * ParallelExecutionEngine - Distributed execution orchestration
 */
export interface IParallelExecutionEngine {
  // Agent Management
  registerAgent(agentId: string, agentType: string, capabilities: string[]): Promise<void>;
  unregisterAgent(agentId: string): Promise<void>;
  getAgentStatus(agentId: string): Promise<RegisteredAgent | null>;
  getAllAgents(): Promise<RegisteredAgent[]>;
  updateAgentHeartbeat(agentId: string): Promise<void>;

  // Execution Control
  startExecuting(projectId: string): Promise<void>;
  stopExecuting(projectId: string): Promise<void>;
  pauseExecution(projectId: string): Promise<void>;
  resumeExecution(projectId: string): Promise<void>;

  // Task Execution
  startTaskExecution(projectId: string, taskId: string, agentId: string): Promise<void>;
  completeTaskExecution(projectId: string, taskId: string, agentId: string, result: any): Promise<void>;
  failTaskExecution(projectId: string, taskId: string, agentId: string, error: any): Promise<void>;

  // Monitoring
  getExecutionMetrics(projectId: string): Promise<ExecutionMetrics>;
  getProjectProgress(projectId: string): Promise<any>;
  getAgentUtilization(): Promise<number>;
  getAgentPerformanceStats(agentId: string): Promise<AgentPerformanceStats>;

  // Configuration
  setMaxRetries(count: number): void;
  setRetryBackoff(backoffMs: number): void;
  setHeartbeatTimeout(timeoutMs: number): void;
}

export class ParallelExecutionEngine implements IParallelExecutionEngine {
  // Registered agents: agentId -> RegisteredAgent
  private agents: Map<string, RegisteredAgent> = new Map();

  // Executing projects: Set of projectIds
  private executingProjects: Set<string> = new Set();

  // Paused projects: Set of projectIds
  private pausedProjects: Set<string> = new Set();

  // Task execution history: taskId -> TaskExecutionRecord
  private taskExecutionHistory: Map<string, TaskExecutionRecord[]> = new Map();

  // Task to agent mapping: taskId -> agentId
  private taskToAgent: Map<string, string> = new Map();

  // Task start times for duration calculation: taskId -> startTime
  private taskStartTimes: Map<string, Date> = new Map();

  // Dead-letter queue: failed tasks that can't be retried
  private deadLetterQueue: TaskExecutionRecord[] = [];

  // Message bus for event distribution
  private messageBus: MessageBus;

  // Task store for persistence
  private taskStore: ITaskStore;

  // Configuration
  private maxRetries: number = 3;
  private retryBackoffMs: number = 1000;
  private heartbeatTimeoutMs: number = 60000; // 60 seconds - give agents time to send first heartbeat

  // Heartbeat tracking: agentId -> timestamp
  private lastHeartbeats: Map<string, Date> = new Map();

  // Agent uptime tracking: agentId -> startTime
  private agentStartTimes: Map<string, Date> = new Map();

  // Metrics cache: projectId -> ExecutionMetrics
  private metricsCache: Map<string, ExecutionMetrics> = new Map();

  /**
   * Constructor
   * @param messageBus MessageBus for event distribution
   * @param taskStore ITaskStore for persistence
   */
  constructor(messageBus: MessageBus, taskStore: ITaskStore) {
    this.messageBus = messageBus;
    this.taskStore = taskStore;
    this.startHeartbeatMonitor();
    this.setupEventListeners();
  }

  /**
   * PRIVATE: Setup event listeners for agent lifecycle
   */
  private setupEventListeners(): void {
    // Listen for agent registration and heartbeat events on broadcast channel
    this.messageBus.on('broadcast', (envelope: any) => {
      // Extract the actual message from the envelope
      const message = envelope.content || envelope;

      // Track agent registration for grace period
      if (message.event === 'agent:registered' && message.agentId) {
        console.log(`[DEBUG-LISTENER] Received agent:registered for ${message.agentId}`);
        this.lastHeartbeats.set(message.agentId, new Date());
        this.agentStartTimes.set(message.agentId, new Date());
      }
      // Track agent heartbeats to keep them alive
      else if (message.event === 'agent:heartbeat' && message.agentId) {
        console.log(`[DEBUG-LISTENER] Received agent:heartbeat from ${message.agentId}`);
        this.lastHeartbeats.set(message.agentId, new Date());
      }
    });
  }

  /**
   * Register an agent with capabilities
   */
  async registerAgent(agentId: string, agentType: string, capabilities: string[]): Promise<void> {
    try {
      const now = new Date();
      const agent: RegisteredAgent = {
        agentId,
        agentType,
        capabilities,
        state: AgentState.IDLE,
        lastHeartbeat: now,
        taskCount: 0,
        completedCount: 0,
      };

      this.agents.set(agentId, agent);
      this.lastHeartbeats.set(agentId, now);
      this.agentStartTimes.set(agentId, now);

      console.log(`[DEBUG-REGISTER] Agent ${agentId}: Setting lastHeartbeats=${now.getTime()} and agentStartTimes=${now.getTime()}`);

      this.messageBus.broadcast({
        event: 'agent:registered',
        agentId,
        agentType,
        capabilities,
        timestamp: now,
      });

      console.log(`[ParallelExecutionEngine] Agent registered: ${agentId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to register agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        return;
      }

      // If agent is busy, release the task back to queue
      if (agent.currentTaskId && agent.state === AgentState.BUSY) {
        await this.failTaskExecution(
          'unknown',
          agent.currentTaskId,
          agentId,
          'Agent unregistered while task in progress'
        );
      }

      this.agents.delete(agentId);
      this.lastHeartbeats.delete(agentId);
      this.agentStartTimes.delete(agentId);

      this.messageBus.broadcast({
        event: 'agent:unregistered',
        agentId,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Agent unregistered: ${agentId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to unregister agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent status
   */
  async getAgentStatus(agentId: string): Promise<RegisteredAgent | null> {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all registered agents
   */
  async getAllAgents(): Promise<RegisteredAgent[]> {
    return Array.from(this.agents.values());
  }

  /**
   * Update agent heartbeat
   */
  async updateAgentHeartbeat(agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        return;
      }

      const now = new Date();
      agent.lastHeartbeat = now;
      if (agent.state === AgentState.OFFLINE) {
        agent.state = AgentState.IDLE;
        this.messageBus.broadcast({
          event: 'agent:online',
          agentId,
          timestamp: now,
        });
      }

      this.lastHeartbeats.set(agentId, now);

      this.messageBus.broadcast({
        event: 'agent:heartbeat',
        agentId,
        state: agent.state,
        timestamp: now,
      });
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to update heartbeat for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Start execution for a project
   */
  async startExecuting(projectId: string): Promise<void> {
    try {
      if (this.executingProjects.has(projectId)) {
        return;
      }

      this.executingProjects.add(projectId);
      this.pausedProjects.delete(projectId);

      // Initialize metrics for this project
      if (!this.metricsCache.has(projectId)) {
        this.metricsCache.set(projectId, {
          projectId,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          queuedTasks: 0,
          averageTaskDuration: 0,
          completionRate: 0,
          retryRate: 0,
          failureRate: 0,
          agentUtilization: 0,
          timestamp: new Date(),
        });
      }

      this.messageBus.broadcast({
        event: 'execution:started',
        projectId,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Execution started for project: ${projectId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to start execution for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Stop execution for a project
   */
  async stopExecuting(projectId: string): Promise<void> {
    try {
      this.executingProjects.delete(projectId);
      this.pausedProjects.delete(projectId);

      this.messageBus.broadcast({
        event: 'execution:stopped',
        projectId,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Execution stopped for project: ${projectId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to stop execution for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Pause execution for a project
   */
  async pauseExecution(projectId: string): Promise<void> {
    try {
      if (!this.executingProjects.has(projectId)) {
        return;
      }

      this.pausedProjects.add(projectId);

      this.messageBus.broadcast({
        event: 'execution:paused',
        projectId,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Execution paused for project: ${projectId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to pause execution for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Resume execution for a project
   */
  async resumeExecution(projectId: string): Promise<void> {
    try {
      if (!this.pausedProjects.has(projectId)) {
        return;
      }

      this.pausedProjects.delete(projectId);

      this.messageBus.broadcast({
        event: 'execution:resumed',
        projectId,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Execution resumed for project: ${projectId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to resume execution for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Start task execution by an agent
   */
  async startTaskExecution(projectId: string, taskId: string, agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Mark agent as busy
      agent.state = AgentState.BUSY;
      agent.currentTaskId = taskId;
      agent.taskCount++;

      // Track task to agent
      this.taskToAgent.set(taskId, agentId);
      this.taskStartTimes.set(taskId, new Date());

      // Initialize execution record
      if (!this.taskExecutionHistory.has(taskId)) {
        this.taskExecutionHistory.set(taskId, []);
      }

      const record: TaskExecutionRecord = {
        taskId,
        projectId,
        agentId,
        status: TaskExecutionStatus.STARTED,
        startedAt: new Date(),
        retryCount: 0,
        maxRetries: this.maxRetries,
      };

      this.taskExecutionHistory.get(taskId)!.push(record);

      this.messageBus.broadcast({
        event: 'task:started',
        taskId,
        projectId,
        agentId,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Task execution started: ${taskId} by ${agentId}`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to start task execution:`, error);
      throw error;
    }
  }

  /**
   * Complete task execution
   */
  async completeTaskExecution(
    projectId: string,
    taskId: string,
    agentId: string,
    result: any
  ): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Update agent state
      agent.state = AgentState.IDLE;
      agent.currentTaskId = undefined;
      agent.completedCount++;

      // Update execution record
      const history = this.taskExecutionHistory.get(taskId);
      if (history && history.length > 0) {
        const lastRecord = history[history.length - 1];
        lastRecord.status = TaskExecutionStatus.COMPLETED;
        lastRecord.completedAt = new Date();
      }

      // Calculate task duration
      const startTime = this.taskStartTimes.get(taskId);
      const duration = startTime ? new Date().getTime() - startTime.getTime() : 0;

      this.taskToAgent.delete(taskId);
      this.taskStartTimes.delete(taskId);

      this.messageBus.broadcast({
        event: 'task:completed',
        taskId,
        projectId,
        agentId,
        result,
        duration,
        timestamp: new Date(),
      });

      console.log(`[ParallelExecutionEngine] Task completed: ${taskId} (${duration}ms)`);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to complete task execution:`, error);
      throw error;
    }
  }

  /**
   * Fail task execution with automatic retry logic
   */
  async failTaskExecution(projectId: string, taskId: string, agentId: string, error: any): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.state = AgentState.IDLE;
        agent.currentTaskId = undefined;
      }

      // Get or initialize execution history
      if (!this.taskExecutionHistory.has(taskId)) {
        this.taskExecutionHistory.set(taskId, []);
      }

      const history = this.taskExecutionHistory.get(taskId)!;
      const retryCount = history.length > 0 ? history[history.length - 1].retryCount : 0;

      // Decide whether to retry
      if (retryCount < this.maxRetries) {
        // Retry with exponential backoff
        const backoff = this.retryBackoffMs * Math.pow(2, retryCount);

        const record: TaskExecutionRecord = {
          taskId,
          projectId,
          agentId,
          status: TaskExecutionStatus.RETRYING,
          error: error instanceof Error ? error.message : String(error),
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries,
        };

        history.push(record);

        this.messageBus.broadcast({
          event: 'task:retry',
          taskId,
          projectId,
          agentId,
          retryCount: retryCount + 1,
          backoffMs: backoff,
          error: record.error,
          timestamp: new Date(),
        });

        console.log(
          `[ParallelExecutionEngine] Task retry scheduled: ${taskId} (attempt ${retryCount + 1}/${this.maxRetries}, backoff: ${backoff}ms)`
        );

        // Schedule retry after backoff
        setTimeout(async () => {
          this.messageBus.broadcast({
            event: 'task:retryable',
            taskId,
            projectId,
            timestamp: new Date(),
          });
        }, backoff);
      } else {
        // Max retries exceeded - move to dead-letter queue
        const record: TaskExecutionRecord = {
          taskId,
          projectId,
          agentId,
          status: TaskExecutionStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          retryCount: retryCount,
          maxRetries: this.maxRetries,
          completedAt: new Date(),
        };

        history.push(record);
        this.deadLetterQueue.push(record);

        this.messageBus.broadcast({
          event: 'task:failed',
          taskId,
          projectId,
          agentId,
          error: record.error,
          retryCount: retryCount,
          timestamp: new Date(),
        });

        this.messageBus.broadcast({
          event: 'execution:error',
          projectId,
          taskId,
          errorMessage: record.error,
          maxRetriesExceeded: true,
          timestamp: new Date(),
        });

        console.log(`[ParallelExecutionEngine] Task failed permanently: ${taskId}`);
      }

      this.taskToAgent.delete(taskId);
      this.taskStartTimes.delete(taskId);
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to handle task failure:`, error);
      throw error;
    }
  }

  /**
   * Get execution metrics for a project
   */
  async getExecutionMetrics(projectId: string): Promise<ExecutionMetrics> {
    try {
      // Count tasks by status
      let totalTasks = 0;
      let completedTasks = 0;
      let failedTasks = 0;
      let queuedTasks = 0;
      let totalDuration = 0;
      let durationCount = 0;
      let retryCount = 0;

      for (const [taskId, history] of this.taskExecutionHistory.entries()) {
        const record = history[history.length - 1];
        if (record.projectId !== projectId) continue;

        totalTasks++;

        if (record.status === TaskExecutionStatus.COMPLETED) {
          completedTasks++;
          if (record.startedAt && record.completedAt) {
            totalDuration += record.completedAt.getTime() - record.startedAt.getTime();
            durationCount++;
          }
        } else if (record.status === TaskExecutionStatus.FAILED) {
          failedTasks++;
        } else if (record.status === TaskExecutionStatus.QUEUED) {
          queuedTasks++;
        }

        retryCount += record.retryCount;
      }

      // Calculate metrics
      const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
      const failureRate = totalTasks > 0 ? failedTasks / totalTasks : 0;
      const retryRate = totalTasks > 0 ? retryCount / totalTasks : 0;
      const averageTaskDuration = durationCount > 0 ? totalDuration / durationCount : 0;

      // Calculate agent utilization
      const agentUtilization = this.calculateAgentUtilization();

      const metrics: ExecutionMetrics = {
        projectId,
        totalTasks,
        completedTasks,
        failedTasks,
        queuedTasks,
        averageTaskDuration,
        completionRate,
        retryRate,
        failureRate,
        agentUtilization,
        timestamp: new Date(),
      };

      this.metricsCache.set(projectId, metrics);
      return metrics;
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to get execution metrics:`, error);
      throw error;
    }
  }

  /**
   * Get project progress
   */
  async getProjectProgress(projectId: string): Promise<any> {
    try {
      const metrics = await this.getExecutionMetrics(projectId);
      const agents = Array.from(this.agents.values());

      return {
        projectId,
        executing: this.executingProjects.has(projectId),
        paused: this.pausedProjects.has(projectId),
        metrics,
        activeAgents: agents.filter((a) => a.state === AgentState.BUSY).length,
        idleAgents: agents.filter((a) => a.state === AgentState.IDLE).length,
        offlineAgents: agents.filter((a) => a.state === AgentState.OFFLINE).length,
        deadLetterQueueSize: this.deadLetterQueue.filter((r) => r.projectId === projectId).length,
      };
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to get project progress:`, error);
      throw error;
    }
  }

  /**
   * Get overall agent utilization
   */
  async getAgentUtilization(): Promise<number> {
    const allAgents = Array.from(this.agents.values());
    if (allAgents.length === 0) {
      return 0;
    }

    const busyAgents = allAgents.filter((a) => a.state === AgentState.BUSY).length;
    return busyAgents / allAgents.length;
  }

  /**
   * Get performance stats for an agent
   */
  async getAgentPerformanceStats(agentId: string): Promise<AgentPerformanceStats> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Calculate total duration for completed tasks
      let totalDuration = 0;
      let completedCount = 0;

      for (const history of this.taskExecutionHistory.values()) {
        for (const record of history) {
          if (record.agentId === agentId && record.status === TaskExecutionStatus.COMPLETED) {
            if (record.startedAt && record.completedAt) {
              totalDuration += record.completedAt.getTime() - record.startedAt.getTime();
              completedCount++;
            }
          }
        }
      }

      // Count failed tasks
      let failedCount = 0;
      for (const history of this.taskExecutionHistory.values()) {
        for (const record of history) {
          if (record.agentId === agentId && record.status === TaskExecutionStatus.FAILED) {
            failedCount++;
          }
        }
      }

      const startTime = this.agentStartTimes.get(agentId) || new Date();
      const uptime = new Date().getTime() - startTime.getTime();

      return {
        agentId,
        tasksClaimed: agent.taskCount,
        tasksCompleted: agent.completedCount,
        tasksFailed: failedCount,
        averageTaskDuration: completedCount > 0 ? totalDuration / completedCount : 0,
        completionRate: agent.taskCount > 0 ? agent.completedCount / agent.taskCount : 0,
        currentlyBusy: agent.state === AgentState.BUSY,
        uptime,
      };
    } catch (error) {
      console.error(`[ParallelExecutionEngine] Failed to get agent performance stats:`, error);
      throw error;
    }
  }

  /**
   * Set max retries
   */
  setMaxRetries(count: number): void {
    this.maxRetries = Math.max(1, count);
  }

  /**
   * Set retry backoff in milliseconds
   */
  setRetryBackoff(backoffMs: number): void {
    this.retryBackoffMs = Math.max(100, backoffMs);
  }

  /**
   * Set heartbeat timeout in milliseconds
   */
  setHeartbeatTimeout(timeoutMs: number): void {
    this.heartbeatTimeoutMs = Math.max(5000, timeoutMs);
  }

  /**
   * Get dead-letter queue
   */
  getDeadLetterQueue(): TaskExecutionRecord[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Get execution history for a task
   */
  getTaskExecutionHistory(taskId: string): TaskExecutionRecord[] {
    return this.taskExecutionHistory.get(taskId) || [];
  }

  /**
   * PRIVATE: Start heartbeat monitor
   */
  private startHeartbeatMonitor(): void {
    setInterval(() => {
      const now = new Date();
      const agentsToRemove: string[] = [];
      const graceperiodMs = 10000; // Give newly registered agents 10 seconds grace period

      for (const [agentId, lastHeartbeat] of this.lastHeartbeats.entries()) {
        const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
        const registrationTime = this.agentStartTimes.get(agentId)?.getTime() || 0;
        const timeSinceRegistration = now.getTime() - registrationTime;

        // DIAGNOSTIC: Log every check
        console.log(`[DEBUG-HEARTBEAT] ${agentId}: timeSinceReg=${timeSinceRegistration}ms (grace=${graceperiodMs}ms), timeSinceHB=${timeSinceHeartbeat}ms (timeout=${this.heartbeatTimeoutMs}ms)`);

        // Skip offline check if agent is newly registered (within grace period)
        if (timeSinceRegistration < graceperiodMs) {
          console.log(`[DEBUG-HEARTBEAT] ${agentId}: SKIPPING - In grace period`);
          continue;
        }

        if (timeSinceHeartbeat > this.heartbeatTimeoutMs) {
          const agent = this.agents.get(agentId);
          if (agent && agent.state !== AgentState.OFFLINE) {
            agent.state = AgentState.OFFLINE;

            this.messageBus.broadcast({
              event: 'agent:offline',
              agentId,
              timeSinceHeartbeat,
              timestamp: now,
            });

            console.log(`[ParallelExecutionEngine] Agent marked offline: ${agentId}`);
          }
        }
      }

      // Remove stale agents (offline for more than 2x heartbeat timeout)
      for (const [agentId, lastHeartbeat] of this.lastHeartbeats.entries()) {
        const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
        if (timeSinceHeartbeat > this.heartbeatTimeoutMs * 2) {
          agentsToRemove.push(agentId);
        }
      }

      for (const agentId of agentsToRemove) {
        this.unregisterAgent(agentId).catch((err) => {
          console.error(`[ParallelExecutionEngine] Failed to auto-remove offline agent ${agentId}:`, err);
        });
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * PRIVATE: Calculate agent utilization
   */
  private calculateAgentUtilization(): number {
    const allAgents = Array.from(this.agents.values());
    if (allAgents.length === 0) {
      return 0;
    }

    const busyAgents = allAgents.filter((a) => a.state === AgentState.BUSY).length;
    return busyAgents / allAgents.length;
  }

  /**
   * Reset engine (for testing)
   */
  reset(): void {
    this.agents.clear();
    this.executingProjects.clear();
    this.pausedProjects.clear();
    this.taskExecutionHistory.clear();
    this.taskToAgent.clear();
    this.taskStartTimes.clear();
    this.deadLetterQueue = [];
    this.lastHeartbeats.clear();
    this.agentStartTimes.clear();
    this.metricsCache.clear();
  }
}

export default ParallelExecutionEngine;
