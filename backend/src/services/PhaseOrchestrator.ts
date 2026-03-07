/**
 * PhaseOrchestrator - Clean three-phase orchestration with zero race conditions
 *
 * PHASE 1: ORCHESTRATION
 *   - PM creates project plan
 *   - Engineer reviews and provides feedback
 *   - Loop until consensus
 *   - Output: Finalized task list
 *   - No task queueing, no agent execution
 *
 * PHASE 2: PREPARATION
 *   - Wait for Phase 1 to complete
 *   - Create TaskQueue entries from finalized tasks
 *   - Start all agents in listening mode
 *   - Output: System ready for execution
 *
 * PHASE 3: EXECUTION
 *   - Agents autonomously claim and execute tasks
 *   - Parallel execution
 *   - No orchestration interference
 *
 * Key Design: Each phase MUST complete before the next begins
 */

import { AgentOrchestrator } from '../agents/AgentOrchestrator.js';
import { MessageBus } from './MessageBus.js';
import { TaskDistributionService } from './TaskDistributionService.js';
import { TaskQueueManager } from './TaskQueueManager.js';
import { SocketServer } from '../websocket/SocketServer.js';
import prisma from '../database/db.js';

export interface Phase1Output {
  projectId: string;
  tasks: any[];
  messages: any[];
  status: 'orchestration_complete';
}

export interface Phase2Output {
  projectId: string;
  queuedTaskCount: number;
  status: 'preparation_complete';
}

export interface Phase3Output {
  projectId: string;
  status: 'execution_started';
}

export class PhaseOrchestrator {
  constructor(
    private orchestrator: AgentOrchestrator,
    private messageBus: MessageBus,
    private taskDistributionService: TaskDistributionService,
    private socketServer: SocketServer
  ) {}

  /**
   * PHASE 1: ORCHESTRATION
   * Run PM/Engineer conversation until consensus
   * Returns finalized tasks - nothing is queued yet
   */
  async phase1Orchestration(userRequest: string, projectId: string): Promise<Phase1Output> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1: ORCHESTRATION (PM/Engineer Planning)');
    console.log('='.repeat(80));

    this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Phase 1: Starting PM/Engineer orchestration…');

