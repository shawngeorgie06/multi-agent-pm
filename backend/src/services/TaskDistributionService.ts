/**
 * Task Distribution Service - Phase A3 (Enhanced)
 * Manages task distribution from TaskQueue to agents with parallel execution support
 * Implements load-balancing, priority scheduling, batch distribution, and capability matching
 * Listens for new tasks and broadcasts "task:available" to matching agents
 * Handles task completion and failure events with dependency awareness
 */

import { MessageBus } from './MessageBus.js';
import { TaskQueueManager } from './TaskQueueManager.js';
import { SocketServer } from '../websocket/SocketServer.js';
import { TaskStore } from './taskStore/TaskStore.js';
import { PrismaTaskStore } from './taskStore/PrismaTaskStore.js';
import { decideTaskFailureOutcome, MAX_TASK_RETRIES } from './TaskRetryPolicy.js';
import { staleClaimCutoff, CLAIM_STALE_TIMEOUT_MS } from './StaleClaimPolicy.js';
import { isAgentUnresponsive, AGENT_HEARTBEAT_TIMEOUT_MS } from './AgentLivenessPolicy.js';

export interface TaskQueueEntry {
  id: string;
  taskId: string;
  projectId: string;
  agentType: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  requiredCapabilities: string[];
  claimedBy: string | null;
  claimedAt: Date | null;
}

/**
 * Agent availability info for load balancing
 */
export interface AgentAvailability {
  agentId: string;
  agentType: string;
  capabilities: string[];
  isOnline: boolean;
  isBusy: boolean;
  currentTaskCount: number;
  maxConcurrentTasks: number;
  // Last time this agent was seen alive (registration, heartbeat, or online).
  // Used to detect dead agents and reclaim their in-flight tasks.
  lastHeartbeat: Date;
}

export class TaskDistributionService {
  // Track agent availability for load balancing
  private agentAvailability: Map<string, AgentAvailability> = new Map();

  // Track task dependencies: taskId -> requiredTaskIds
  private taskDependencies: Map<string, string[]> = new Map();

  // How long a claim may sit before it is treated as abandoned and reclaimed.
  private claimStaleTimeoutMs: number = CLAIM_STALE_TIMEOUT_MS;

  // How long an agent may go silent (no heartbeat) before it is treated as dead.
  private agentHeartbeatTimeoutMs: number = AGENT_HEARTBEAT_TIMEOUT_MS;

  // Track distribution metrics
  private distributionMetrics = {
    tasksDistributed: 0,
    averageDistributionTime: 0,
    lastDistributionTimestamp: new Date(),
    distributionSuccessRate: 100
  };

  // Configuration for parallel distribution
  private readonly config = {
    maxConcurrentTasksPerAgent: 3,
    batchSize: 10,
    retryDelay: 1000,
    maxDistributionAttempts: 3
  };

