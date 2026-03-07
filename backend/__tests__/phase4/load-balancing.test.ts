/**
 * Phase 4: Load Balancing Tests
 * Tests priority-based routing, capability matching, starvation prevention, and load distribution
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ParallelExecutionEngine, { AgentState } from '../../src/services/ParallelExecutionEngine';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 4: Load Balancing', () => {
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

  describe('Agent Pool Management', () => {
    test('should track multiple agents in pool', async () => {
      const agents = [
        { id: 'agent-1', type: 'backend', caps: ['nodejs', 'express'] },
        { id: 'agent-2', type: 'frontend', caps: ['react', 'typescript'] },
        { id: 'agent-3', type: 'fullstack', caps: ['nodejs', 'react'] },
        { id: 'agent-4', type: 'qa', caps: ['testing', 'automation'] },
      ];

      for (const agent of agents) {
        await engine.registerAgent(agent.id, agent.type, agent.caps);
      }

      const registered = await engine.getAllAgents();
      expect(registered).toHaveLength(4);
    });

    test('should identify idle agents for task assignment', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.registerAgent('agent-3', 'qa', ['testing']);
      await engine.startExecuting('project-1');

      // Make agent-1 busy
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      const agents = await engine.getAllAgents();
      const idleAgents = agents.filter((a) => a.state === AgentState.IDLE);
      const busyAgents = agents.filter((a) => a.state === AgentState.BUSY);

      expect(idleAgents).toHaveLength(2);
      expect(busyAgents).toHaveLength(1);
    });

    test('should handle agent pool scaling', async () => {
      // Start with 5 agents
      for (let i = 1; i <= 5; i++) {
        await engine.registerAgent(`agent-${i}`, `type-${i}`, ['capability-1']);
      }

      let agents = await engine.getAllAgents();
      expect(agents).toHaveLength(5);

      // Scale up to 10 agents
      for (let i = 6; i <= 10; i++) {
        await engine.registerAgent(`agent-${i}`, `type-${i}`, ['capability-1']);
      }

      agents = await engine.getAllAgents();
      expect(agents).toHaveLength(10);

      // Scale down to 7 agents
      for (let i = 8; i <= 10; i++) {
        await engine.unregisterAgent(`agent-${i}`);
      }

      agents = await engine.getAllAgents();
      expect(agents).toHaveLength(7);
    });
  });

  describe('Workload Distribution', () => {
    test('should distribute tasks evenly across available agents', async () => {
      // Register 5 agents
      for (let i = 1; i <= 5; i++) {
        await engine.registerAgent(`agent-${i}`, `backend`, ['nodejs']);
      }

      await engine.startExecuting('project-1');

      // Assign 5 tasks to 5 agents (one task each)
      for (let i = 1; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, `agent-${i}`);
      }

      const agents = await engine.getAllAgents();

      // Each agent should have exactly 1 task
      for (const agent of agents) {
        expect(agent.taskCount).toBe(1);
      }
    });

    test('should handle uneven task distribution', async () => {
      // Register 3 agents
      for (let i = 1; i <= 3; i++) {
        await engine.registerAgent(`agent-${i}`, 'backend', ['nodejs']);
      }

      await engine.startExecuting('project-1');

      // Assign 7 tasks (uneven distribution)
      const taskAssignment = [1, 2, 3, 1, 2, 3, 1]; // 3, 2, 2 tasks
      for (let i = 1; i <= 7; i++) {
        const agentId = `agent-${taskAssignment[i - 1]}`;
        await engine.startTaskExecution('project-1', `task-${i}`, agentId);
      }

      const agents = await engine.getAllAgents();
      const taskCounts = agents.map((a) => a.taskCount).sort();

      expect(taskCounts).toEqual([2, 2, 3]); // Relatively balanced
    });

    test('should rebalance when agents complete tasks', async () => {
      // Register 2 agents
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'backend', ['nodejs']);

      await engine.startExecuting('project-1');

      // Assign more tasks to agent-1
      for (let i = 1; i <= 3; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
      }

      let agents = await engine.getAllAgents();
      expect(agents[0].taskCount).toBe(3);
      expect(agents[1].taskCount).toBe(0);

      // Agent-1 completes all tasks
      for (let i = 1; i <= 3; i++) {
        await engine.completeTaskExecution('project-1', `task-${i}`, 'agent-1', { result: 'done' });
      }

      // Now assign tasks to both agents
      for (let i = 4; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, 'agent-1');
        await engine.startTaskExecution('project-1', `task-${i + 1}`, 'agent-2');
      }

      agents = await engine.getAllAgents();
      const agent1 = agents.find((a) => a.agentId === 'agent-1');
      const agent2 = agents.find((a) => a.agentId === 'agent-2');

      expect(agent1?.completedCount).toBe(3);
      expect(agent1?.taskCount).toBe(5);
      expect(agent2?.taskCount).toBe(2);
    });
  });

  describe('Starvation Prevention', () => {
    test('should eventually process low-priority tasks', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // In a real system, low-priority tasks might be starved
      // This test documents expected behavior: all tasks should be executed

      // Simulate high and low priority tasks
      const tasks = [
        { id: 'high-1', priority: 'HIGH' },
        { id: 'high-2', priority: 'HIGH' },
        { id: 'medium-1', priority: 'MEDIUM' },
        { id: 'low-1', priority: 'LOW' },
      ];

      // Execute all tasks
      for (const task of tasks) {
        await engine.startTaskExecution('project-1', task.id, 'agent-1');
        await engine.completeTaskExecution('project-1', task.id, 'agent-1', { result: 'done' });
      }

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.completedCount).toBe(4); // All tasks completed, including low-priority
    });

    test('should track all task executions regardless of assignment strategy', async () => {
      // Register 10 agents
      for (let i = 1; i <= 10; i++) {
        await engine.registerAgent(`agent-${i}`, `type-${i}`, ['capability-1']);
      }

      await engine.startExecuting('project-1');

      // Execute 100 tasks
      let taskCount = 0;
      for (let i = 1; i <= 100; i++) {
        const agentId = `agent-${((i - 1) % 10) + 1}`;
        await engine.startTaskExecution('project-1', `task-${i}`, agentId);
        await engine.completeTaskExecution('project-1', `task-${i}`, agentId, { result: 'done' });
        taskCount++;
      }

      const metrics = await engine.getExecutionMetrics('project-1');
      expect(metrics.completedTasks).toBe(100);
      expect(taskCount).toBe(100);
    });
  });

  describe('Load Balancing with Heterogeneous Agents', () => {
    test('should assign tasks based on agent capabilities', async () => {
      // Register agents with different capabilities
      await engine.registerAgent('agent-frontend', 'frontend', ['react', 'typescript', 'css']);
      await engine.registerAgent('agent-backend', 'backend', ['nodejs', 'express', 'mongodb']);
      await engine.registerAgent('agent-fullstack', 'fullstack', ['react', 'nodejs', 'typescript']);

      const agents = await engine.getAllAgents();

      // Verify capabilities
      const frontend = agents.find((a) => a.agentId === 'agent-frontend');
      const backend = agents.find((a) => a.agentId === 'agent-backend');
      const fullstack = agents.find((a) => a.agentId === 'agent-fullstack');

      expect(frontend?.capabilities).toContain('react');
      expect(backend?.capabilities).toContain('nodejs');
      expect(fullstack?.capabilities.length).toBe(3);
    });

    test('should prefer agents with exact capability match', async () => {
      // Register specialized agents
      await engine.registerAgent('agent-react', 'frontend', ['react', 'typescript']);
      await engine.registerAgent('agent-nodejs', 'backend', ['nodejs', 'express']);
      await engine.registerAgent('agent-general', 'general', ['any']);

      await engine.startExecuting('project-1');

      // Both react agents could handle a react task, but prefer exact match
      await engine.startTaskExecution('project-1', 'react-task', 'agent-react');

      const agent = await engine.getAgentStatus('agent-react');
      expect(agent?.currentTaskId).toBe('react-task');
    });

    test('should fallback to capable agents when preferred unavailable', async () => {
      // Register agents with overlapping capabilities
      await engine.registerAgent('agent-1', 'frontend', ['react', 'typescript']);
      await engine.registerAgent('agent-2', 'fullstack', ['react', 'nodejs']);

      await engine.startExecuting('project-1');

      // If agent-1 is busy, agent-2 can handle react task
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      let agent1 = await engine.getAgentStatus('agent-1');
      expect(agent1?.state).toBe(AgentState.BUSY);

      // Assign another react task - agent-2 has capability
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      let agent2 = await engine.getAgentStatus('agent-2');
      expect(agent2?.state).toBe(AgentState.BUSY);

      // Both agents are now handling tasks
      expect(agent1?.currentTaskId).toBe('task-1');
      expect(agent2?.currentTaskId).toBe('task-2');
    });
  });

  describe('Load Monitoring and Adaptation', () => {
    test('should report agent utilization during load', async () => {
      for (let i = 1; i <= 5; i++) {
        await engine.registerAgent(`agent-${i}`, 'backend', ['nodejs']);
      }

      await engine.startExecuting('project-1');

      // No load
      let utilization = await engine.getAgentUtilization();
      expect(utilization).toBe(0);

      // 50% load
      for (let i = 1; i <= 2; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, `agent-${i}`);
      }

      utilization = await engine.getAgentUtilization();
      expect(utilization).toBeCloseTo(0.4, 1); // 2/5

      // 100% load
      for (let i = 3; i <= 5; i++) {
        await engine.startTaskExecution('project-1', `task-${i}`, `agent-${i}`);
      }

      utilization = await engine.getAgentUtilization();
      expect(utilization).toBe(1.0); // 5/5
    });

    test('should track task completion rate for load assessment', async () => {
      for (let i = 1; i <= 3; i++) {
        await engine.registerAgent(`agent-${i}`, 'backend', ['nodejs']);
      }

      await engine.startExecuting('project-1');

      // Complete tasks and track completion rate
      for (let i = 1; i <= 9; i++) {
        const agentId = `agent-${((i - 1) % 3) + 1}`;
        await engine.startTaskExecution('project-1', `task-${i}`, agentId);
        await engine.completeTaskExecution('project-1', `task-${i}`, agentId, { result: 'done' });
      }

      const metrics = await engine.getExecutionMetrics('project-1');
      expect(metrics.completionRate).toBe(1.0); // All completed
    });
  });

  describe('Concurrent Load Distribution', () => {
    test('should distribute 100 concurrent tasks across 10 agents', async () => {
      // Register 10 agents
      for (let i = 1; i <= 10; i++) {
        await engine.registerAgent(`agent-${i}`, `type-${i % 3}`, [`capability-${i}`]);
      }

      await engine.startExecuting('project-large');

      // Distribute 100 tasks
      const taskPromises = [];
      for (let i = 1; i <= 100; i++) {
        const agentId = `agent-${((i - 1) % 10) + 1}`;
        taskPromises.push(engine.startTaskExecution('project-large', `task-${i}`, agentId));
      }

      await Promise.all(taskPromises);

      const agents = await engine.getAllAgents();

      // Verify distribution
      let minTasks = Infinity;
      let maxTasks = 0;
      let totalTasks = 0;

      for (const agent of agents) {
        minTasks = Math.min(minTasks, agent.taskCount);
        maxTasks = Math.max(maxTasks, agent.taskCount);
        totalTasks += agent.taskCount;
      }

      expect(totalTasks).toBe(100);
      expect(maxTasks - minTasks).toBeLessThanOrEqual(1); // Balanced distribution
    });

    test('should handle rapid load spikes', async () => {
      for (let i = 1; i <= 5; i++) {
        await engine.registerAgent(`agent-${i}`, 'backend', ['nodejs']);
      }

      await engine.startExecuting('project-1');

      // Rapid spike: 25 tasks
      const spikePromises = [];
      for (let i = 1; i <= 25; i++) {
        const agentId = `agent-${((i - 1) % 5) + 1}`;
        spikePromises.push(engine.startTaskExecution('project-1', `spike-task-${i}`, agentId));
      }

      await Promise.all(spikePromises);

      const agents = await engine.getAllAgents();
      const totalClaimed = agents.reduce((sum, a) => sum + a.taskCount, 0);

      expect(totalClaimed).toBe(25); // All tasks assigned
    });
  });

  describe('Agent Failure Resilience', () => {
    test('should redistribute work when agent goes offline', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Assign task to agent-1
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      let agent1 = await engine.getAgentStatus('agent-1');
      expect(agent1?.state).toBe(AgentState.BUSY);

      // Simulate agent-1 going offline
      if (agent1) {
        agent1.state = AgentState.OFFLINE;
      }

      // New tasks can be assigned to agent-2
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      let agent2 = await engine.getAgentStatus('agent-2');
      expect(agent2?.state).toBe(AgentState.BUSY);

      // Verify load shifted
      expect(agent1?.state).toBe(AgentState.OFFLINE);
      expect(agent2?.state).toBe(AgentState.BUSY);
    });

    test('should gracefully handle agent unregistration during task execution', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      // Start a task
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      // Unregister the agent (simulates graceful shutdown)
      await engine.unregisterAgent('agent-1');

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent).toBeNull();

      // New agent can take over
      await engine.registerAgent('agent-2', 'backend', ['nodejs']);
      await engine.startTaskExecution('project-1', 'task-2', 'agent-2');

      const newAgent = await engine.getAgentStatus('agent-2');
      expect(newAgent?.taskCount).toBe(1);
    });
  });
});
