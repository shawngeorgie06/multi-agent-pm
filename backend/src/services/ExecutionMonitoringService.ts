/**
 * Execution Monitoring Service - Phase A3
 * Monitors task timeouts, agent heartbeats, and execution health
 * Detects stalled tasks and dead agents, triggers recovery actions
 */

import { MessageBus } from './MessageBus.js';

/**
 * Task execution timeout config
 */
export interface TaskTimeoutConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  warningThresholdMs: number; // Warn at 80% of timeout
}

/**
 * Agent heartbeat config
 */
export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  maxMissedBeats: number;
}

/**
 * Task timeout tracking
 */
interface TaskTimeout {
  taskId: string;
  projectId: string;
  agentId: string;
  startedAt: Date;
  timeoutMs: number;
  warningEmitted: boolean;
}

/**
 * Agent heartbeat tracking
 */
interface AgentHeartbeat {
  agentId: string;
  lastHeartbeatAt: Date;
  missedBeats: number;
  isHealthy: boolean;
}

/**
 * Execution health metrics
 */
export interface ExecutionHealthMetrics {
  totalTasksMonitored: number;
  tasksExpired: number;
  tasksWarned: number;
  totalAgentsMonitored: number;
  healthyAgents: number;
  unhealthyAgents: number;
  staleAgents: number;
  lastCheckAt: Date;
}

/**
 * Execution Monitoring Service
 */
export class ExecutionMonitoringService {
  private messageBus: MessageBus;
  private taskTimeouts: Map<string, TaskTimeout> = new Map();
  private agentHeartbeats: Map<string, AgentHeartbeat> = new Map();
  private healthMetrics: ExecutionHealthMetrics;

  // Configuration
  private taskTimeoutConfig: TaskTimeoutConfig = {
    defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes
    maxTimeoutMs: 30 * 60 * 1000,    // 30 minutes
    warningThresholdMs: 0.8          // 80% of timeout
  };

  private heartbeatConfig: HeartbeatConfig = {
    intervalMs: 5000,       // Check every 5 seconds
    timeoutMs: 30000,       // 30 seconds without heartbeat = offline
    maxMissedBeats: 3       // 3 missed beats before marked offline
  };

  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
    this.healthMetrics = {
      totalTasksMonitored: 0,
      tasksExpired: 0,
      tasksWarned: 0,
      totalAgentsMonitored: 0,
      healthyAgents: 0,
      unhealthyAgents: 0,
      staleAgents: 0,
      lastCheckAt: new Date()
    };

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for task and agent lifecycle
   */
  private setupEventListeners(): void {
    // When task starts, add to timeout tracking
    // Listen on broadcast channel for all events
    this.messageBus.on('broadcast', (envelope: any) => {
      const message = envelope.content || envelope;
      const eventType = message.event;

      if (eventType === 'task:started') {
        this.addTaskTimeout(message.taskId, message.projectId, message.agentId, this.taskTimeoutConfig.defaultTimeoutMs);
      } else if (eventType === 'task:completed') {
        this.removeTaskTimeout(message.taskId);
      } else if (eventType === 'task:failed') {
        this.removeTaskTimeout(message.taskId);
      } else if (eventType === 'agent:heartbeat') {
        this.updateAgentHeartbeat(message.agentId);
      } else if (eventType === 'agent:registered') {
        this.registerAgent(message.agentId);
      } else if (eventType === 'agent:offline') {
        this.markAgentUnhealthy(message.agentId);
      }
    });
  }

  /**
   * Start monitoring execution health
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('[ExecutionMonitoring] Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    console.log('[ExecutionMonitoring] Starting execution health monitoring');

    // Run health checks on interval
    this.monitoringInterval = setInterval(() => {
      this.checkExecutionHealth();
    }, this.heartbeatConfig.intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    console.log('[ExecutionMonitoring] Stopped execution health monitoring');
  }

  /**
   * Check overall execution health
   */
  private checkExecutionHealth(): void {
    const now = new Date();

    // Check task timeouts
    for (const [taskId, taskTimeout] of this.taskTimeouts.entries()) {
      const elapsedMs = now.getTime() - taskTimeout.startedAt.getTime();
      const percentComplete = (elapsedMs / taskTimeout.timeoutMs) * 100;

      // Emit warning at 80% of timeout
      if (!taskTimeout.warningEmitted && percentComplete >= this.taskTimeoutConfig.warningThresholdMs * 100) {
        this.messageBus.emit('task:timeout:warning', {
          taskId,
          projectId: taskTimeout.projectId,
          agentId: taskTimeout.agentId,
          elapsedMs,
          timeoutMs: taskTimeout.timeoutMs,
          percentComplete: Math.round(percentComplete),
          timestamp: now
        });

        taskTimeout.warningEmitted = true;
        this.healthMetrics.tasksWarned++;

        console.warn(
          `[ExecutionMonitoring] Task ${taskId} timeout warning: ${Math.round(percentComplete)}% elapsed`
        );
      }

      // Emit timeout exceeded
      if (elapsedMs > taskTimeout.timeoutMs) {
        this.messageBus.emit('task:timeout:exceeded', {
          taskId,
          projectId: taskTimeout.projectId,
          agentId: taskTimeout.agentId,
          elapsedMs,
          timeoutMs: taskTimeout.timeoutMs,
          timestamp: now
        });

        this.removeTaskTimeout(taskId);
        this.healthMetrics.tasksExpired++;

        console.error(`[ExecutionMonitoring] Task ${taskId} timeout exceeded: ${elapsedMs}ms > ${taskTimeout.timeoutMs}ms`);
      }
    }

    // Check agent heartbeats
    for (const [agentId, heartbeat] of this.agentHeartbeats.entries()) {
      const timeSinceHeartbeat = now.getTime() - heartbeat.lastHeartbeatAt.getTime();

      if (timeSinceHeartbeat > this.heartbeatConfig.timeoutMs) {
        heartbeat.missedBeats++;

        if (heartbeat.missedBeats >= this.heartbeatConfig.maxMissedBeats && heartbeat.isHealthy) {
          heartbeat.isHealthy = false;
          this.healthMetrics.unhealthyAgents++;

          this.messageBus.emit('agent:heartbeat:failed', {
            agentId,
            missedBeats: heartbeat.missedBeats,
            timeSinceHeartbeat,
            timestamp: now
          });

          console.error(
            `[ExecutionMonitoring] Agent ${agentId} heartbeat failed: ${heartbeat.missedBeats} missed beats`
          );
        }
      }
    }

    // Update metrics timestamp
    this.healthMetrics.lastCheckAt = new Date();
  }