  constructor(
    private messageBus: MessageBus,
    private taskQueueManager: TaskQueueManager,
    private socketServer?: SocketServer,
    private store: TaskStore = new PrismaTaskStore()
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen on broadcast channel for all events
    this.messageBus.on('broadcast', async (envelope: any) => {
      const message = envelope.content || envelope;
      const eventType = message.event;

      // Track agent registration for load balancing
      if (eventType === 'agent:registered') {
        console.log(`[TaskDistribution] Agent registered: ${message.agentId} (${message.agentType})`);
        this.agentAvailability.set(message.agentId, {
          agentId: message.agentId,
          agentType: message.agentType,
          capabilities: message.capabilities || [],
          isOnline: true,
          isBusy: false,
          currentTaskCount: 0,
          maxConcurrentTasks: this.config.maxConcurrentTasksPerAgent,
          lastHeartbeat: new Date()
        });
      }

      // Track agent heartbeats for load balancing
      else if (eventType === 'agent:heartbeat') {
        const agent = this.agentAvailability.get(message.agentId);
        if (agent) {
          agent.isOnline = true;
          agent.isBusy = message.state === 'busy';
          agent.lastHeartbeat = new Date();
        }
        // A live heartbeat is also our chance to notice that OTHER agents have
        // gone silent — reclaim their in-flight tasks promptly.
        await this.detectAndReclaimUnresponsiveAgents();
      }

      // When tasks are extracted from PM plan, distribute them
      else if (eventType === 'tasks:extracted') {
        console.log(`[TaskDistribution] Received tasks:extracted event for project ${message.projectId}`);
        await this.distributeQueuedTasksInParallel(message.projectId);
      }

      // When task completes, update database and check for dependent tasks
      else if (eventType === 'task:completed') {
        console.log(`[TaskDistribution] Task ${message.taskId} completed by ${message.agentId}`);
        try {
          // Update agent availability
          const agent = this.agentAvailability.get(message.agentId);
          if (agent) {
            agent.currentTaskCount = Math.max(0, agent.currentTaskCount - 1);
            agent.isBusy = agent.currentTaskCount > 0;
          }

          const updatedTask = await this.store.markTaskComplete(message.taskId, { completedBy: message.agentId, generatedCode: message.generatedCode || undefined });

          // Remove from queue
          await this.store.removeFromQueueByTask(message.taskId);

          // Notify via WebSocket with full task data (including generatedCode)
          if (this.socketServer && message.projectId) {
            this.socketServer.emitTaskUpdate(message.projectId, updatedTask);
          }

          console.log(`[TaskDistribution] Task ${message.taskId} marked complete and removed from queue`);

          // Distribute dependent tasks
          await this.distributeQueuedTasksInParallel(message.projectId);
        } catch (error) {
          console.error(`[TaskDistribution] Error completing task ${message.taskId}:`, error);
        }
      }

      // When task fails, retry it (up to the cap) or mark it terminally FAILED
      else if (eventType === 'task:failed') {
        console.log(`[TaskDistribution] Task ${message.taskId} failed: ${message.error}`);
        try {
          // Update agent availability
          const agent = this.agentAvailability.get(message.agentId);
          if (agent) {
            agent.currentTaskCount = Math.max(0, agent.currentTaskCount - 1);
            agent.isBusy = agent.currentTaskCount > 0;
          }

          // Decide whether to retry or give up, based on how many times this
          // task has already failed. This prevents a deterministically-failing
          // task from looping forever (claim -> fail -> TODO -> claim -> ...).
          const failingTask = await this.store.getTaskById(message.taskId);
          const outcome = decideTaskFailureOutcome(failingTask?.retryCount ?? 0);

          if (outcome.action === 'retry') {
            // Release the claim so another agent can pick it up, bump the count.
            await this.store.releaseQueueClaimsByTask(message.taskId);
            await this.store.requeueFailedTask(message.taskId, { status: outcome.nextStatus, retryCount: outcome.nextRetryCount });

            if (this.socketServer && message.projectId) {
              this.socketServer.emitTaskFailed(message.projectId, message.taskId, message.error);
            }

            console.log(
              `[TaskDistribution] Task ${message.taskId} requeued for retry ${outcome.nextRetryCount}/${MAX_TASK_RETRIES}`
            );

            // Re-distribute to other agents
            await this.distributeQueuedTasksInParallel(message.projectId);
          } else {
            // Retry budget exhausted — dead-letter the task: remove it from the
            // queue, mark it terminally FAILED, and record why.
            await this.store.removeFromQueueByTask(message.taskId);
            await this.store.deadLetterTask(message.taskId, { status: outcome.nextStatus, retryCount: outcome.nextRetryCount, blockerMessage: `Failed after ${outcome.nextRetryCount} retries: ${message.error ?? 'unknown error'}` });

            if (this.socketServer && message.projectId) {
              this.socketServer.emitTaskFailed(message.projectId, message.taskId, message.error);
            }

            console.error(
              `[TaskDistribution] Task ${message.taskId} dead-lettered after ${outcome.nextRetryCount} retries`
            );
          }
        } catch (error) {
          console.error(`[TaskDistribution] Error failing task ${message.taskId}:`, error);
        }
      }

      // When agent comes online, distribute available tasks
      else if (eventType === 'agent:online') {
        console.log(`[TaskDistribution] Agent ${message.agentId} came online`);
        const agent = this.agentAvailability.get(message.agentId);
        if (agent) {
          agent.isOnline = true;
          agent.isBusy = false;
          agent.lastHeartbeat = new Date();
        }

        // When an agent comes online, distribute all unclaimed tasks
        try {
          const projectIds = await this.store.getProjectsWithUnclaimedTasks();
          for (const projectId of projectIds) {
            console.log(`[TaskDistribution] Agent ${message.agentId} online - distributing tasks for project ${projectId}`);
            await this.distributeQueuedTasksInParallel(projectId);
          }
        } catch (error) {
          console.error(`[TaskDistribution] Error distributing tasks after agent came online:`, error);
        }
      }

      // When agent goes offline, reclaim their tasks
      else if (eventType === 'agent:offline') {
        console.log(`[TaskDistribution] Agent ${message.agentId} went offline`);
        const agent = this.agentAvailability.get(message.agentId);
        if (agent) {
          agent.isOnline = false;
        }
        await this.reclaimTasksFromAgent(message.agentId);
      }
    });
  }

