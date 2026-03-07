/**
 * BaseAgent - Abstract base class for autonomous event-driven agents
 * Phase A3: Parallel Execution Engine
 *
 * Provides event-driven task claiming and execution infrastructure
 * that enables agents to autonomously listen for, claim, and execute tasks
 * from the distributed task queue.
 */

import { MessageBus } from '../services/MessageBus.js';
import { AgentClaimingHelper } from '../services/AgentClaimingHelper.js';
import prisma from '../database/db.js';

export enum AgentState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  CLAIMING = 'CLAIMING',
  EXECUTING = 'EXECUTING',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR'
}

export interface AgentConfig {
  agentId: string;
  agentType: 'PROJECT_MANAGER' | 'FRONTEND' | 'BACKEND' | 'LAYOUT' | 'STYLING' | 'LOGIC' | 'QA' | 'RESEARCH' | 'DESIGNER' | 'ENGINEER' | 'DESIGN_DIRECTOR';
  capabilities: string[];
}

export abstract class BaseAgent {
  protected agentId: string;
  protected agentType: AgentConfig['agentType'];
  protected capabilities: string[];
  protected messageBus: MessageBus;
  protected claimingHelper: AgentClaimingHelper;

  protected state: AgentState = AgentState.IDLE;
  protected isListening: boolean = false;
  protected currentTaskId: string | null = null;
  protected heartbeatInterval: NodeJS.Timeout | null = null;
  protected listenerChannel: string;

  constructor(
    config: AgentConfig,
    messageBus: MessageBus
  ) {
    this.agentId = config.agentId;
    this.agentType = config.agentType;
    this.capabilities = config.capabilities;
    this.messageBus = messageBus;
    this.listenerChannel = `agent:${this.agentType}`;

    // Initialize claiming helper with this agent's config
    this.claimingHelper = new AgentClaimingHelper(
      {
        agentId: this.agentId,
        agentType: this.agentType,
        capabilities: this.capabilities
      },
      this.messageBus
    );
  }

  /**
   * Start listening for available tasks on MessageBus
   * This is the entry point for autonomous agent execution
   */
  public async startListening(): Promise<void> {
    if (this.isListening) {
      console.log(`[${this.agentId}] Already listening for tasks`);
      return;
    }

    this.isListening = true;
    this.state = AgentState.LISTENING;

    console.log(`[${this.agentId}] Starting to listen for tasks on channel: ${this.listenerChannel}`);

    // Subscribe to task:available events for this agent type
    this.setupEventListeners();

    // Start heartbeat to signal agent is online
    this.startHeartbeat();

    // Emit agent online event
    this.messageBus.broadcast({
      event: 'agent:online',
      agentId: this.agentId,
      agentType: this.agentType,
      timestamp: new Date()
    });

    console.log(`[${this.agentId}] Now listening for task:available events`);
  }

  /**
   * Stop listening for tasks and go offline
   */
  public async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    this.state = AgentState.OFFLINE;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Emit agent offline event
    this.messageBus.broadcast({
      event: 'agent:offline',
      agentId: this.agentId,
      agentType: this.agentType,
      timestamp: new Date()
    });

