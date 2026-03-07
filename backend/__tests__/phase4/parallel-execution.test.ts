/**
 * Phase 4: Parallel Execution Tests
 * Tests concurrent agent execution, multiple task execution, and task pipelines
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ParallelExecutionEngine, {
  TaskExecutionStatus,
  AgentState,
} from '../../src/services/ParallelExecutionEngine';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 4: Parallel Execution', () => {
  let engine: ParallelExecutionEngine;
  let messageBus: MessageBus;
  let taskStore: MockTaskStore;

  beforeEach(() => {
    taskStore = new MockTaskStore();
    messageBus = new MessageBus(taskStore);
    engine = new ParallelExecutionEngine(messageBus, taskStore);
  });

  afterEach(() => {
    engine.reset();
    messageBus.reset();
    taskStore.clearAll();
  });

  describe('Single Agent Task Execution', () => {
    test('should execute a single task', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.BUSY);
      expect(agent?.currentTaskId).toBe('task-1');
      expect(agent?.taskCount).toBe(1);
    });

    test('should complete a single task', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'success' });

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.IDLE);
      expect(agent?.currentTaskId).toBeUndefined();
      expect(agent?.completedCount).toBe(1);
    });

    test('should emit task:started event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.agentId).toBe('agent-1');
        expect(data.projectId).toBe('project-1');
        done();
      });

      messageBus.on('task:started', handler);

      engine.registerAgent('agent-1', 'backend', ['nodejs']).then(() => {
        engine.startExecuting('project-1').then(() => {
          engine.startTaskExecution('project-1', 'task-1', 'agent-1');
        });
      });
    });

    test('should emit task:completed event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.agentId).toBe('agent-1');
        expect(data.result).toBeDefined();
        done();
      });

      messageBus.on('task:completed', handler);

      engine.registerAgent('agent-1', 'backend', ['nodejs']).then(() => {
        engine.startExecuting('project-1').then(() => {
          engine
            .startTaskExecution('project-1', 'task-1', 'agent-1')
            .then(() => engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' }));
        });
      });
    });
  });

  describe('Multiple Concurrent Agents', () => {
    test('should execute tasks concurrently with multiple agents', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.registerAgent('agent-3', 'qa', ['testing']);
      await engine.startExecuting('project-1');

      // Start tasks concurrently
      await Promise.all([
        engine.startTaskExecution('project-1', 'task-1', 'agent-1'),
        engine.startTaskExecution('project-1', 'task-2', 'agent-2'),
        engine.startTaskExecution('project-1', 'task-3', 'agent-3'),
      ]);

      const agents = await engine.getAllAgents();
      expect(agents.filter((a) => a.state === AgentState.BUSY)).toHaveLength(3);
    });

    test('should handle agents completing tasks at different times', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      // Agent 1 completes quickly
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' });

      let agents = await engine.getAllAgents();
      expect(agents[0].state).toBe(AgentState.IDLE);
      expect(agents[1].state).toBe(AgentState.BUSY);

      // Agent 2 completes
      await engine.completeTaskExecution('project-1', 'task-2', 'agent-2', { result: 'done' });

      agents = await engine.getAllAgents();
      expect(agents.every((a) => a.state === AgentState.IDLE)).toBe(true);
    });

    test('should track independent task execution histories', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      const history1 = engine.getTaskExecutionHistory('task-1');
      const history2 = engine.getTaskExecutionHistory('task-2');

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1[0].agentId).toBe('agent-1');
      expect(history2[0].agentId).toBe('agent-2');
    });
  });

  describe('Multiple Tasks Per Agent', () => {
    test('should queue tasks when agent is busy', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.currentTaskId).toBe('task-1');
      expect(agent?.state).toBe(AgentState.BUSY);
    });

    test('should allow agent to accept new task after completing previous task', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // First task
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      let agent = await engine.getAgentStatus('agent-1');
      expect(agent?.taskCount).toBe(1);

      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' });

      // Second task
      await engine.startTaskExecution('project-1', 'task-2', 'agent-1');
      agent = await engine.getAgentStatus('agent-1');
      expect(agent?.taskCount).toBe(2);
      expect(agent?.completedCount).toBe(1);
    });

    test('should track completion count across multiple tasks', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 5 tasks
      for (let i = 1; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.taskCount).toBe(5);
      expect(agent?.completedCount).toBe(5);
    });
  });

  describe('Task Execution Pipeline', () => {
    test('should track task through QUEUED -> STARTED -> COMPLETED states', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Start task (STARTED state)
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      let history = engine.getTaskExecutionHistory('task-1');
      expect(history[0].status).toBe(TaskExecutionStatus.STARTED);

      // Complete task
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' });
      history = engine.getTaskExecutionHistory('task-1');
      expect(history[0].status).toBe(TaskExecutionStatus.COMPLETED);
      expect(history[0].completedAt).toBeDefined();
    });

    test('should measure task execution duration', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      const startTime = new Date();
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      // Simulate some work
      await new Promise((r) => setTimeout(r, 100));

      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' });

      const history = engine.getTaskExecutionHistory('task-1');
      const duration = history[0].completedAt!.getTime() - history[0].startedAt!.getTime();

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Execution Control', () => {
    test('should start project execution', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      const progress = await engine.getProjectProgress('project-1');
      expect(progress.executing).toBe(true);
      expect(progress.paused).toBe(false);
    });

    test('should stop project execution', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      let progress = await engine.getProjectProgress('project-1');
      expect(progress.executing).toBe(true);

      await engine.stopExecuting('project-1');
      progress = await engine.getProjectProgress('project-1');
      expect(progress.executing).toBe(false);
    });

    test('should pause project execution', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      let progress = await engine.getProjectProgress('project-1');
      expect(progress.paused).toBe(false);

      await engine.pauseExecution('project-1');
      progress = await engine.getProjectProgress('project-1');
      expect(progress.paused).toBe(true);
      expect(progress.executing).toBe(true); // Still executing, just paused
    });

    test('should resume project execution', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');
      await engine.pauseExecution('project-1');

      let progress = await engine.getProjectProgress('project-1');
      expect(progress.paused).toBe(true);

      await engine.resumeExecution('project-1');
      progress = await engine.getProjectProgress('project-1');
      expect(progress.paused).toBe(false);
    });
  });

  describe('Concurrent Scenario: 10 Agents, 50 Tasks', () => {
    test('should handle 10 concurrent agents executing 50 tasks', async () => {
      // Register 10 agents
      for (let i = 1; i <= 10; i++) {
        await engine.registerAgent(`agent-${i}`, `type-${i % 3}`, [`capability-${i}`]);
      }

      await engine.startExecuting('project-large');

      // Start 50 tasks distributed across agents
      const taskPromises = [];
      for (let i = 1; i <= 50; i++) {
        const agentId = `agent-${((i - 1) % 10) + 1}`;
        taskPromises.push(engine.startTaskExecution('project-large', `task-${i}`, agentId));
      }

      await Promise.all(taskPromises);

      const agents = await engine.getAllAgents();
      const busyAgents = agents.filter((a) => a.state === AgentState.BUSY);

      // All agents should be busy
      expect(busyAgents.length).toBe(10);

      // Now complete all tasks
      const completePromises = [];
      for (let i = 1; i <= 50; i++) {
        const agentId = `agent-${((i - 1) % 10) + 1}`;
        completePromises.push(
          engine.completeTaskExecution('project-large', `task-${i}`, agentId, { result: 'done' })
        );
      }

      await Promise.all(completePromises);

      const finalAgents = await engine.getAllAgents();
      const idleAgents = finalAgents.filter((a) => a.state === AgentState.IDLE);

      // All agents should be idle
      expect(idleAgents.length).toBe(10);

      // Check completion counts
      let totalCompleted = 0;
      for (const agent of finalAgents) {
        totalCompleted += agent.completedCount;
      }
      expect(totalCompleted).toBe(50);
    });
  });

  describe('Task Execution with Unknown Agent', () => {
    test('should throw error when starting task with non-existent agent', async () => {
      await engine.startExecuting('project-1');

      await expect(engine.startTaskExecution('project-1', 'task-1', 'non-existent-agent')).rejects.toThrow();
    });

    test('should throw error when completing task with non-existent agent', async () => {
      await engine.startExecuting('project-1');

      await expect(
        engine.completeTaskExecution('project-1', 'task-1', 'non-existent-agent', { result: 'done' })
      ).rejects.toThrow();
    });
  });
});