  /**
   * Distribute all unclaimed tasks in queue to available agents (legacy method)
   */
  async distributeQueuedTasks(projectId: string): Promise<void> {
    try {
      // Get all unclaimed tasks for this project
      const queuedTasks = await this.store.getUnclaimedQueueEntries(projectId);

      console.log(`[TaskDistribution] Distributing ${queuedTasks.length} unclaimed tasks for project ${projectId}`);

      // Emit task:available for each unclaimed task
      for (const queueEntry of queuedTasks) {
        // Emit to all agents of matching type
        this.messageBus.emit(`agent:${queueEntry.agentType}`, {
          event: 'task:available',
          projectId: queueEntry.projectId,
          taskId: queueEntry.taskId,
          queueEntryId: queueEntry.id,
          agentType: queueEntry.agentType,
          requiredCapabilities: queueEntry.requiredCapabilities,
          priority: queueEntry.priority
        });

        console.log(`[TaskDistribution] Emitted task:available for ${queueEntry.taskId} to ${queueEntry.agentType}`);
      }
    } catch (error) {
      console.error(`[TaskDistribution] Error distributing tasks for project ${projectId}:`, error);
    }
  }

  /**
   * Distribute tasks in parallel with load balancing and priority scheduling
   * Phase A3: Enhanced distribution for parallel agent execution
   */
  async distributeQueuedTasksInParallel(projectId: string): Promise<void> {
    try {
      const startTime = Date.now();

      // Recover tasks whose claiming agent crashed/hung without reporting back,
      // so they re-enter the unclaimed set below instead of staying stuck.
      await this.reclaimStaleClaims(projectId);

      // Get all unclaimed tasks for this project, sorted by priority
      const queuedTasks = await this.store.getUnclaimedQueueEntries(projectId);

      if (queuedTasks.length === 0) {
        console.log(`[TaskDistribution] No unclaimed tasks to distribute for project ${projectId}`);
        return;
      }

      console.log(`[TaskDistribution] Starting distribution of ${queuedTasks.length} tasks for project ${projectId}`);

      // Get all tasks for this project to check dependencies
      const allTasks = await this.store.getTasksByProject(projectId);

      // Filter tasks that have all dependencies met
      const readyTasks = [];
      for (const queuedTask of queuedTasks) {
        const task = allTasks.find(t => t.id === queuedTask.taskId);
        if (!task) continue;

        // Check if all dependencies are complete
        const dependencies = task.dependencies || [];
        const allDependenciesMet = dependencies.every(depTaskId => {
          // Match by full taskId, short taskId prefix, or UUID
          const depTask = allTasks.find(t =>
            t.taskId === depTaskId ||
            t.id === depTaskId ||
            t.taskId.startsWith(depTaskId + '-') // Match PM-001 to PM-001-8c84fa82
          );
          return depTask && depTask.status === 'COMPLETE';
        });

        if (allDependenciesMet) {
          readyTasks.push(queuedTask);
        } else {
          console.log(`[TaskDistribution] Task ${task.taskId} waiting for dependencies: ${dependencies.join(', ')}`);
        }
      }

      if (readyTasks.length === 0) {
        console.log(`[TaskDistribution] No tasks ready (all waiting on dependencies)`);
        return;
      }

      console.log(`[TaskDistribution] ${readyTasks.length} tasks ready (dependencies met)`);

      // Get online agents grouped by type
      const agentsByType = this.getAvailableAgentsByType();

      // Distribute tasks in batches for parallel processing
      const batches = this.createDistributionBatches(readyTasks, agentsByType);

      // Emit all batch distributions in parallel
      const distributionPromises = batches.map(batch =>
        this.distributeTaskBatch(batch, projectId, agentsByType)
      );

      await Promise.all(distributionPromises);

      const elapsedTime = Date.now() - startTime;
      this.updateDistributionMetrics(readyTasks.length, elapsedTime);

      console.log(`[TaskDistribution] Distribution completed for project ${projectId} in ${elapsedTime}ms`);
    } catch (error) {
      console.error(`[TaskDistribution] Error in distribution for project ${projectId}:`, error);
    }
  }

