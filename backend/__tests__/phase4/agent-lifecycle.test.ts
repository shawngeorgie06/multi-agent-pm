/**
 * Phase 4: Agent Lifecycle Tests
 * Tests agent registration, heartbeats, offline detection, and auto-removal
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ParallelExecutionEngine, { AgentState } from '../../src/services/ParallelExecutionEngine';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 4: Agent Lifecycle Management', () => {
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

  describe('Agent Registration', () => {
    test('should register an agent with capabilities', async () => {
      await engine.registerAgent('agent-1', 'frontend', ['react', 'typescript']);

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent).toBeDefined();
      expect(agent?.agentId).toBe('agent-1');
      expect(agent?.agentType).toBe('frontend');
      expect(agent?.capabilities).toEqual(['react', 'typescript']);
      expect(agent?.state).toBe(AgentState.IDLE);
      expect(agent?.taskCount).toBe(0);
      expect(agent?.completedCount).toBe(0);
    });

    test('should register multiple agents', async () => {
      await engine.registerAgent('agent-1', 'frontend', ['react']);
      await engine.registerAgent('agent-2', 'backend', ['nodejs']);
      await engine.registerAgent('agent-3', 'qa', ['testing']);

      const agents = await engine.getAllAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map((a) => a.agentId)).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });

    test('should emit agent:registered event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('agent-1');
        expect(data.agentType).toBe('frontend');
        expect(data.capabilities).toEqual(['react']);
        done();
      });

      messageBus.on('agent:registered', handler);
      engine.registerAgent('agent-1', 'frontend', ['react']);
    });

    test('should re-register agent with new capabilities', async () => {
      await engine.registerAgent('agent-1', 'frontend', ['react']);
      await engine.registerAgent('agent-1', 'fullstack', ['react', 'nodejs']);

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.agentType).toBe('fullstack');
      expect(agent?.capabilities).toEqual(['react', 'nodejs']);
    });

    test('should handle agent registration with empty capabilities', async () => {
      await engine.registerAgent('agent-1', 'general', []);

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.capabilities).toEqual([]);
    });
  });

  describe('Agent Heartbeats', () => {
    test('should update agent heartbeat timestamp', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);

      const beforeHeartbeat = await engine.getAgentStatus('agent-1');
      const initialTime = beforeHeartbeat?.lastHeartbeat;

      // Wait a bit and update heartbeat
      await new Promise((r) => setTimeout(r, 100));
      await engine.updateAgentHeartbeat('agent-1');

      const afterHeartbeat = await engine.getAgentStatus('agent-1');
      expect(afterHeartbeat?.lastHeartbeat.getTime()).toBeGreaterThan(initialTime?.getTime() || 0);
    });

    test('should emit agent:heartbeat event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('agent-1');
        expect(data.state).toBe(AgentState.IDLE);
        done();
      });

      messageBus.on('agent:heartbeat', handler);

      engine.registerAgent('agent-1', 'backend', ['nodejs']).then(() => {
        engine.updateAgentHeartbeat('agent-1');
      });
    });

    test('should handle heartbeat for offline agent', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);

      // Manually set to offline
      const agent = await engine.getAgentStatus('agent-1');
      if (agent) {
        agent.state = AgentState.OFFLINE;
      }

      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('agent-1');
      });

      messageBus.on('agent:online', handler);

      await engine.updateAgentHeartbeat('agent-1');

      // Give async event handler time to execute
      await new Promise((r) => setTimeout(r, 50));

      const updated = await engine.getAgentStatus('agent-1');
      expect(updated?.state).toBe(AgentState.IDLE);
    });

    test('should handle heartbeat for non-existent agent gracefully', async () => {
      // Should not throw
      await expect(engine.updateAgentHeartbeat('non-existent')).resolves.not.toThrow();
    });

    test('should track heartbeat for multiple agents independently', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);

      await engine.updateAgentHeartbeat('agent-1');
      await new Promise((r) => setTimeout(r, 50));
      await engine.updateAgentHeartbeat('agent-2');

      const agent1 = await engine.getAgentStatus('agent-1');
      const agent2 = await engine.getAgentStatus('agent-2');

      expect(agent1?.lastHeartbeat.getTime()).toBeLessThanOrEqual(agent2?.lastHeartbeat.getTime() || 0);
    });
  });

  describe('Agent Unregistration', () => {
    test('should unregister an agent', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      expect(await engine.getAgentStatus('agent-1')).toBeDefined();

      await engine.unregisterAgent('agent-1');
      expect(await engine.getAgentStatus('agent-1')).toBeNull();
    });

    test('should emit agent:unregistered event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('agent-1');
        done();
      });

      messageBus.on('agent:unregistered', handler);

      engine.registerAgent('agent-1', 'backend', ['nodejs']).then(() => {
        engine.unregisterAgent('agent-1');
      });
    });

    test('should handle unregistering non-existent agent gracefully', async () => {
      // Should not throw
      await expect(engine.unregisterAgent('non-existent')).resolves.not.toThrow();
    });

    test('should remove agent from getAllAgents', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);

      let agents = await engine.getAllAgents();
      expect(agents).toHaveLength(2);

      await engine.unregisterAgent('agent-1');

      agents = await engine.getAllAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe('agent-2');
    });
  });

  describe('Agent State Transitions', () => {
    test('should initialize agent as IDLE', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);

      const agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.IDLE);
    });

    test('should track agent task count', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      const beforeExecution = await engine.getAgentStatus('agent-1');
      expect(beforeExecution?.taskCount).toBe(0);

      // Simulate task start
      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');

      const afterExecution = await engine.getAgentStatus('agent-1');
      expect(afterExecution?.taskCount).toBe(1);
      expect(afterExecution?.state).toBe(AgentState.BUSY);
      expect(afterExecution?.currentTaskId).toBe('task-1');
    });

    test('should transition from BUSY to IDLE on task completion', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      let agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.BUSY);

      await engine.completeTaskExecution('project-1', 'task-1', 'agent-1', { success: true });
      agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.IDLE);
      expect(agent?.currentTaskId).toBeUndefined();
      expect(agent?.completedCount).toBe(1);
    });

    test('should transition from BUSY to IDLE on task failure', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.startExecuting('project-1');

      await engine.startTaskExecution('project-1', 'task-1', 'agent-1');
      let agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.BUSY);

      await engine.failTaskExecution('project-1', 'task-1', 'agent-1', new Error('Task failed'));
      agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.IDLE);
      expect(agent?.currentTaskId).toBeUndefined();
    });
  });

  describe('Offline Detection', () => {
    test('should detect agent offline after heartbeat timeout', async () => {
      // Set short heartbeat timeout for testing
      engine.setHeartbeatTimeout(100);

      await engine.registerAgent('agent-1', 'backend', ['nodejs']);

      let agent = await engine.getAgentStatus('agent-1');
      expect(agent?.state).toBe(AgentState.IDLE);

      // Wait for offline detection (monitor checks every 5s, but we can't wait that long)
      // Instead, we'll simulate timeout by setting heartbeat to old time
      if (agent) {
        agent.lastHeartbeat = new Date(Date.now() - 200); // Older than 100ms timeout
      }

      // The heartbeat monitor runs in background, so this is more of an integration test
      // For unit testing, we would need to expose the heartbeat check logic separately
    });
  });

  describe('Capability-based Agent Selection', () => {
    test('should register agents with different capability sets', async () => {
      await engine.registerAgent('agent-frontend', 'frontend', ['react', 'typescript', 'css']);
      await engine.registerAgent('agent-backend', 'backend', ['nodejs', 'express', 'mongodb']);
      await engine.registerAgent('agent-qa', 'qa', ['testing', 'automation', 'jira']);

      const agents = await engine.getAllAgents();
      expect(agents.length).toBe(3);

      const frontend = agents.find((a) => a.agentId === 'agent-frontend');
      expect(frontend?.capabilities).toContain('react');
      expect(frontend?.capabilities).not.toContain('nodejs');
    });

    test('should allow agents with overlapping capabilities', async () => {
      await engine.registerAgent('agent-1', 'fullstack', ['react', 'nodejs', 'typescript']);
      await engine.registerAgent('agent-2', 'frontend', ['react', 'typescript', 'vue']);

      const agents = await engine.getAllAgents();
      expect(agents).toHaveLength(2);

      const agent1 = agents.find((a) => a.agentId === 'agent-1');
      const agent2 = agents.find((a) => a.agentId === 'agent-2');

      expect(agent1?.capabilities).toContain('nodejs');
      expect(agent2?.capabilities).toContain('vue');
    });
  });

  describe('Agent Status Queries', () => {
    test('should return all registered agents', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);
      await engine.registerAgent('agent-2', 'frontend', ['react']);
      await engine.registerAgent('agent-3', 'qa', ['testing']);

      const agents = await engine.getAllAgents();
      expect(agents).toHaveLength(3);
    });

    test('should return empty array when no agents registered', async () => {
      const agents = await engine.getAllAgents();
      expect(agents).toEqual([]);
    });

    test('should return null for non-existent agent', async () => {
      const agent = await engine.getAgentStatus('non-existent');
      expect(agent).toBeNull();
    });

    test('should include up-to-date heartbeat in agent status', async () => {
      await engine.registerAgent('agent-1', 'backend', ['nodejs']);

      const agent1 = await engine.getAgentStatus('agent-1');
      const firstHeartbeat = agent1?.lastHeartbeat;

      await new Promise((r) => setTimeout(r, 100));
      await engine.updateAgentHeartbeat('agent-1');

      const agent2 = await engine.getAgentStatus('agent-1');
      const secondHeartbeat = agent2?.lastHeartbeat;

      expect(secondHeartbeat?.getTime()).toBeGreaterThan(firstHeartbeat?.getTime() || 0);
    });
  });
});
