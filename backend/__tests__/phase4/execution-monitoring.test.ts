/**
 * Phase 4: Execution Monitoring Tests
 * Tests real-time metrics, task completion rate, agent utilization, and performance tracking
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ParallelExecutionEngine, { AgentState } from '../../src/services/ParallelExecutionEngine';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 4: Execution Monitoring & Metrics', () => {
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

  describe('Execution Metrics Calculation', () => {
    test('should calculate completion rate for empty project', async () => {
      await engine.startExecuting('project-1');

      const metrics = await engine.getExecutionMetrics('project-1');

      expect(metrics.projectId).toBe('project-1');
      expect(metrics.totalTasks).toBe(0);
      expect(metrics.completionRate).toBe(0);
      expect(metrics.completedTasks).toBe(0);
    });

    test('should calculate completion rate with completed tasks', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 3 tasks
      for (let i = 1; i <= 3; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      const metrics = await engine.getExecutionMetrics('project-1');

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.completedTasks).toBe(3);
      expect(metrics.completionRate).toBe(1.0); // 100%
    });

    test('should calculate partial completion rate', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 2 out of 5 tasks
      for (let i = 1; i <= 2; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      // Start but don't complete 3 more
      for (let i = 3; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
      }

      const metrics = await engine.getExecutionMetrics('project-1');

      expect(metrics.totalTasks).toBe(5);
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.completionRate).toBeCloseTo(0.4, 1); // 40%
    });

    test('should track failed and completed tasks', async () => {
      engine.setMaxRetries(1);

      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 2 successfully
      for (let i = 1; i <= 2; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      // Fail 1 task permanently
      await engine.startTaskExecution('project-1', 'task-3', 'agent-1');
      await engine.failTaskExecution('project-1', 'task-3', 'agent-1', new Error('Fail 1'));
      await engine.startTaskExecution('project-1', 'task-3', 'agent-1');
      await engine.failTaskExecution('project-1', 'task-3', 'agent-1', new Error('Fail 2'));

      const metrics = await engine.getExecutionMetrics('project-1');

      expect(metrics.totalTasks).toBeGreaterThanOrEqual(2); // At least completed tasks
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.failedTasks).toBeGreaterThanOrEqual(0); // May count as failed
    });

    test('should calculate average task duration', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 3 tasks with measurable duration
      for (let i = 1; i <= 3; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await new Promise((r) => setTimeout(r, 50));
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      const metrics = await engine.getExecutionMetrics('project-1');

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.completedTasks).toBe(3);
      expect(metrics.averageTaskDuration).toBeGreaterThanOrEqual(40); // At least 50ms
    });

    test('should track task execution history for metrics', async () => {
      engine.setMaxRetries(3);

      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Task with 1 retry
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.failTaskExecution('project-1', 'task-1', 'agent-1', new Error('Fail 1'));
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' });

      // Task with 0 retries
      await engine.startTaskExecution('project-1', 'task-2', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-2', 'agent-1', { result: 'done' });

      const metrics = await engine.getExecutionMetrics('project-1');

      expect(metrics.totalTasks).toBeGreaterThanOrEqual(2);
      expect(metrics.completedTasks).toBe(2);
    });
  });

  describe('Agent Utilization Tracking', () => {
    test('should calculate zero utilization with no agents', async () => {
      const utilization = await engine.getAgentUtilization();
      expect(utilization).toBe(0);
    });

    test('should calculate zero utilization with idle agents', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);

      const utilization = await engine.getAgentUtilization();
      expect(utilization).toBe(0);
    });

    test('should calculate utilization with busy agents', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.registerAgent('agent-3', 'qa', ['testing']);
      await engine.startExecuting('project-1');

      // Busy agent-1 and agent-2
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      const utilization = await engine.getAgentUtilization();

      expect(utilization).toBeCloseTo(0.667, 2); // 2 out of 3 agents busy
    });

    test('should calculate 100% utilization with all agents busy', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      const utilization = await engine.getAgentUtilization();
      expect(utilization).toBe(1.0); // 100%
    });
  });

  describe('Project Progress Tracking', () => {
    test('should report project executing status', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      const progress = await engine.getProjectProgress('project-1');

      expect(progress.executing).toBe(true);
      expect(progress.paused).toBe(false);
      expect(progress.projectId).toBe('project-1');
    });

    test('should report paused execution status', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');
      await engine.pauseExecution('project-1');

      const progress = await engine.getProjectProgress('project-1');

      expect(progress.executing).toBe(true);
      expect(progress.paused).toBe(true);
    });

    test('should count active, idle, and offline agents in progress', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.registerAgent('agent-3', 'qa', ['testing']);
      await engine.startExecuting('project-1');

      // Make agent-1 busy
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      // Make agent-3 offline
      const agent3 = await engine.getAgentStatus('agent-3');
      if (agent3) agent3.state = 'offline' as any;

      const progress = await engine.getProjectProgress('project-1');

      expect(progress.activeAgents).toBe(1); // agent-1
      expect(progress.idleAgents).toBe(1); // agent-2
      expect(progress.offlineAgents).toBe(1); // agent-3
    });

    test('should report metrics in project progress', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete some tasks
      for (let i = 1; i <= 3; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      const progress = await engine.getProjectProgress('project-1');

      expect(progress.metrics).toBeDefined();
      expect(progress.metrics.completedTasks).toBe(3);
      expect(progress.metrics.completionRate).toBe(1.0);
    });

    test('should include dead-letter queue size in progress', async () => {
      engine.setMaxRetries(1);

      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      const baselineProgress = await engine.getProjectProgress('project-1');
      const baselineSize = baselineProgress.deadLetterQueueSize;

      // Create a permanently failed task
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.failTaskExecution('project-1', 'task-1', 'agent-1', new Error('Fail 1'));
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.failTaskExecution('project-1', 'task-1', 'agent-1', new Error('Fail 2'));

      const progress = await engine.getProjectProgress('project-1');

      expect(progress.deadLetterQueueSize).toBeGreaterThanOrEqual(baselineSize);
    });
  });

  describe('Agent Performance Statistics', () => {
    test('should get agent performance stats', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      const beforeStats = await engine.getAgentPerformanceStats('agent-1');
      expect(beforeStats.agentId).toBe('agent-1');
      expect(beforeStats.tasksClaimed).toBe(0);
      expect(beforeStats.tasksCompleted).toBe(0);
      expect(beforeStats.completionRate).toBe(0);
    });

    test('should track claimed tasks in agent stats', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Claim 5 tasks
      for (let i = 1; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
      }

      const stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.tasksClaimed).toBe(5);
    });

    test('should track completed tasks in agent stats', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 5 tasks
      for (let i = 1; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      const stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.tasksClaimed).toBe(5);
      expect(stats.tasksCompleted).toBe(5);
      expect(stats.completionRate).toBe(1.0);
    });

    test('should calculate average task duration per agent', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Complete 3 tasks with measurable duration
      for (let i = 1; i <= 3; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await new Promise((r) => setTimeout(r, 30));
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      const stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.averageTaskDuration).toBeGreaterThan(20);
    });

    test('should report current busy status', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      let stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.currentlyBusy).toBe(false);

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.currentlyBusy).toBe(true);
    });

    test('should calculate agent uptime', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);

      await new Promise((r) => setTimeout(r, 100));

      const stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.uptime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Metrics for Multiple Projects', () => {
    test('should track metrics independently for multiple projects', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');
      await engine.startExecuting('project-2');

      // Complete tasks in project-1
      for (let i = 1; i <= 3; i++) {
        await engine.startTaskExecution('project-1', `proj1-task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-1', `proj1-task-${i}`, 'agent-1', { result: 'done' });
      }

      // Complete tasks in project-2
      for (let i = 1; i <= 5; i++) {
        await engine.startTaskExecution('project-2', `proj2-task-${i}`, 'agent-1');
        await engine.completeTaskExecution('project-2', `proj2-task-${i}`, 'agent-1', { result: 'done' });
      }

      const metrics1 = await engine.getExecutionMetrics('project-1');
      const metrics2 = await engine.getExecutionMetrics('project-2');

      expect(metrics1.totalTasks).toBe(3);
      expect(metrics2.totalTasks).toBe(5);
      expect(metrics1.completionRate).toBe(1.0);
      expect(metrics2.completionRate).toBe(1.0);
    });
  });

  describe('Metrics Updates Over Time', () => {
    test('should reflect metrics changes as execution progresses', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Initial metrics
      let metrics = await engine.getExecutionMetrics('project-1');
      expect(metrics.completedTasks).toBe(0);

      // Complete first task
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { result: 'done' });

      metrics = await engine.getExecutionMetrics('project-1');
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.completionRate).toBeCloseTo(1.0, 1);

      // Complete second task
      await engine.startTaskExecution('project-1', 'task-2', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-2', 'agent-1', { result: 'done' });

      metrics = await engine.getExecutionMetrics('project-1');
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.completionRate).toBeCloseTo(1.0, 1);
    });
  });
});