  /**
   * Distribute a batch of tasks to available agents
   */
  private async distributeTaskBatch(
    batch: any[],
    projectId: string,
    agentsByType: Map<string, AgentAvailability[]>
  ): Promise<void> {
    for (const task of batch) {
      const availableAgents = agentsByType.get(task.agentType) || [];

      if (availableAgents.length === 0) {
        console.log(
          `[TaskDistribution] No available agents for task ${task.taskId} (type: ${task.agentType})`
        );
        continue;
      }

      // Find least loaded available agent
      const selectedAgent = this.selectAgentForTask(availableAgents, task);

      if (!selectedAgent) {
        console.log(
          `[TaskDistribution] No capable agents available for task ${task.taskId}`
        );
        continue;
      }

      // Update agent availability tracking
      if (selectedAgent.currentTaskCount < selectedAgent.maxConcurrentTasks) {
        selectedAgent.currentTaskCount++;
        selectedAgent.isBusy = selectedAgent.currentTaskCount > 0;
      }

      // Fetch task details to get dependencies and build context
      const taskDetails = await this.store.getTaskById(task.taskId);

      // Build context from completed dependency tasks
      const context: Record<string, any> = {};
      if (taskDetails?.dependencies && taskDetails.dependencies.length > 0) {
        // Fetch all completed tasks for this project
        const completedTasks = await this.store.getCompletedTasks(projectId);

        // Map dependency outputs to context
        for (const depTaskId of taskDetails.dependencies) {
          const completedTask = completedTasks.find(t =>
            t.taskId === depTaskId ||
            t.taskId.startsWith(depTaskId + '-')
          );

          if (completedTask?.generatedCode) {
            // For LAYOUT tasks, add as layoutHTML
            if (depTaskId.includes('PM-001') || depTaskId.includes('LAYOUT')) {
              context.layoutHTML = completedTask.generatedCode;
            }
            // For STYLING tasks, add as cssCode
            else if (depTaskId.includes('PM-002') || depTaskId.includes('STYLING')) {
              context.cssCode = completedTask.generatedCode;
            }
            // Generic storage by taskId
            context[depTaskId] = completedTask.generatedCode;
          }
        }
      }

      // Emit task availability to the specific agent type
      // This allows all capable agents to attempt claiming
      this.messageBus.emit(`agent:${task.agentType}`, {
        event: 'task:available',
        projectId,
        taskId: task.taskId,
        queueEntryId: task.id,
        agentType: task.agentType,
        requiredCapabilities: task.requiredCapabilities,
        priority: task.priority,
        context // Pass dependency outputs as context
      });

      console.log(
        `[TaskDistribution] Emitted task:available for ${task.taskId} to ${task.agentType} (load: ${selectedAgent.currentTaskCount}/${selectedAgent.maxConcurrentTasks})`
      );
    }
  }

  /**
   * Select the best agent for a task based on load and capabilities
   */
  private selectAgentForTask(
    availableAgents: AgentAvailability[],
    task: any
  ): AgentAvailability | null {
    // Filter agents that have capacity and match capabilities
    const capableAgents = availableAgents.filter(agent =>
      agent.isOnline &&
      agent.currentTaskCount < agent.maxConcurrentTasks &&
      this.agentHasCapabilities(agent, task.requiredCapabilities)
    );

    if (capableAgents.length === 0) {
      return null;
    }

    // Select agent with lowest current task count (load balancing)
    return capableAgents.reduce((prev, current) =>
      current.currentTaskCount < prev.currentTaskCount ? current : prev
    );
  }

  /**
   * Check if agent has required capabilities
   */
  private agentHasCapabilities(agent: AgentAvailability, requiredCapabilities: string[]): boolean {
    if (requiredCapabilities.length === 0) {
      return true;
    }

    return requiredCapabilities.some(cap =>
      agent.capabilities.some(agentCap =>
        agentCap.toLowerCase().includes(cap.toLowerCase()) ||
        cap.toLowerCase().includes(agentCap.toLowerCase())
      )
    );
  }

