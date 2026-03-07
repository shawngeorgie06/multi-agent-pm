/**
 * Agent Claiming Helper - Phase A2
 * Provides utilities for agents to claim and execute tasks from TaskQueue
 */

import prisma from '../database/db.js';
import { TaskQueueManager } from './TaskQueueManager.js';
import { MessageBus } from './MessageBus.js';

export interface AgentClaimConfig {
  agentId: string;
  agentType: 'PROJECT_MANAGER' | 'FRONTEND' | 'BACKEND' | 'LAYOUT' | 'STYLING' | 'LOGIC' | 'QA' | 'RESEARCH' | 'DESIGNER' | 'ENGINEER' | 'DESIGN_DIRECTOR';
  capabilities: string[];
}

export class AgentClaimingHelper {
  constructor(
    private config: AgentClaimConfig,
    private messageBus?: MessageBus
  ) {}

  /**
   * Check if agent capabilities match task requirements
   */
  validateCapabilityMatch(requiredCapabilities: string[]): boolean {
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true; // Any agent can do tasks with no requirements
    }

    if (!this.config.capabilities || this.config.capabilities.length === 0) {
      return false; // Agent with no capabilities can't do anything
    }

    // Check if agent has all required capabilities (case-insensitive)
    const agentCaps = this.config.capabilities.map(c => c.toLowerCase());
    return requiredCapabilities.every(req =>
      agentCaps.some(cap => cap.includes(req.toLowerCase()) || req.toLowerCase().includes(cap))
    );
  }

  /**
   * Attempt to claim a task atomically
   * Returns true if successful, false if another agent claimed it first
   */
  async claimTask(taskId: string, projectId: string): Promise<boolean> {
    try {
      // Atomic update: only claim if still unclaimed (claimedBy is null)
      const result = await prisma.taskQueue.updateMany({
        where: {
          taskId,
          projectId,
          claimedBy: null // Only claim if unclaimed
        },
        data: {
          claimedBy: this.config.agentId,
          claimedAt: new Date()
        }
      });

      if (result.count === 0) {
        // Another agent claimed it first
        console.log(`[${this.config.agentId}] Task ${taskId} already claimed by another agent`);
        return false;
      }

      console.log(`[${this.config.agentId}] Successfully claimed task ${taskId}`);

      // Also update the Task status
      await prisma.task.updateMany({
        where: { id: taskId },
        data: {
          status: 'IN_PROGRESS',
          claimedBy: this.config.agentId,
          claimedAt: new Date()
        }
      });

      // Emit event that task was claimed
      if (this.messageBus) {
        this.messageBus.broadcast({
          event: 'task:claimed',
          projectId,
          taskId,
          agentId: this.config.agentId,
          agentType: this.config.agentType
        });
      }

      return true;
    } catch (error) {
      console.error(`[${this.config.agentId}] Error claiming task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Report task completion
   */
  async reportCompletion(
    taskId: string,
    projectId: string,
    generatedCode?: string
  ): Promise<void> {
    try {
      await prisma.task.updateMany({
        where: { id: taskId },
        data: {
          status: 'COMPLETE',
          completedBy: this.config.agentId,
          completedAt: new Date(),
          generatedCode: generatedCode || null
        }
      });

      if (this.messageBus) {
        this.messageBus.broadcast({
          event: 'task:completed',
          projectId,
          taskId,
          agentId: this.config.agentId,
          generatedCode
        });
      }

      console.log(`[${this.config.agentId}] Task ${taskId} completed and reported`);
    } catch (error) {
      console.error(`[${this.config.agentId}] Error reporting completion for ${taskId}:`, error);
    }
  }

  /**
   * Report task failure and release for retry
   */
  async reportFailure(taskId: string, projectId: string, error: Error | string): Promise<void> {
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await prisma.task.updateMany({
        where: { id: taskId },
        data: {
          status: 'TODO' // Reset to TODO for retry
        }
      });

      if (this.messageBus) {
        this.messageBus.broadcast({
          event: 'task:failed',
          projectId,
          taskId,
          agentId: this.config.agentId,
          error: errorMsg
        });
      }

      console.log(`[${this.config.agentId}] Task ${taskId} failed: ${errorMsg}`);
    } catch (err) {
      console.error(`[${this.config.agentId}] Error reporting failure for ${taskId}:`, err);
    }
  }

  /**
   * Get the next available task of a specific type
   */
  async getNextAvailableTask(projectId: string): Promise<any | null> {
    try {
      const task = await prisma.taskQueue.findFirst({
        where: {
          projectId,
          claimedBy: null,
          agentType: this.config.agentType
        },
        orderBy: { priority: 'desc' } // HIGH priority first
      });

      return task;
    } catch (error) {
      console.error(`[${this.config.agentId}] Error getting next available task:`, error);
      return null;
    }
  }
}
