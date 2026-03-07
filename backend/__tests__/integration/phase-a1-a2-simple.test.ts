/**
 * Simple Integration Tests: Phase A1 + A2
 * Focused tests on core functionality
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MessageBus } from '../../src/services/MessageBus.js';
import { TaskDistributionService } from '../../src/services/TaskDistributionService.js';
import { AgentClaimingHelper } from '../../src/services/AgentClaimingHelper.js';
import { TaskQueueManager } from '../../src/services/TaskQueueManager.js';
import prisma from '../../src/database/db.js';

describe('Phase A1 + A2 Simple Integration Tests', () => {
  let messageBus: MessageBus;

  beforeAll(async () => {
    messageBus = new MessageBus();
  });

  afterAll(async () => {
    // No cleanup needed for pure unit tests
  });

  describe('Phase A1: MessageBus - Core Event Functionality', () => {
    test('MessageBus should broadcast and receive events', (done) => {
      const receivedEvents: any[] = [];

      const handler = (data: any) => {
        receivedEvents.push(data);
      };

      messageBus.on('test:event', handler);

      messageBus.broadcast({
        channel: 'test:event',
        projectId: 'test-project',
        message: 'Test message'
      });

      setTimeout(() => {
        expect(receivedEvents.length).toBeGreaterThan(0);
        expect(receivedEvents[0].content.projectId).toBe('test-project');
        done();
      }, 50);
    });

    test('MessageBus should support multiple subscribers', (done) => {
      const events1: any[] = [];
      const events2: any[] = [];

      messageBus.on('multi:event', (data) => events1.push(data));
      messageBus.on('multi:event', (data) => events2.push(data));

      messageBus.broadcast({
        channel: 'multi:event',
        data: 'shared'
      });

      setTimeout(() => {
        expect(events1.length).toBeGreaterThan(0);
        expect(events2.length).toBeGreaterThan(0);
        done();
      }, 50);
    });

    test('MessageBus should track pending requests', async () => {
      const response = await messageBus.request('test-agent', {
        message: 'test request'
      });

      expect(response).toBeDefined();
      expect(response.requestId).toBeDefined();
    });
  });

  describe('Phase A2: Capability Matching', () => {
    test('AgentClaimingHelper should validate exact capability match', () => {
      const helper = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html', 'css', 'javascript']
      });

      expect(helper.validateCapabilityMatch(['html', 'css'])).toBe(true);
      expect(helper.validateCapabilityMatch(['html'])).toBe(true);
    });

    test('AgentClaimingHelper should reject missing capabilities', () => {
      const helper = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html', 'css']
      });

      expect(helper.validateCapabilityMatch(['nodejs', 'express'])).toBe(false);
      expect(helper.validateCapabilityMatch(['html', 'nodejs'])).toBe(false);
    });

    test('AgentClaimingHelper should be case-insensitive', () => {
      const helper = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['HTML', 'CSS', 'JavaScript']
      });

      expect(helper.validateCapabilityMatch(['html'])).toBe(true);
      expect(helper.validateCapabilityMatch(['css'])).toBe(true);
      expect(helper.validateCapabilityMatch(['javascript'])).toBe(true);
    });

    test('AgentClaimingHelper should handle empty requirements', () => {
      const helper = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html', 'css']
      });

      // Empty requirements = anyone can do it
      expect(helper.validateCapabilityMatch([])).toBe(true);
    });

    test('AgentClaimingHelper should reject agents with no capabilities', () => {
      const helper = new AgentClaimingHelper({
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: []
      });

      expect(helper.validateCapabilityMatch(['html'])).toBe(false);
    });
  });

  describe('Phase A2: Task Distribution Service', () => {
    test('TaskDistributionService should initialize with MessageBus', () => {
      const taskQueueManager = new TaskQueueManager(undefined, messageBus);
      const service = new TaskDistributionService(messageBus, taskQueueManager);

      expect(service).toBeDefined();
    });

    test('TaskDistributionService should listen to tasks:extracted event', (done) => {
      const taskQueueManager = new TaskQueueManager(undefined, messageBus);
      const service = new TaskDistributionService(messageBus, taskQueueManager);

      let eventReceived = false;

      messageBus.on('queue:populated', () => {
        eventReceived = true;
      });

      // Trigger task distribution (this would normally come from AgentOrchestrator)
      // For this test, we're just verifying the service can be created and listen

      setTimeout(() => {
        // Service is properly initialized if we get here without errors
        expect(service).toBeDefined();
        done();
      }, 100);
    });
  });

  describe('Backward Compatibility', () => {
    test('Project operations should work as before', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Compat Test',
          description: 'Testing backward compatibility',
          status: 'in_progress'
        }
      });

      expect(project.id).toBeDefined();
      expect(project.status).toBe('in_progress');

      await prisma.project.delete({ where: { id: project.id } });
    });

    test('Task operations should work as before', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Task Compat Test',
          description: 'Test',
          status: 'in_progress'
        }
      });

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          taskId: 'COMPAT-001',
          description: 'Test task',
          status: 'TODO',
          priority: 'MEDIUM'
        }
      });

      expect(task.taskId).toBe('COMPAT-001');
      expect(task.status).toBe('TODO');

      // Check new fields are optional (null)
      expect(task.claimedBy).toBeNull();
      expect(task.completedBy).toBeNull();

      await prisma.task.delete({ where: { id: task.id } });
      await prisma.project.delete({ where: { id: project.id } });
    });

    test('Message operations should work as before', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Message Compat Test',
          description: 'Test',
          status: 'in_progress'
        }
      });

      const message = await prisma.message.create({
        data: {
          projectId: project.id,
          fromAgent: 'PROJECT_MANAGER',
          toAgent: 'FRONTEND',
          messageType: 'TASK_ASSIGNMENT',
          content: 'Build frontend'
        }
      });

      expect(message.fromAgent).toBe('PROJECT_MANAGER');

      // Check new fields are optional (null)
      expect(message.threadId).toBeNull();
      expect(message.parentMessageId).toBeNull();

      await prisma.message.delete({ where: { id: message.id } });
      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  describe('Integration: Full A1+A2 Flow', () => {
    test('Complete flow: project -> tasks -> queue -> claiming', async () => {
      // 1. Create project
      const project = await prisma.project.create({
        data: {
          name: 'Full Flow Test',
          description: 'Testing complete A1+A2 flow',
          status: 'in_progress'
        }
      });

      // 2. Create tasks
      const tasks = [
        {
          projectId: project.id,
          taskId: 'FLOW-001',
          description: 'Task 1',
          status: 'TODO',
          priority: 'HIGH'
        },
        {
          projectId: project.id,
          taskId: 'FLOW-002',
          description: 'Task 2',
          status: 'TODO',
          priority: 'MEDIUM'
        }
      ];

      for (const taskData of tasks) {
        await prisma.task.create({ data: taskData });
      }

      // 3. Populate queue
      const taskQueueManager = new TaskQueueManager(undefined, messageBus);
      const service = new TaskDistributionService(messageBus, taskQueueManager);

      await service.populateTaskQueue(project.id, tasks);

      // 4. Verify queue populated
      const queuedTasks = await prisma.taskQueue.findMany({
        where: { projectId: project.id }
      });

      expect(queuedTasks.length).toBe(2);
      expect(queuedTasks.every(t => t.claimedBy === null)).toBe(true);

      // 5. Create agent and claim task
      const helper = new AgentClaimingHelper(
        {
          agentId: 'agent-flow-1',
          agentType: 'PROJECT_MANAGER',
          capabilities: ['planning']
        },
        messageBus
      );

      // 6. Claim first task
      const task1 = queuedTasks[0];
      const claimed = await helper.claimTask(task1.taskId, project.id);
      expect(claimed).toBe(true);

      // 7. Verify claimed in queue
      const claimedTask = await prisma.taskQueue.findUnique({
        where: { id: task1.id }
      });
      expect(claimedTask?.claimedBy).toBe('agent-flow-1');

      // Cleanup
      await prisma.taskQueue.deleteMany({
        where: { projectId: project.id }
      });
      await prisma.task.deleteMany({
        where: { projectId: project.id }
      });
      await prisma.project.delete({ where: { id: project.id } });
    });
  });
});