  /**
   * Get online agents grouped by type
   */
  private getAvailableAgentsByType(): Map<string, AgentAvailability[]> {
    const byType = new Map<string, AgentAvailability[]>();

    for (const agent of this.agentAvailability.values()) {
      if (agent.isOnline) {
        if (!byType.has(agent.agentType)) {
          byType.set(agent.agentType, []);
        }
        byType.get(agent.agentType)!.push(agent);
      }
    }

    return byType;
  }

  /**
   * Create batches of tasks for parallel distribution
   */
  private createDistributionBatches(
    tasks: any[],
    agentsByType: Map<string, AgentAvailability[]>
  ): any[][] {
    // Group tasks by agent type
    const tasksByType = new Map<string, any[]>();

    for (const task of tasks) {
      if (!tasksByType.has(task.agentType)) {
        tasksByType.set(task.agentType, []);
      }
      tasksByType.get(task.agentType)!.push(task);
    }

    // Create batches respecting agent availability
    const batches: any[][] = [];
    const batchSize = this.config.batchSize;

    for (const [agentType, agentTasks] of tasksByType.entries()) {
      const availableAgents = agentsByType.get(agentType) || [];
      const tasksPerAgent = Math.ceil(agentTasks.length / Math.max(1, availableAgents.length));

      for (let i = 0; i < agentTasks.length; i += tasksPerAgent) {
        batches.push(agentTasks.slice(i, i + tasksPerAgent));
      }
    }

    return batches;
  }

  /**
   * Update distribution metrics
   */
  private updateDistributionMetrics(tasksDistributed: number, elapsedTime: number): void {
    const prevMetrics = this.distributionMetrics;
    const totalDistributed = prevMetrics.tasksDistributed + tasksDistributed;

    this.distributionMetrics.tasksDistributed = totalDistributed;
    this.distributionMetrics.averageDistributionTime =
      (prevMetrics.averageDistributionTime * prevMetrics.tasksDistributed + elapsedTime) /
      totalDistributed;
    this.distributionMetrics.lastDistributionTimestamp = new Date();

    console.log(
      `[TaskDistribution] Metrics - Avg time: ${this.distributionMetrics.averageDistributionTime.toFixed(2)}ms, Total distributed: ${totalDistributed}`
    );
  }

  /**
   * Get distribution metrics
   */
  getDistributionMetrics(): any {
    return {
      ...this.distributionMetrics,
      agentAvailability: Array.from(this.agentAvailability.values()).map(agent => ({
        agentId: agent.agentId,
        agentType: agent.agentType,
        isOnline: agent.isOnline,
        isBusy: agent.isBusy,
        currentTaskCount: agent.currentTaskCount,
        maxConcurrentTasks: agent.maxConcurrentTasks
      }))
    };
  }

  /**
   * Infer agent type from task ID and description
   * Uses pattern matching on ID first, then falls back to description keywords
   */
  private inferAgentType(task: any): string {
    const taskId = task.taskId || task.id || '';
    const description = task.description || '';

    // Check task ID for agent type hints
    if (taskId.includes('FE') || taskId.includes('FRONTEND')) return 'FRONTEND';
    if (taskId.includes('BE') || taskId.includes('BACKEND')) return 'BACKEND';
    if (taskId.includes('QA')) return 'QA';
    if (taskId.includes('DESIGN')) return 'DESIGN_DIRECTOR';
    if (taskId.includes('RESEARCH')) return 'RESEARCH';
    if (taskId.includes('LAYOUT')) return 'LAYOUT';
    if (taskId.includes('STYLING') || taskId.includes('STYLE')) return 'STYLING';
    if (taskId.includes('LOGIC')) return 'LOGIC';

    // Fall back to description keywords if ID doesn't match
    const descLower = description.toLowerCase();

    if (descLower.includes('layout') || descLower.includes('html') || descLower.includes('structure')) {
      return 'LAYOUT';
    }
    if (descLower.includes('styling') || descLower.includes('css') || descLower.includes('style') || descLower.includes('aesthetic')) {
      return 'STYLING';
    }
    if (descLower.includes('logic') || descLower.includes('javascript') || descLower.includes('js') ||
        descLower.includes('interactivity') || descLower.includes('event') || descLower.includes('interaction')) {
      return 'LOGIC';
    }
    if (descLower.includes('frontend') || descLower.includes('react') || descLower.includes('component')) {
      return 'FRONTEND';
    }
    if (descLower.includes('backend') || descLower.includes('api') || descLower.includes('database') ||
        descLower.includes('server')) {
      return 'BACKEND';
    }
    if (descLower.includes('test') || descLower.includes('qa') || descLower.includes('quality')) {
      return 'QA';
    }
    if (descLower.includes('research') || descLower.includes('analysis') || descLower.includes('architecture')) {
      return 'RESEARCH';
    }

    // Default to LAYOUT if no match (better than PROJECT_MANAGER which doesn't exist)
    return 'LAYOUT';
  }

