/**
 * Phase A3 Parallel Execution Test Suite
 * Tests autonomous parallel agent execution with task queue
 * Covers: TaskStateMachine, TaskDistributionService, ParallelExecutionEngine, ExecutionMonitoringService
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskStateMachine, TaskState } from '../src/services/TaskStateMachine';
import { ExecutionMonitoringService, ExecutionHealthMetrics } from '../src/services/ExecutionMonitoringService';
import { MessageBus } from '../src/services/MessageBus';
import { ParallelExecutionEngine } from '../src/services/ParallelExecutionEngine';
import { TaskDistributionService } from '../src/services/TaskDistributionService';

// Test utilities
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Phase A3: Parallel Execution', () => {
  // ============================================
  // TaskStateMachine Tests
  // ============================================
  describe('TaskStateMachine', () => {
    let stateMachine: TaskStateMachine;

    beforeEach(() => {
      stateMachine = new TaskStateMachine();
    });

    afterEach(() => {
      stateMachine.reset();
    });

    it('should initialize task in TODO state', () => {
      const result = stateMachine.initializeTask('task-1', 'project-1');
      expect(result).toBe(true);
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.TODO);
    });

    it('should transition from TODO to CLAIMED', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      const result = stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED, 'agent-1');
      expect(result).toBe(true);
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.CLAIMED);
    });

    it('should transition from CLAIMED to IN_PROGRESS', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED, 'agent-1');
      const result = stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS, 'agent-1');
      expect(result).toBe(true);
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.IN_PROGRESS);
    });

    it('should transition from IN_PROGRESS to COMPLETE', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS);
      const result = stateMachine.transitionTask('task-1', 'project-1', TaskState.COMPLETE);
      expect(result).toBe(true);
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.COMPLETE);
    });

    it('should reject invalid transitions', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      // Invalid: TODO -> IN_PROGRESS (must go through CLAIMED first)
      const result = stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS);
      expect(result).toBe(false);
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.TODO);
    });

    it('should handle task retry after failure', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.FAILED);
      const result = stateMachine.transitionTask('task-1', 'project-1', TaskState.RETRYING);
      expect(result).toBe(true);
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.RETRYING);
    });

    it('should return valid next states', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      const validStates = stateMachine.getValidNextStates('task-1');
      expect(validStates).toContain(TaskState.CLAIMED);
      expect(validStates).not.toContain(TaskState.COMPLETE);
    });

    it('should track state history', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED, 'agent-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS, 'agent-1');

      const history = stateMachine.getTaskHistory('task-1');
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].currentState).toBe(TaskState.IN_PROGRESS);
    });

    it('should track tasks by state', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.initializeTask('task-2', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);

      const todoTasks = stateMachine.getTasksByState(TaskState.TODO);
      const claimedTasks = stateMachine.getTasksByState(TaskState.CLAIMED);

      expect(todoTasks).toContain('task-2');
      expect(claimedTasks).toContain('task-1');
    });

    it('should report state statistics', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.initializeTask('task-2', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);

      const stats = stateMachine.getStateStatistics();
      expect(stats[TaskState.TODO]).toBe(1);
      expect(stats[TaskState.CLAIMED]).toBe(1);
    });

    it('should identify terminal states', () => {
      stateMachine.initializeTask('task-1', 'project-1');
      expect(stateMachine.isTerminalState('task-1')).toBe(false);

      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.COMPLETE);

      expect(stateMachine.isTerminalState('task-1')).toBe(true);
    });

    it('should support state change listeners', (done) => {
      let eventCount = 0;
      const unsubscribe = stateMachine.onStateChange((event) => {
        eventCount++;
        if (eventCount === 1) {
          expect(event.currentState).toBe(TaskState.CLAIMED);
          unsubscribe();
          done();
        }
      });

      stateMachine.initializeTask('task-1', 'project-1');
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);
    });
  });

  // ============================================
  // ExecutionMonitoringService Tests
  // ============================================
  describe('ExecutionMonitoringService', () => {
    let messageBus: MessageBus;
    let monitoringService: ExecutionMonitoringService;

    beforeEach(() => {
      messageBus = new MessageBus();
      monitoringService = new ExecutionMonitoringService(messageBus);
    });

    afterEach(() => {
      monitoringService.reset();
    });

    it('should initialize with default config', () => {
      const metrics = monitoringService.getHealthMetrics();
      expect(metrics.totalTasksMonitored).toBe(0);
      expect(metrics.healthyAgents).toBe(0);
    });

    it('should track task timeouts', (done) => {
      monitoringService.startMonitoring();

      messageBus.emit('task:started', {
        taskId: 'task-1',
        projectId: 'project-1',
        agentId: 'agent-1'
      });

      setTimeout(() => {
        const tasks = monitoringService.getMonitoredTasks();
        expect(tasks.length).toBeGreaterThan(0);
        expect(tasks[0].taskId).toBe('task-1');

        monitoringService.stopMonitoring();
        done();
      }, 100);
    });

    it('should track agent heartbeats', (done) => {
      messageBus.emit('agent:registered', {
        agentId: 'agent-1',
        agentType: 'FRONTEND'
      });

      setTimeout(() => {
        const status = monitoringService.getAgentHealthStatus();
        expect(status.length).toBeGreaterThan(0);
        expect(status[0].agentId).toBe('agent-1');
        expect(status[0].isHealthy).toBe(true);
        done();
      }, 100);
    });

    it('should emit timeout warnings', (done) => {
      monitoringService.setTaskTimeoutConfig({
        defaultTimeoutMs: 100,
        warningThresholdMs: 0.5
      });

      let warningEmitted = false;
      messageBus.on('task:timeout:warning', () => {
        warningEmitted = true;
      });

      monitoringService.startMonitoring();

      messageBus.emit('task:started', {
        taskId: 'task-1',
        projectId: 'project-1',
        agentId: 'agent-1'
      });

      setTimeout(() => {
        expect(warningEmitted).toBe(true);
        monitoringService.stopMonitoring();
        done();
      }, 100);
    });

    it('should update agent heartbeat status', (done) => {
      messageBus.emit('agent:registered', { agentId: 'agent-1' });

      messageBus.emit('agent:heartbeat', { agentId: 'agent-1' });

      setTimeout(() => {
        const status = monitoringService.getAgentHealthStatus();
        expect(status[0].missedBeats).toBe(0);
        done();
      }, 50);
    });
  });

  // ============================================
  // ParallelExecutionEngine Tests
  // ============================================
  describe('ParallelExecutionEngine', () => {
    let messageBus: MessageBus;
    let engine: ParallelExecutionEngine;

    beforeEach(() => {
      messageBus = new MessageBus();
      engine = new ParallelExecutionEngine(messageBus, {
        getTask: async () => null,
        updateTask: async () => {},
        saveTask: async () => {}
      } as any);
    });

    afterEach(() => {
      engine.reset();
    });

    it('should register agents', async () => {
      await engine.registerAgent('agent-1', 'FRONTEND', ['html', 'css', 'javascript']);

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent).toBeDefined();
      expect(agent?.agentType).toBe('FRONTEND');
      expect(agent?.capabilities).toContain('html');
    });

    it('should unregister agents', async () => {
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);
      await engine.unregisterAgent('agent-1');

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent).toBeNull();
    });

    it('should start and stop execution', async () => {
      await engine.startExecuting('project-1');
      let progress = await engine.getProjectProgress('project-1');
      expect(progress.executing).toBe(true);

      await engine.stopExecuting('project-1');
      progress = await engine.getProjectProgress('project-1');
      expect(progress.executing).toBe(false);
    });

    it('should pause and resume execution', async () => {
      await engine.startExecuting('project-1');
      await engine.pauseExecution('project-1');

      let progress = await engine.getProjectProgress('project-1');
      expect(progress.paused).toBe(true);

      await engine.resumeExecution('project-1');
      progress = await engine.getProjectProgress('project-1');
      expect(progress.paused).toBe(false);
    });

    it('should track task execution lifecycle', async () => {
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      let progress = await engine.getProjectProgress('project-1');
      expect(progress.activeAgents).toBe(1);

      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', {});
      progress = await engine.getProjectProgress('project-1');
      expect(progress.activeAgents).toBe(0);
    });

    it('should get execution metrics', async () => {
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', {});

      const metrics = await engine.getExecutionMetrics('project-1');
      expect(metrics.totalTasks).toBeGreaterThan(0);
      expect(metrics.completedTasks).toBe(1);
    });

    it('should get agent performance stats', async () => {
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', {});

      const stats = await engine.getAgentPerformanceStats('agent-1');
      expect(stats.agentId).toBe('agent-1');
      expect(stats.tasksCompleted).toBe(1);
      expect(stats.completionRate).toBe(1);
    });

    it('should get overall agent utilization', async () => {
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);
      await engine.registerAgent('agent-2', 'BACKEND', ['nodejs']);

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      const utilization = await engine.getAgentUtilization();
      expect(utilization).toBeGreaterThan(0);
      expect(utilization).toBeLessThanOrEqual(1);
    });
  });

  // ============================================
  // TaskDistributionService Tests
  // ============================================
  describe('TaskDistributionService', () => {
    let messageBus: MessageBus;
    let distributionService: TaskDistributionService;

    beforeEach(() => {
      messageBus = new MessageBus();
      distributionService = new TaskDistributionService(messageBus, {} as any);
    });

    afterEach(() => {
      distributionService.reset();
    });

    it('should register agents', () => {
      // Simulate agent registration via MessageBus
      messageBus.emit('agent:registered', {
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html', 'css']
      });

      const agents = distributionService.getRegisteredAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].agentId).toBe('agent-1');
    });

    it('should get agent status', () => {
      messageBus.emit('agent:registered', {
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html']
      });

      const status = distributionService.getAgentStatus('agent-1');
      expect(status).toBeDefined();
      expect(status?.isOnline).toBe(true);
      expect(status?.isBusy).toBe(false);
    });

    it('should track agent availability', () => {
      messageBus.emit('agent:registered', {
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html']
      });

      messageBus.emit('agent:heartbeat', {
        agentId: 'agent-1',
        state: 'busy'
      });

      const status = distributionService.getAgentStatus('agent-1');
      expect(status?.isBusy).toBe(true);
    });

    it('should set max concurrent tasks per agent', () => {
      distributionService.setMaxConcurrentTasksPerAgent(5);

      messageBus.emit('agent:registered', {
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html']
      });

      const status = distributionService.getAgentStatus('agent-1');
      expect(status?.maxConcurrentTasks).toBe(5);
    });

    it('should unregister agents', () => {
      messageBus.emit('agent:registered', {
        agentId: 'agent-1',
        agentType: 'FRONTEND',
        capabilities: ['html']
      });

      distributionService.unregisterAgent('agent-1');

      const status = distributionService.getAgentStatus('agent-1');
      expect(status).toBeNull();
    });

    it('should provide distribution metrics', () => {
      const metrics = distributionService.getDistributionMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.tasksDistributed).toBeGreaterThanOrEqual(0);
      expect(metrics.agentAvailability).toBeDefined();
      expect(Array.isArray(metrics.agentAvailability)).toBe(true);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('Integration: Task State Machine + Execution Engine', () => {
    let stateMachine: TaskStateMachine;
    let messageBus: MessageBus;
    let engine: ParallelExecutionEngine;

    beforeEach(() => {
      stateMachine = new TaskStateMachine();
      messageBus = new MessageBus();
      engine = new ParallelExecutionEngine(messageBus, {
        getTask: async () => null,
        updateTask: async () => {},
        saveTask: async () => {}
      } as any);
    });

    it('should execute complete task lifecycle', async () => {
      // Initialize task
      stateMachine.initializeTask('task-1', 'project-1');
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.TODO);

      // Register agent
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);
      expect((await engine.getAgentStatus('agent-1'))).toBeDefined();

      // Agent claims task
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED, 'agent-1');
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.CLAIMED);

      // Start execution
      await engine.startExecuting('project-1');
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS, 'agent-1');
      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.IN_PROGRESS);

      // Complete task
      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', {});
      stateMachine.transitionTask('task-1', 'project-1', TaskState.COMPLETE);

      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.COMPLETE);
      expect(stateMachine.isTerminalState('task-1')).toBe(true);
    });

    it('should handle task retry on failure', async () => {
      stateMachine.initializeTask('task-1', 'project-1');
      await engine.registerAgent('agent-1', 'FRONTEND', ['html']);

      // Task fails
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.IN_PROGRESS);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.FAILED);

      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.FAILED);

      // Retry
      stateMachine.transitionTask('task-1', 'project-1', TaskState.RETRYING);
      stateMachine.transitionTask('task-1', 'project-1', TaskState.CLAIMED);

      expect(stateMachine.getTaskState('task-1')).toBe(TaskState.CLAIMED);
    });
  });
});
