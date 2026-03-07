import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ConversationMessage } from '../models/types.js';

export class SocketServer {
  private io: SocketIOServer;
  private connectedClients = new Set<string>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Listen for project creation
      socket.on('start_project', (data: { projectId: string; description: string }) => {
        console.log(`Project started: ${data.projectId}`);
        socket.emit('project_started', { projectId: data.projectId });
      });

      socket.on('error', (error: Error) => {
        console.error(`Socket error from ${socket.id}:`, error);
      });
    });
  }

  /**
   * Emit a message to all connected clients
   */
  emitToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Emit a message to a specific client
   */
  emitToClient(clientId: string, event: string, data: any): void {
    this.io.to(clientId).emit(event, data);
  }

  /**
   * Emit a message to all clients except the sender
   */
  broadcastExcept(senderId: string, event: string, data: any): void {
    this.io.except(senderId).emit(event, data);
  }

  /**
   * Emit agent message to all connected clients
   * @param streamingMessageId - ID used during streaming; frontend uses this to clear the streaming message
   */
  emitAgentMessage(projectId: string, message: any, streamingMessageId?: string): void {
    this.emitToAll('message_received', {
      projectId,
      message,
      streamingMessageId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit task as soon as it's parsed (streaming, before DB save)
   */
  emitTaskStreamed(projectId: string, task: { taskId: string; description: string; status: string; priority: string; estimatedHours?: number; dependencies?: string[] }): void {
    this.emitToAll('task_streamed', {
      projectId,
      task,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit task update to all connected clients
   */
  emitTaskUpdate(projectId: string, task: any): void {
    this.emitToAll('task_updated', {
      projectId,
      task,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit project status change
   * @param message - Optional human-readable status (e.g. "Planning with PM agent...")
   */
  emitProjectStatus(projectId: string, status: string, message?: string): void {
    this.emitToAll('project_status_changed', {
      projectId,
      status,
      message: message ?? status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit blocker alert
   */
  emitBlockerAlert(projectId: string, blocker: string): void {
    this.emitToAll('blocker_alert', {
      projectId,
      blocker,
      timestamp: new Date().toISOString(),
    });
  }


  /**
   * Emit a message chunk for real-time streaming
   */
  emitMessageChunk(
    projectId: string,
    messageId: string,
    agent: string,
    chunk: string
  ): void {
    this.emitToAll('message_chunk', {
      projectId,
      messageId,
      agent,
      chunk,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit when a message is complete
   */
  emitMessageComplete(projectId: string, messageId: string): void {
    this.emitToAll('message_complete', {
      projectId,
      messageId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit agent activity during non-streaming phases (e.g. Layout/Styling/Logic code gen)
   * Shows in Message Log so user sees something is happening
   */
  emitAgentActivity(projectId: string, agent: string, message: string): void {
    this.emitToAll('agent_activity', {
      projectId,
      agent,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit task failure notification
   */
  emitTaskFailed(projectId: string, taskId: string, reason: string): void {
    this.emitToAll('task_failed', {
      projectId,
      taskId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit parsing error to frontend with recovery details
   */
  emitParsingError(projectId: string, messageId: string, errorMessage: string): void {
    this.emitToAll('parsing_error', {
      projectId,
      messageId,
      errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit when tasks are ready to display (after being saved to DB)
   */
  emitTasksReady(projectId: string, taskCount: number): void {
    this.emitToAll('tasks_ready', {
      projectId,
      taskCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit research analysis complete
   */
  emitResearchComplete(projectId: string, research: any): void {
    this.emitToAll('research_complete', {
      projectId,
      research,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit QA report
   */
  emitQAReport(projectId: string, report: any): void {
    this.emitToAll('qa_report', {
      projectId,
      report,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit agent progress update
   */
  emitAgentProgress(projectId: string, agent: string, phase: string, message: string): void {
    this.emitToAll('agent_progress', {
      projectId,
      agent,
      phase,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit when agent claims a task from queue
   */
  emitTaskClaimed(projectId: string, taskId: string, agentId: string, agentType: string): void {
    this.emitToAll('execution:task:claimed', {
      projectId,
      taskId,
      agentId,
      agentType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit when task execution starts
   */
  emitTaskExecutionStarted(projectId: string, taskId: string, agentId: string): void {
    this.emitToAll('execution:task:started', {
      projectId,
      taskId,
      agentId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit task execution progress
   */
  emitTaskProgress(projectId: string, taskId: string, agentId: string, progress: number, message: string): void {
    this.emitToAll('execution:task:progress', {
      projectId,
      taskId,
      agentId,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit when agent comes online
   */
  emitAgentOnline(agentId: string, agentType: string): void {
    this.emitToAll('execution:agent:online', {
      agentId,
      agentType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit when agent goes offline
   */
  emitAgentOffline(agentId: string, agentType: string): void {
    this.emitToAll('execution:agent:offline', {
      agentId,
      agentType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit execution metrics/progress update
   */
  emitExecutionMetrics(projectId: string, metrics: any): void {
    this.emitToAll('execution:metrics', {
      projectId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit queue statistics
   */
  emitQueueStats(projectId: string, stats: any): void {
    this.emitToAll('execution:queue:stats', {
      projectId,
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit task timeout warning
   */
  emitTaskTimeoutWarning(projectId: string, taskId: string, agentId: string, percentComplete: number): void {
    this.emitToAll('execution:task:timeout:warning', {
      projectId,
      taskId,
      agentId,
      percentComplete,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit task timeout exceeded
   */
  emitTaskTimeoutExceeded(projectId: string, taskId: string, agentId: string): void {
    this.emitToAll('execution:task:timeout:exceeded', {
      projectId,
      taskId,
      agentId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit task retry initiated
   */
  emitTaskRetry(projectId: string, taskId: string, agentId: string, retryCount: number, backoffMs: number): void {
    this.emitToAll('execution:task:retry', {
      projectId,
      taskId,
      agentId,
      retryCount,
      backoffMs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit parallel execution started
   */
  emitExecutionStarted(projectId: string, agentCount: number): void {
    this.emitToAll('execution:started', {
      projectId,
      agentCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit parallel execution completed
   */
  emitExecutionCompleted(projectId: string, stats: any): void {
    this.emitToAll('execution:completed', {
      projectId,
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase A3: Emit health check update
   */
  emitHealthCheck(projectId: string, healthMetrics: any): void {
    this.emitToAll('execution:health', {
      projectId,
      healthMetrics,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}