  /**
   * Populate TaskQueue from extracted tasks
   */
  async populateTaskQueue(
    projectId: string,
    tasks: any[],
    agentTypeMapping?: Record<string, string>
  ): Promise<void> {
    try {
      console.log(`[TaskDistribution] Populating queue with ${tasks.length} tasks for project ${projectId}`);

      // Create TaskQueue entries
      const queueEntries = tasks.map((task, index) => {
        // Infer agent type from task ID first, then task description
        let agentType = this.inferAgentType(task);

        return {
          taskId: task.id || task.taskId || `TASK-${index}`,
          projectId,
          agentType,
          priority: task.priority || 'MEDIUM',
          requiredCapabilities: task.requiredCapabilities || [],
          claimedBy: null,
          claimedAt: null
        };
      });

      // Create queue entries (skip if already exist for this task+project combo)
      for (const entry of queueEntries) {
        await this.store.enqueueTask({
          taskId: entry.taskId, projectId: entry.projectId, agentType: entry.agentType,
          priority: entry.priority, requiredCapabilities: entry.requiredCapabilities,
        });
      }

      console.log(`[TaskDistribution] Populated queue with ${queueEntries.length} entries`);

      // Emit that queue is populated
      this.messageBus.broadcast({
        event: 'queue:populated',
        projectId,
        count: queueEntries.length
      });

      // Distribute tasks to agents in parallel (Phase A3)
      await this.distributeQueuedTasksInParallel(projectId);
    } catch (error) {
      console.error(`[TaskDistribution] Error populating task queue:`, error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(projectId: string): Promise<any> {
    try {
      const { total, unclaimed, claimed } = await this.store.countQueue(projectId);

      return {
        projectId,
        total,
        unclaimed,
        claimed,
        utilization: total > 0 ? Math.round((claimed / total) * 100) : 0
      };
    } catch (error) {
      console.error(`[TaskDistribution] Error getting queue stats:`, error);
      return { projectId, error: 'Failed to get stats' };
    }
  }

  /**
   * Set maximum concurrent tasks per agent
   */
  setMaxConcurrentTasksPerAgent(count: number): void {
    this.config.maxConcurrentTasksPerAgent = Math.max(1, count);
    // Update all registered agents
    for (const agent of this.agentAvailability.values()) {
      agent.maxConcurrentTasks = this.config.maxConcurrentTasksPerAgent;
    }
    console.log(`[TaskDistribution] Max concurrent tasks per agent set to ${count}`);
  }

  /**
   * Set batch size for parallel distribution
   */
  setDistributionBatchSize(size: number): void {
    this.config.batchSize = Math.max(1, size);
    console.log(`[TaskDistribution] Distribution batch size set to ${size}`);
  }

  /**
   * Set how long a claim may sit before it is treated as abandoned. Must be
   * longer than the slowest legitimate task to avoid reclaiming a task from a
   * still-running agent (which would cause duplicate execution).
   */
  setClaimStaleTimeout(ms: number): void {
    this.claimStaleTimeoutMs = Math.max(1000, ms);
    console.log(`[TaskDistribution] Claim stale timeout set to ${this.claimStaleTimeoutMs}ms`);
  }

  /**
   * Set how long an agent may go silent (no heartbeat) before it is treated as
   * dead and its in-flight tasks reclaimed. Must comfortably exceed the agent
   * heartbeat interval (5s) to tolerate a few missed beats.
   */
  setAgentHeartbeatTimeout(ms: number): void {
    this.agentHeartbeatTimeoutMs = Math.max(1000, ms);
    console.log(`[TaskDistribution] Agent heartbeat timeout set to ${this.agentHeartbeatTimeoutMs}ms`);
  }

  /**
   * Find agents that have stopped sending heartbeats (crashed/hung without an
   * agent:offline) and reclaim their in-flight tasks. This is the fast path for
   * dead-agent recovery (~heartbeat timeout) complementing the slower
   * claim-age backstop in {@link reclaimStaleClaims}.
   */
  private async detectAndReclaimUnresponsiveAgents(): Promise<void> {
    const now = new Date();

    for (const agent of this.getUnresponsiveAgents(now)) {
      console.warn(
        `[TaskDistribution] Agent ${agent.agentId} unresponsive (no heartbeat for ` +
          `${now.getTime() - agent.lastHeartbeat.getTime()}ms) — marking offline and reclaiming tasks`
      );
      agent.isOnline = false;
      agent.isBusy = false;
      agent.currentTaskCount = 0;
      await this.reclaimTasksFromAgent(agent.agentId);
    }
  }

  /**
   * Return the currently-online agents that have stopped sending heartbeats and
   * are therefore presumed dead. Pure in-memory read (no DB) — the source of
   * truth for which agents detection will reclaim from.
   *
   * @param now reference time (defaults to current time)
   */
  getUnresponsiveAgents(now: Date = new Date()): AgentAvailability[] {
    return Array.from(this.agentAvailability.values()).filter(
      (agent) =>
        agent.isOnline &&
        isAgentUnresponsive(agent.lastHeartbeat, now, this.agentHeartbeatTimeoutMs)
    );
  }

  /**
   * Release every queued task currently claimed by an agent and re-distribute
   * them, so a departed/dead agent's work is picked up by someone else. Shared
   * by the agent:offline handler and unresponsive-agent detection.
   *
   * @param agentId the agent whose claims should be released
   * @returns the number of tasks reclaimed
   */
  private async reclaimTasksFromAgent(agentId: string): Promise<number> {
    try {
      const tasks = await this.store.getClaimedQueueEntriesByAgent(agentId);

      if (tasks.length === 0) return 0;

      console.log(`[TaskDistribution] Reclaiming ${tasks.length} task(s) from agent ${agentId}`);

      for (const task of tasks) {
        await this.store.releaseQueueClaimById(task.id);
      }

      // Re-distribute per affected project.
      const projectIds = new Set(tasks.map((t: any) => t.projectId));
      for (const projectId of projectIds) {
        await this.distributeQueuedTasksInParallel(projectId);
      }

      return tasks.length;
    } catch (error) {
      console.error(`[TaskDistribution] Error reclaiming tasks from agent ${agentId}:`, error);
      return 0;
    }
  }

  /**
   * Release tasks whose claiming agent appears to have crashed or hung — i.e.
   * the claim is older than the stale timeout but the task never completed or
   * failed. Reclaimed tasks have their claim cleared so the next distribution
   * pass can hand them to another agent.
   *
   * @param projectId scope the sweep to a single project
   * @returns the number of stale claims reclaimed
   */
  private async reclaimStaleClaims(projectId: string): Promise<number> {
    try {
      const cutoff = staleClaimCutoff(new Date(), this.claimStaleTimeoutMs);

      const staleClaims = await this.store.getStaleClaims(projectId, cutoff);

      if (staleClaims.length === 0) return 0;

      for (const claim of staleClaims) {
        await this.store.releaseQueueClaimById(claim.id);
        console.warn(
          `[TaskDistribution] Reclaimed stale task ${claim.taskId} from agent ${claim.claimedBy} (claimed at ${claim.claimedAt?.toISOString()})`
        );
      }

      console.log(
        `[TaskDistribution] Reclaimed ${staleClaims.length} stale claim(s) for project ${projectId}`
      );
      return staleClaims.length;
    } catch (error) {
      console.error(`[TaskDistribution] Error reclaiming stale claims for project ${projectId}:`, error);
      return 0;
    }
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentAvailability[] {
    return Array.from(this.agentAvailability.values());
  }

  /**
   * Get agent status by ID
   */
  getAgentStatus(agentId: string): AgentAvailability | null {
    return this.agentAvailability.get(agentId) || null;
  }

  /**
   * Unregister an agent (called when agent goes offline)
   */
  unregisterAgent(agentId: string): void {
    this.agentAvailability.delete(agentId);
    console.log(`[TaskDistribution] Agent unregistered: ${agentId}`);
  }

  /**
   * Reset all metrics and agent tracking (for testing)
   */
  reset(): void {
    this.agentAvailability.clear();
    this.taskDependencies.clear();
    this.distributionMetrics = {
      tasksDistributed: 0,
      averageDistributionTime: 0,
      lastDistributionTimestamp: new Date(),
      distributionSuccessRate: 100
    };
    console.log('[TaskDistribution] Service reset');
  }
}