    try {
      // Run the full PM/Engineer orchestration
      const context = await this.orchestrator.startProjectPlanning(userRequest);

      if (context.currentStatus !== 'complete' || !context.tasks || context.tasks.length === 0) {
        throw new Error('Orchestration failed: No tasks generated');
      }

      console.log(`\n✅ PHASE 1 COMPLETE`);
      console.log(`   - PM/Engineer conversation finished`);
      console.log(`   - ${context.tasks.length} tasks finalized`);
      console.log(`   - Ready to move to Phase 2`);

      this.socketServer.emitProjectStatus(
        projectId,
        'in_progress',
        'Phase 1 complete. Preparing for execution…'
      );

      return {
        projectId,
        tasks: context.tasks,
        messages: context.allMessages,
        status: 'orchestration_complete',
      };
    } catch (error) {
      console.error('❌ PHASE 1 FAILED:', error);
      this.socketServer.emitProjectStatus(
        projectId,
        'failed',
        `Phase 1 failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * PHASE 2: PREPARATION
   * Queue all tasks and start agents listening
   * Do NOT trigger task distribution yet
   */
  async phase2Preparation(phase1Output: Phase1Output): Promise<Phase2Output> {
    const { projectId, tasks } = phase1Output;

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: PREPARATION (TaskQueue Population & Agent Startup)');
    console.log('='.repeat(80));

    this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Phase 2: Preparing agents and task queue…');

    try {
      // Save tasks to database
      console.log(`\n[PHASE 2] Saving ${tasks.length} tasks to database...`);
      const savedTasks = await this.saveTasks(projectId, tasks);
      console.log(`✅ Saved ${savedTasks.length} tasks`);

      // Create TaskQueue entries
      console.log(`\n[PHASE 2] Creating TaskQueue entries...`);
      await this.populateTaskQueue(projectId, savedTasks, tasks);
      console.log(`✅ TaskQueue populated with ${savedTasks.length} entries`);

      // Register and start agents listening
      console.log(`\n[PHASE 2] Starting all agents in listening mode...`);
      await this.startAgents();
      console.log(`✅ All agents registered and listening`);

      console.log(`\n✅ PHASE 2 COMPLETE`);
      console.log(`   - ${savedTasks.length} tasks queued`);
      console.log(`   - Agents ready to claim tasks`);
      console.log(`   - Ready to move to Phase 3`);

      this.socketServer.emitProjectStatus(
        projectId,
        'in_progress',
        'Phase 2 complete. Starting parallel execution…'
      );

      return {
        projectId,
        queuedTaskCount: savedTasks.length,
        status: 'preparation_complete',
      };
    } catch (error) {
      console.error('❌ PHASE 2 FAILED:', error);
      this.socketServer.emitProjectStatus(
        projectId,
        'failed',
        `Phase 2 failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * PHASE 3: EXECUTION
   * Agents autonomously claim and execute tasks
   */
  async phase3Execution(phase2Output: Phase2Output): Promise<Phase3Output> {
    const { projectId, queuedTaskCount } = phase2Output;

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: EXECUTION (Parallel Task Execution)');
    console.log('='.repeat(80));

    this.socketServer.emitProjectStatus(
      projectId,
      'in_progress',
      `Phase 3: Parallel execution running - ${queuedTaskCount} tasks, agents claiming autonomously…`
    );

    try {
      // Trigger task distribution - agents will autonomously claim tasks
      console.log(`\n[PHASE 3] Starting autonomous task distribution...`);
      await this.taskDistributionService.distributeQueuedTasksInParallel(projectId);
      console.log(`✅ Task distribution triggered`);

      console.log(`\n✅ PHASE 3 STARTED`);
      console.log(`   - Agents autonomously claiming tasks`);
      console.log(`   - Parallel execution in progress`);
      console.log(`   - No orchestration interference`);

      return {
        projectId,
        status: 'execution_started',
      };
    } catch (error) {
      console.error('❌ PHASE 3 FAILED:', error);
      this.socketServer.emitProjectStatus(
        projectId,
        'failed',
        `Phase 3 failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Run all three phases in sequence
   * Complete blocking orchestration → queueing → execution
   */
  async orchestrateFullWorkflow(userRequest: string, projectId: string): Promise<void> {
    try {
      // PHASE 1: Orchestration (blocking)
      const phase1Output = await this.phase1Orchestration(userRequest, projectId);

      // PHASE 2: Preparation (blocking)
      const phase2Output = await this.phase2Preparation(phase1Output);

      // PHASE 3: Execution (non-blocking, agents run autonomously)
      await this.phase3Execution(phase2Output);

      console.log('\n' + '='.repeat(80));
      console.log('✅ ALL PHASES COMPLETE - SYSTEM READY');
      console.log('='.repeat(80));
    } catch (error) {
      console.error('❌ WORKFLOW FAILED:', error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async saveTasks(
    projectId: string,
    tasks: any[]
  ): Promise<Array<{ id: string; taskId: string; description: string; status: string; priority: string }>> {
    const savedTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const uniqueTaskId = `${task.taskId}-${projectId.substring(0, 8)}`;

      try {
        const savedTask = await prisma.task.upsert({
          where: {
            projectId_taskId: {
              projectId,
              taskId: uniqueTaskId,
            },
          },
          update: {
            description: task.description,
            status: task.status,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            dependencies: task.dependencies || [],
          },
          create: {
            projectId,
            taskId: uniqueTaskId,
            description: task.description,
            status: task.status,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            dependencies: task.dependencies || [],
          },
        });

        savedTasks.push(savedTask);
      } catch (err) {
        console.error(`Error saving task ${uniqueTaskId}:`, err);
      }
    }

    return savedTasks;
  }

  private async populateTaskQueue(
    projectId: string,
    savedTasks: any[],
    originalTasks: any[]
  ): Promise<void> {
    // Clear any existing queue entries
    await prisma.taskQueue.deleteMany({
      where: { projectId },
    });

    // Create new queue entries with Task.id (UUID)
    for (let i = 0; i < savedTasks.length; i++) {
      const savedTask = savedTasks[i];
      const task = originalTasks[i];

      try {
        const inferredType = this.inferAgentType(task);

        await prisma.taskQueue.create({
          data: {
            taskId: savedTask.id, // Use UUID
            projectId,
            agentType: inferredType as any,
            priority: task.priority || 'MEDIUM',
            requiredCapabilities: [],
          },
        });
      } catch (err: any) {
        if (!err.message.includes('Unique constraint')) {
          console.error(`Error queuing task ${savedTask.id}:`, err);
        }
      }
    }
  }

  private inferAgentType(task: any): string {
    const descLower = task.description?.toLowerCase() || '';
    const taskIdLower = (task.taskId || '').toLowerCase();

    // Check task ID first
    if (taskIdLower.includes('layout') || taskIdLower.includes('html') || taskIdLower.includes('structure')) {
      return 'LAYOUT';
    } else if (taskIdLower.includes('styling') || taskIdLower.includes('style') || taskIdLower.includes('css')) {
      return 'STYLING';
    } else if (taskIdLower.includes('logic') || taskIdLower.includes('javascript') || taskIdLower.includes('js')) {
      return 'LOGIC';
    }

    // Check description
    if (descLower.includes('html') || descLower.includes('structure') || descLower.includes('layout')) {
      return 'LAYOUT';
    } else if (descLower.includes('css') || descLower.includes('style') || descLower.includes('aesthetic')) {
      return 'STYLING';
    } else if (
      descLower.includes('javascript') ||
      descLower.includes('logic') ||
      descLower.includes('interactivity')
    ) {
      return 'LOGIC';
    }

    // Fallback by order
    if ((task.taskId || '').includes('-001')) {
      return 'LAYOUT';
    } else if ((task.taskId || '').includes('-002')) {
      return 'STYLING';
    } else if ((task.taskId || '').includes('-003')) {
      return 'LOGIC';
    }

    return 'LAYOUT';
  }

  private async startAgents(): Promise<void> {
    // Start agents listening on MessageBus
    // This must happen AFTER TaskQueue is populated but BEFORE Phase 3 triggers distribution
    console.log('[PHASE 2] Starting agents in listening mode...');

    // Call orchestrator to start parallel execution (registers agents and starts listening)
    await this.orchestrator.startParallelAgentExecution();

    console.log('[PHASE 2] ✅ All agents are now listening for tasks');
  }
}