    console.log(`[${this.agentId}] Stopped listening and going offline`);
  }

  /**
   * Setup event listeners for task availability and other events
   */
  protected setupEventListeners(): void {
    // Listen for task:available events on this agent type's channel
    this.messageBus.on(this.listenerChannel, async (message: any) => {
      if (message.event === 'task:available') {
        await this.handleTaskAvailable(message);
      }
    });

    // Listen for explicit agent shutdown events
    this.messageBus.on(`agent:${this.agentId}`, async (message: any) => {
      if (message.event === 'agent:shutdown') {
        await this.stopListening();
      }
    });

    // Listen for task timeout notifications on broadcast channel
    this.messageBus.on('broadcast', async (envelope: any) => {
      const message = envelope.content || envelope;
      if (message.event === 'task:timeout' && message.agentId === this.agentId && message.taskId === this.currentTaskId) {
        await this.handleTaskTimeout(message.taskId, message.projectId);
      }
    });
  }

  /**
   * Handle task available event - attempt to claim and execute the task
   */
  protected async handleTaskAvailable(message: any): Promise<void> {
    const { taskId, projectId, requiredCapabilities, priority } = message;

    // Check if we can handle this task
    if (!this.claimingHelper.validateCapabilityMatch(requiredCapabilities || [])) {
      console.log(`[${this.agentId}] Task ${taskId} requires capabilities we don't have`);
      return;
    }

    // Try to claim the task atomically
    const claimed = await this.claimingHelper.claimTask(taskId, projectId);

    if (!claimed) {
      console.log(`[${this.agentId}] Task ${taskId} was already claimed by another agent`);
      return;
    }

    // Task claimed successfully - execute it
    await this.executeClaimedTask(taskId, projectId);
  }

  /**
   * Execute a claimed task
   */
  protected async executeClaimedTask(taskId: string, projectId: string): Promise<void> {
    this.currentTaskId = taskId;
    this.state = AgentState.EXECUTING;

    console.log(`[${this.agentId}] Starting execution of task ${taskId}`);

    try {
      // Fetch task details from database
      const task = await prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error(`Task ${taskId} not found in database`);
      }

      // Emit task execution started event
      this.messageBus.broadcast({
        event: 'task:execution:started',
        taskId,
        projectId,
        agentId: this.agentId,
        timestamp: new Date()
      });

      // Fetch all completed tasks from the same project to provide context
      const completedTasks = await prisma.task.findMany({
        where: {
          projectId: projectId,
          status: 'COMPLETE',
          generatedCode: { not: null }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Build context object with previous outputs
      const taskContext = {
        previousOutputs: completedTasks.map(t => ({
          taskId: t.taskId,
          description: t.description,
          generatedCode: t.generatedCode,
          type: this.inferTaskType(t.description)
        })),
        layoutHTML: completedTasks.find(t => this.inferTaskType(t.description) === 'layout')?.generatedCode,
        stylingCSS: completedTasks.find(t => this.inferTaskType(t.description) === 'styling')?.generatedCode,
        logicJS: completedTasks.find(t => this.inferTaskType(t.description) === 'logic')?.generatedCode
      };

      // Execute the task (implemented by subclasses) with context
      const startTime = Date.now();
      const result = await this.executeTask(task, taskContext);
      const duration = Date.now() - startTime;

      // Report successful completion
      await this.claimingHelper.reportCompletion(taskId, projectId, result?.generatedCode);

      console.log(`[${this.agentId}] Task ${taskId} completed in ${duration}ms`);

      // Emit completion event
      this.messageBus.broadcast({
        event: 'task:execution:completed',
        taskId,
        projectId,
        agentId: this.agentId,
        duration,
        timestamp: new Date()
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${this.agentId}] Task ${taskId} failed:`, errorMsg);

      // Report failure
      await this.claimingHelper.reportFailure(taskId, projectId, error as Error);

      // Emit failure event
      this.messageBus.broadcast({
        event: 'task:execution:failed',
        taskId,
        projectId,
        agentId: this.agentId,
        error: errorMsg,
        timestamp: new Date()
      });

      this.state = AgentState.ERROR;
    } finally {
      // Reset current task
      this.currentTaskId = null;
      this.state = AgentState.LISTENING;
    }
  }

  /**
   * Handle task timeout
   */
  protected async handleTaskTimeout(taskId: string, projectId: string): Promise<void> {
    console.warn(`[${this.agentId}] Task ${taskId} timed out`);

    await this.claimingHelper.reportFailure(
      taskId,
      projectId,
      new Error('Task execution timeout')
    );

    // Reset state
    this.currentTaskId = null;
    this.state = AgentState.LISTENING;
  }

  /**
   * Start periodic heartbeat to signal agent is online
   */
  protected startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.messageBus.broadcast({
        event: 'agent:heartbeat',
        agentId: this.agentId,
        agentType: this.agentType,
        state: this.state,
        currentTask: this.currentTaskId,
        timestamp: new Date()
      });
    }, 5000); // Send heartbeat every 5 seconds
  }

  /**
   * Infer task type from description for context building
   */
  protected inferTaskType(description: string): 'layout' | 'styling' | 'logic' | 'unknown' {
    const lower = description.toLowerCase();
    if (lower.includes('html') || lower.includes('structure') || lower.includes('layout')) {
      return 'layout';
    } else if (lower.includes('css') || lower.includes('style') || lower.includes('styling')) {
      return 'styling';
    } else if (lower.includes('javascript') || lower.includes('logic') || lower.includes('interactivity')) {
      return 'logic';
    }
    return 'unknown';
  }

  /**
   * Abstract method - subclasses implement specific task execution logic
   * @param task The task to execute
   * @param context Previous task outputs for coordination
   */
  abstract executeTask(task: any, context?: any): Promise<any>;

  /**
   * Utility: Emit progress update to MessageBus
   */
  protected emitProgress(taskId: string, projectId: string, progress: number, message: string): void {
    this.messageBus.broadcast({
      event: 'task:progress',
      taskId,
      projectId,
      agentId: this.agentId,
      progress,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Utility: Get agent ID
   */
  public getAgentId(): string {
    return this.agentId;
  }

  /**
   * Utility: Get agent capabilities
   */
  public getCapabilities(): string[] {
    return this.capabilities;
  }

  /**
   * Utility: Get agent state
   */
  public getState(): AgentState {
    return this.state;
  }

  /**
   * Utility: Check if agent is listening
   */
  public isActive(): boolean {
    return this.isListening && this.state !== AgentState.OFFLINE;
  }
}