  /**
   * Add task to timeout tracking
   */
  private addTaskTimeout(taskId: string, projectId: string, agentId: string, timeoutMs: number): void {
    const actualTimeout = Math.min(timeoutMs, this.taskTimeoutConfig.maxTimeoutMs);

    this.taskTimeouts.set(taskId, {
      taskId,
      projectId,
      agentId,
      startedAt: new Date(),
      timeoutMs: actualTimeout,
      warningEmitted: false
    });

    this.healthMetrics.totalTasksMonitored++;

    console.log(
      `[ExecutionMonitoring] Task ${taskId} added to timeout tracking (${actualTimeout}ms timeout)`
    );
  }

  /**
   * Remove task from timeout tracking
   */
  private removeTaskTimeout(taskId: string): void {
    this.taskTimeouts.delete(taskId);
  }

  /**
   * Register agent for heartbeat tracking
   */
  private registerAgent(agentId: string): void {
    this.agentHeartbeats.set(agentId, {
      agentId,
      lastHeartbeatAt: new Date(),
      missedBeats: 0,
      isHealthy: true
    });

    this.healthMetrics.totalAgentsMonitored++;
    this.healthMetrics.healthyAgents++;

    console.log(`[ExecutionMonitoring] Agent ${agentId} registered for heartbeat tracking`);
  }

  /**
   * Update agent heartbeat
   */
  private updateAgentHeartbeat(agentId: string): void {
    const heartbeat = this.agentHeartbeats.get(agentId);

    if (!heartbeat) {
      return;
    }

    heartbeat.lastHeartbeatAt = new Date();
    heartbeat.missedBeats = 0;

    if (!heartbeat.isHealthy) {
      heartbeat.isHealthy = true;
      this.healthMetrics.healthyAgents++;
      this.healthMetrics.unhealthyAgents--;

      this.messageBus.emit('agent:heartbeat:recovered', {
        agentId,
        timestamp: new Date()
      });

      console.log(`[ExecutionMonitoring] Agent ${agentId} heartbeat recovered`);
    }
  }

  /**
   * Mark agent as unhealthy
   */
  private markAgentUnhealthy(agentId: string): void {
    const heartbeat = this.agentHeartbeats.get(agentId);

    if (heartbeat && heartbeat.isHealthy) {
      heartbeat.isHealthy = false;
      this.healthMetrics.healthyAgents--;
      this.healthMetrics.unhealthyAgents++;
      this.healthMetrics.staleAgents++;

      console.error(`[ExecutionMonitoring] Agent ${agentId} marked as unhealthy`);
    }
  }

  /**
   * Get execution health metrics
   */
  getHealthMetrics(): ExecutionHealthMetrics {
    return { ...this.healthMetrics };
  }

  /**
   * Get monitored tasks
   */
  getMonitoredTasks(): Array<{ taskId: string; elapsedMs: number; timeoutMs: number }> {
    const now = new Date();
    return Array.from(this.taskTimeouts.values()).map(t => ({
      taskId: t.taskId,
      elapsedMs: now.getTime() - t.startedAt.getTime(),
      timeoutMs: t.timeoutMs
    }));
  }

  /**
   * Get agent health status
   */
  getAgentHealthStatus(): Array<{ agentId: string; isHealthy: boolean; missedBeats: number }> {
    return Array.from(this.agentHeartbeats.values()).map(h => ({
      agentId: h.agentId,
      isHealthy: h.isHealthy,
      missedBeats: h.missedBeats
    }));
  }

  /**
   * Set task timeout configuration
   */
  setTaskTimeoutConfig(config: Partial<TaskTimeoutConfig>): void {
    this.taskTimeoutConfig = { ...this.taskTimeoutConfig, ...config };
    console.log('[ExecutionMonitoring] Task timeout config updated:', this.taskTimeoutConfig);
  }

  /**
   * Set heartbeat configuration
   */
  setHeartbeatConfig(config: Partial<HeartbeatConfig>): void {
    this.heartbeatConfig = { ...this.heartbeatConfig, ...config };
    console.log('[ExecutionMonitoring] Heartbeat config updated:', this.heartbeatConfig);
  }

  /**
   * Reset monitoring service (for testing)
   */
  reset(): void {
    this.stopMonitoring();
    this.taskTimeouts.clear();
    this.agentHeartbeats.clear();
    this.healthMetrics = {
      totalTasksMonitored: 0,
      tasksExpired: 0,
      tasksWarned: 0,
      totalAgentsMonitored: 0,
      healthyAgents: 0,
      unhealthyAgents: 0,
      staleAgents: 0,
      lastCheckAt: new Date()
    };
    console.log('[ExecutionMonitoring] Monitoring service reset');
  }
}

export default ExecutionMonitoringService;
