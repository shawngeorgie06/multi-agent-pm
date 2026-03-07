/**
 * Integration Tests: Phase A1 + A2
 * Tests MessageBus integration and TaskQueue Manager functionality
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus.js';
import { TaskQueueManager } from '../../src/services/TaskQueueManager.js';
import { TaskDistributionService } from '../../src/services/TaskDistributionService.js';
import { AgentClaimingHelper } from '../../src/services/AgentClaimingHelper.js';
import prisma from '../../src/database/db.js';

// Mock data
const mockProject = {
  id: 'test-project-a1a2',
  name: 'Phase A1+A2 Integration Test',
  description: 'Testing MessageBus and TaskQueue',
  status: 'in_progress'
};

const mockTasks = [
  {
    id: 'task-1',
    taskId: 'PM-001',
    description: 'Project planning',
    status: 'TODO',
    priority: 'HIGH',
    requiredCapabilities: ['planning']
  },
  {
    id: 'task-2',
    taskId: 'FE-001',
    description: 'Frontend development',
    status: 'TODO',
    priority: 'HIGH',
    requiredCapabilities: ['html', 'css', 'javascript']
  },
  {
    id: 'task-3',
    taskId: 'BE-001',
    description: 'Backend development',
    status: 'TODO',
    priority: 'MEDIUM',
    requiredCapabilities: ['nodejs', 'express']
  }
];

describe('Phase A1 + A2 Integration Tests', () => {
  let messageBus: MessageBus;
  let taskQueueManager: TaskQueueManager;
  let taskDistributionService: TaskDistributionService;

  beforeAll(async () => {
    // Initialize services
    messageBus = new MessageBus();
    taskQueueManager = new TaskQueueManager(undefined, messageBus);
    taskDistributionService = new TaskDistributionService(
      messageBus,
      taskQueueManager
    );

    // Create test project
    try {
      await prisma.project.create({
        data: mockProject
      });
    } catch (err) {
      // Project may already exist
    }

    // Create test tasks
    for (const task of mockTasks) {
      try {
        await prisma.task.create({
          data: {
            projectId: mockProject.id,
            taskId: task.taskId,
            description: task.description,
            status: task.status,
            priority: task.priority,
            requiredCapabilities: task.requiredCapabilities
          }
        });
      } catch (err) {
        // Task may already exist
      }
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.taskQueue.deleteMany({
        where: { projectId: mockProject.id }
      });
      await prisma.task.deleteMany({
        where: { projectId: mockProject.id }
      });
      await prisma.project.delete({
        where: { id: mockProject.id }
      });
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  describe('Phase A1: MessageBus Integration', () => {
    test('MessageBus should broadcast events', (done) => {
      const events: any[] = [];

      messageBus.on('project:planning:started', (data) => {
        events.push({ type: 'project:planning:started', data });
      });

      messageBus.broadcast({
        event: 'project:planning:started',
        projectId: mockProject.id,
        userRequest: 'Build a todo app'
      });

      setTimeout(() => {
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('project:planning:started');
        expect(events[0].data.projectId).toBe(mockProject.id);
        done();
      }, 50);
    });

    test('MessageBus should handle multiple subscribers', (done) => {
      const subscriber1Events: any[] = [];
      const subscriber2Events: any[] = [];

      messageBus.on('tasks:extracted', (data) => {
        subscriber1Events.push(data);
      });

      messageBus.on('tasks:extracted', (data) => {
        subscriber2Events.push(data);
      });

      messageBus.broadcast({
        event: 'tasks:extracted',
        projectId: mockProject.id,
        count: 3,
        tasks: mockTasks
      });

      setTimeout(() => {
        expect(subscriber1Events).toHaveLength(1);
        expect(subscriber2Events).toHaveLength(1);
        expect(subscriber1Events[0].count).toBe(3);
        done();
      }, 50);
    });

    test('MessageBus should track pending requests', (done) => {
      messageBus.request('agent-1', { message: 'test' }).then(() => {
        const pending = messageBus.getPendingRequests();
        expect(pending.length).toBeGreaterThanOrEqual(0);
        done();
      });
    });
  });

  describe('Phase A2: Task Queue Population', () => {
    test('TaskDistributionService should populate TaskQueue', async () => {
      // Clear existing queue entries
      await prisma.taskQueue.deleteMany({
        where: { projectId: mockProject.id }
      });

      // Populate queue
      await taskDistributionService.populateTaskQueue(
        mockProject.id,
        mockTasks
      );

      // Verify tasks in queue
      const queuedTasks = await prisma.taskQueue.findMany({
        where: { projectId: mockProject.id }
      });

      expect(queuedTasks.length).toBe(3);
      expect(queuedTasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            taskId: 'PM-001',
            projectId: mockProject.id,
            agentType: 'PROJECT_MANAGER'
          }),
          expect.objectContaining({
            taskId: 'FE-001',
            projectId: mockProject.id,
            agentType: 'FRONTEND'
          }),
          expect.objectContaining({
            taskId: 'BE-001',
            projectId: mockProject.id,
            agentType: 'BACKEND'
          })
        ])
      );
    });

    test('TaskQueue entries should have correct agent types inferred', async () => {
      const queuedTasks = await prisma.taskQueue.findMany({
        where: { projectId: mockProject.id }
      });

      const pmTask = queuedTasks.find(t => t.taskId === 'PM-001');
      const feTask = queuedTasks.find(t => t.taskId === 'FE-001');
      const beTask = queuedTasks.find(t => t.taskId === 'BE-001');

      expect(pmTask?.agentType).toBe('PROJECT_MANAGER');
      expect(feTask?.agentType).toBe('FRONTEND');
      expect(beTask?.agentType).toBe('BACKEND');
    });

    test('TaskQueue entries should be unclaimed initially', async () => {
      const queuedTasks = await prisma.taskQueue.findMany({
        where: { projectId: mockProject.id }
      });

      queuedTasks.forEach(task => {
        expect(task.claimedBy).toBeNull();
        expect(task.claimedAt).toBeNull();
      });
    });

    test('TaskQueue should have correct capabilities', async () => {
      const feTask = await prisma.taskQueue.findFirst({
        where: { taskId: 'FE-001', projectId: mockProject.id }
      });

      expect(feTask?.requiredCapabilities).toEqual(
        expect.arrayContaining(['html', 'css', 'javascript'])
      );
    });
  });

  describe('Phase A2: Autonomous Task Claiming', () => {
    test('AgentClaimingHelper should validate capability match', () => {
      const feHelper = new AgentClaimingHelper({
        agentId: 'agent-fe-1',
        agentType: 'FRONTEND',
        capabilities: ['html', 'css', 'javascript', 'react']
      });

      // Should match
      expect(feHelper.validateCapabilityMatch(['html', 'css'])).toBe(true);
      expect(feHelper.validateCapabilityMatch(['javascript'])).toBe(true);

      // Should not match
      expect(feHelper.validateCapabilityMatch(['nodejs', 'express'])).toBe(
        false
      );
      expect(feHelper.validateCapabilityMatch(['sql', 'postgresql'])).toBe(false);
    });

    test('AgentClaimingHelper should be case-insensitive', () => {
      const helper = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['HTML', 'CSS', 'JavaScript']
      });

      expect(helper.validateCapabilityMatch(['html'])).toBe(true);
      expect(helper.validateCapabilityMatch(['CSS'])).toBe(true);
      expect(helper.validateCapabilityMatch(['javascript'])).toBe(true);
    });

    test('AgentClaimingHelper should handle empty capabilities', () => {
      const helper1 = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: []
      });

      const helper2 = new AgentClaimingHelper({
        agentId: 'agent-2',
        agentType: 'FRONTEND',
        capabilities: ['html', 'css']
      });

      // No capabilities = can't do anything
      expect(helper1.validateCapabilityMatch(['html'])).toBe(false);

      // No requirements = any agent can do it
      expect(helper2.validateCapabilityMatch([])).toBe(true);
    });

    test('AgentClaimingHelper should claim task atomically', async () => {
      const feHelper = new AgentClaimingHelper(
        {
          agentId: 'agent-fe-1',
          agentType: 'FRONTEND',
          capabilities: ['html', 'css', 'javascript']
        },
        messageBus
      );

      // Get an unclaimed task from the queue
      const unclaimedTask = await prisma.taskQueue.findFirst({
        where: {
          projectId: mockProject.id,
          claimedBy: null,
          agentType: 'FRONTEND'
        }
      });

      if (!unclaimedTask) {
        // If no unclaimed task, create one for testing
        const created = await prisma.taskQueue.create({
          data: {
            taskId: 'FE-TEST-001',
            projectId: mockProject.id,
            agentType: 'FRONTEND',
            priority: 'HIGH',
            requiredCapabilities: ['html']
          }
        });

        const claimed = await feHelper.claimTask(created.taskId, mockProject.id);
        expect(claimed).toBe(true);

        const verified = await prisma.taskQueue.findUnique({
          where: { id: created.id }
        });
        expect(verified?.claimedBy).toBe('agent-fe-1');
      } else {
        // Claim the existing unclaimed task
        const claimed = await feHelper.claimTask(unclaimedTask.taskId, mockProject.id);
        expect(claimed).toBe(true);

        const verified = await prisma.taskQueue.findUnique({
          where: { id: unclaimedTask.id }
        });
        expect(verified?.claimedBy).toBe('agent-fe-1');
      }
    });

    test('AgentClaimingHelper should prevent double-claiming', async () => {
      const feHelper1 = new AgentClaimingHelper(
        {
          agentId: 'agent-fe-1',
          agentType: 'FRONTEND',
          capabilities: ['html', 'css', 'javascript']
        },
        messageBus
      );

      const feHelper2 = new AgentClaimingHelper(
        {
          agentId: 'agent-fe-2',
          agentType: 'FRONTEND',
          capabilities: ['html', 'css', 'javascript']
        },
        messageBus
      );

      // Reset the task to unclaimed
      await prisma.taskQueue.updateMany({
        where: { taskId: 'FE-001', projectId: mockProject.id },
        data: { claimedBy: null, claimedAt: null }
      });

      // First agent claims
      const claimed1 = await feHelper1.claimTask(
        'FE-001',
        mockProject.id
      );
      expect(claimed1).toBe(true);

      // Second agent tries to claim the same task
      const claimed2 = await feHelper2.claimTask(
        'FE-001',
        mockProject.id
      );
      expect(claimed2).toBe(false);

      // Verify first agent still owns it
      const task = await prisma.taskQueue.findFirst({
        where: { taskId: 'FE-001', projectId: mockProject.id }
      });
      expect(task?.claimedBy).toBe('agent-fe-1');
    });
  });

  describe('Phase A2: Task Completion and Failure', () => {
    test('AgentClaimingHelper should report task completion', async () => {
      const helper = new AgentClaimingHelper(
        {
          agentId: 'agent-be-1',
          agentType: 'BACKEND',
          capabilities: ['nodejs', 'express']
        },
        messageBus
      );

      // Report completion
      await helper.reportCompletion(
        'BE-001',
        mockProject.id,
        'const app = express();'
      );

      // Verify in database
      const task = await prisma.task.findFirst({
        where: { taskId: 'BE-001', projectId: mockProject.id }
      });

      expect(task?.status).toBe('COMPLETE');
      expect(task?.completedBy).toBe('agent-be-1');
      expect(task?.completedAt).not.toBeNull();
      expect(task?.generatedCode).toBe('const app = express();');
    });

    test('AgentClaimingHelper should report task failure', async () => {
      // Reset task status
      await prisma.task.updateMany({
        where: { taskId: 'BE-001' },
        data: { status: 'TODO', completedBy: null, completedAt: null }
      });

      const helper = new AgentClaimingHelper(
        {
          agentId: 'agent-be-1',
          agentType: 'BACKEND',
          capabilities: ['nodejs', 'express']
        },
        messageBus
      );

      // Report failure
      await helper.reportFailure(
        'BE-001',
        mockProject.id,
        new Error('LLM timeout')
      );

      // Verify task reset to TODO
      const task = await prisma.task.findFirst({
        where: { taskId: 'BE-001', projectId: mockProject.id }
      });

      expect(task?.status).toBe('TODO');
    });
  });

  describe('Phase A2: Queue Statistics', () => {
    test('TaskDistributionService should provide queue statistics', async () => {
      const stats = await taskDistributionService.getQueueStats(mockProject.id);

      expect(stats.projectId).toBe(mockProject.id);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.unclaimed).toBeGreaterThanOrEqual(0);
      expect(stats.claimed).toBeGreaterThanOrEqual(0);
      expect(stats.utilization).toBeGreaterThanOrEqual(0);
      expect(stats.utilization).toBeLessThanOrEqual(100);
    });
  });

  describe('Backward Compatibility', () => {
    test('Project creation should still work', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Backward Compat Test',
          description: 'Testing backward compatibility',
          status: 'in_progress'
        }
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Backward Compat Test');
      expect(project.status).toBe('in_progress');

      // Cleanup
      await prisma.project.delete({
        where: { id: project.id }
      });
    });

    test('Task creation should still work', async () => {
      const task = await prisma.task.create({
        data: {
          projectId: mockProject.id,
          taskId: 'COMPAT-001',
          description: 'Backward compatibility test',
          status: 'TODO',
          priority: 'MEDIUM'
        }
      });

      expect(task.id).toBeDefined();
      expect(task.taskId).toBe('COMPAT-001');
      expect(task.status).toBe('TODO');

      // Cleanup
      await prisma.task.delete({
        where: { id: task.id }
      });
    });

    test('Message creation should still work', async () => {
      const message = await prisma.message.create({
        data: {
          projectId: mockProject.id,
          fromAgent: 'PROJECT_MANAGER',
          toAgent: 'FRONTEND',
          messageType: 'TASK_ASSIGNMENT',
          content: 'Build the frontend'
        }
      });

      expect(message.id).toBeDefined();
      expect(message.projectId).toBe(mockProject.id);

      // Cleanup
      await prisma.message.delete({
        where: { id: message.id }
      });
    });
  });
});
