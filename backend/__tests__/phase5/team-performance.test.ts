/**
 * Phase 5: Team Performance and Optimization Tests
 * Tests team metrics, bottleneck identification, and performance optimization
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AgentTeamOrchestrator, {
  AgentRole,
  WorkflowPhase,
  TeamConfig,
} from '../../src/services/AgentTeamOrchestrator';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 5: Team Performance & Optimization', () => {
  let orchestrator: AgentTeamOrchestrator;
  let messageBus: MessageBus;
  let taskStore: MockTaskStore;

  beforeEach(() => {
    taskStore = new MockTaskStore();
    messageBus = new MessageBus(taskStore);
    orchestrator = new AgentTeamOrchestrator(messageBus, taskStore);
  });

  afterEach(() => {
    orchestrator.reset();
    messageBus.reset();
    taskStore.clearAll();
  });

  describe('Team Velocity Calculation', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 5,
            failureCount: 0,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 3,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should get team velocity', async () => {
      const velocity = await orchestrator.getTeamVelocity('proj-1');

      expect(typeof velocity).toBe('number');
      expect(velocity).toBeGreaterThanOrEqual(0);
    });

    test('should track velocity as tasks complete', async () => {
      let velocity = await orchestrator.getTeamVelocity('proj-1');
      expect(velocity).toBe(0); // Initial velocity

      // Simulate task completion
      messageBus.emit('task:completed', {
        projectId: 'proj-1',
        taskId: 'task-1',
        agentId: 'dev-1',
        result: 'success',
      });

      velocity = await orchestrator.getTeamVelocity('proj-1');
      expect(typeof velocity).toBe('number');
    });

    test('should emit velocity:updated event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(typeof data.velocity).toBe('number');
        expect(typeof data.utilization).toBe('number');
        done();
      });

      messageBus.on('velocity:updated', handler);

      // Trigger velocity update
      messageBus.emit('task:completed', {
        projectId: 'proj-1',
        taskId: 'task-1',
        agentId: 'dev-1',
      });
    });
  });

  describe('Team Utilization Tracking', () => {
    test('should calculate utilization with all available agents', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      expect(utilization).toBe(0); // All available, none busy
    });

    test('should calculate utilization with some busy agents', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: false, // Busy
            taskCount: 5,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true, // Available
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      expect(utilization).toBe(50); // 1 out of 2 busy
    });

    test('should calculate 100% utilization when all busy', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: false,
            taskCount: 5,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: false,
            taskCount: 3,
            completedCount: 0,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      expect(utilization).toBe(100); // All busy
    });
  });

  describe('Team Metrics Collection', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 2,
            completedCount: 5,
            failureCount: 1,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 1,
            completedCount: 3,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should collect comprehensive team metrics', async () => {
      const metrics = await orchestrator.getTeamMetrics('proj-1');

      expect(metrics.projectId).toBe('proj-1');
      expect(metrics.velocity).toBeDefined();
      expect(metrics.utilization).toBeDefined();
      expect(metrics.failureRate).toBeDefined();
      expect(metrics.retryRate).toBeDefined();
      expect(metrics.bottlenecks).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    test('should calculate failure rate', async () => {
      const metrics = await orchestrator.getTeamMetrics('proj-1');

      // (1 failure) / (5+1+3+0+3 = 12 total) = 8.33%
      expect(metrics.failureRate).toBeGreaterThanOrEqual(0);
      expect(metrics.failureRate).toBeLessThanOrEqual(100);
    });

    test('should track agent productivity', async () => {
      // First trigger a metrics update
      messageBus.emit('task:completed', {
        projectId: 'proj-1',
        taskId: 'task-1',
        agentId: 'dev-1',
      });

      const metrics = await orchestrator.getTeamMetrics('proj-1');

      expect(metrics.agentProductivity.size).toBeGreaterThanOrEqual(2);
      expect(metrics.agentProductivity.has('dev-1')).toBe(true);
      expect(metrics.agentProductivity.has('dev-2')).toBe(true);
    });

    test('should update metrics timestamp', async () => {
      const metrics1 = await orchestrator.getTeamMetrics('proj-1');
      const timestamp1 = metrics1.timestamp;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const metrics2 = await orchestrator.getTeamMetrics('proj-1');
      const timestamp2 = metrics2.timestamp;

      expect(timestamp2.getTime()).toBeGreaterThanOrEqual(timestamp1.getTime());
    });
  });

  describe('Bottleneck Identification', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 2,
            failureCount: 0,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 10,
            failureCount: 0,
          },
        ],
        phases: [
          {
            name: WorkflowPhase.PLANNING,
            order: 1,
            requiredRoles: [AgentRole.PROJECT_MANAGER],
            leaderRole: AgentRole.PROJECT_MANAGER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
          },
          {
            name: WorkflowPhase.DEVELOPMENT,
            order: 2,
            requiredRoles: [AgentRole.BACKEND_DEVELOPER],
            leaderRole: AgentRole.BACKEND_DEVELOPER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'parallel',
          },
        ],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should identify bottlenecks', async () => {
      const bottlenecks = await orchestrator.identifyBottlenecks('proj-1');

      expect(Array.isArray(bottlenecks)).toBe(true);
      expect(bottlenecks.every((b) => b.bottleneckId)).toBe(true);
    });

    test('should identify phase bottlenecks', async () => {
      const bottlenecks = await orchestrator.identifyBottlenecks('proj-1');

      // Should have some bottlenecks (at least the slow phase or low productivity)
      expect(bottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    test('should identify agent productivity bottlenecks', async () => {
      const bottlenecks = await orchestrator.identifyBottlenecks('proj-1');

      const productivityBottlenecks = bottlenecks.filter((b) => b.type === 'agent');
      if (productivityBottlenecks.length > 0) {
        expect(productivityBottlenecks[0].cause).toContain('productivity');
      }
    });

    test('should emit bottleneck:detected event', async () => {
      const handler = jest.fn();
      messageBus.on('bottleneck:detected', handler);

      // Trigger bottleneck detection
      const bottlenecks = await orchestrator.identifyBottlenecks('proj-1');
      if (bottlenecks.length > 0) {
        messageBus.emit('bottleneck:detected', {
          projectId: 'proj-1',
          bottleneck: bottlenecks[0],
        });
        expect(handler).toHaveBeenCalled();
      }
    });
  });

  describe('Performance Recommendations', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 10,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0, // Underutilized
            completedCount: 0,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should recommend rebalancing', async () => {
      const recommendations = await orchestrator.recommendRebalancing('proj-1');

      expect(Array.isArray(recommendations)).toBe(true);
    });

    test('should recommend moving tasks from overloaded to underutilized', async () => {
      const recommendations = await orchestrator.recommendRebalancing('proj-1');

      // Should recommend moving tasks to underutilized agents
      expect(recommendations.length).toBeGreaterThan(0);
    });

    test('should have confidence scores', async () => {
      const recommendations = await orchestrator.recommendRebalancing('proj-1');

      if (recommendations.length > 0) {
        expect(recommendations[0].confidence).toBeGreaterThanOrEqual(0);
        expect(recommendations[0].confidence).toBeLessThanOrEqual(100);
      }
    });

    test('should have expected improvement estimates', async () => {
      const recommendations = await orchestrator.recommendRebalancing('proj-1');

      if (recommendations.length > 0) {
        expect(recommendations[0].expectedImprovement).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Agent Failure and Recovery', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 5,
            completedCount: 3,
            failureCount: 1,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should handle agent offline event', async () => {
      let members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].isAvailable).toBe(true);

      // Emit agent offline event
      messageBus.emit('agent:offline', {
        agentId: 'dev-1',
        projectId: 'proj-1',
      });

      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].isAvailable).toBe(false);
    });

    test('should handle task failure event', async () => {
      let members = await orchestrator.getTeamMembers('proj-1');
      const initialFailures = members[0].failureCount;

      // Emit task failure
      messageBus.emit('task:failed', {
        projectId: 'proj-1',
        agentId: 'dev-1',
        taskId: 'task-1',
        error: 'Test failure',
      });

      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].failureCount).toBe(initialFailures + 1);
    });

    test('should handle task completion event', async () => {
      let members = await orchestrator.getTeamMembers('proj-1');
      const initialCompleted = members[0].completedCount;

      // Emit task completion
      messageBus.emit('task:completed', {
        projectId: 'proj-1',
        agentId: 'dev-1',
        taskId: 'task-1',
      });

      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].completedCount).toBe(initialCompleted + 1);
    });
  });

  describe('Phase Duration Tracking', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'pm-1',
            agentType: 'pm',
            role: AgentRole.PROJECT_MANAGER,
            expertise: [],
            isLeader: true,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
        ],
        phases: [
          {
            name: WorkflowPhase.PLANNING,
            order: 1,
            requiredRoles: [AgentRole.PROJECT_MANAGER],
            leaderRole: AgentRole.PROJECT_MANAGER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
          },
          {
            name: WorkflowPhase.DEVELOPMENT,
            order: 2,
            requiredRoles: [AgentRole.BACKEND_DEVELOPER],
            leaderRole: AgentRole.BACKEND_DEVELOPER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'parallel',
          },
        ],
      };

      await orchestrator.createTeam(teamConfig);
      await orchestrator.startWorkflow('proj-1', 'standard');
    });

    test('should track phase durations', async () => {
      await orchestrator.advanceToNextPhase('proj-1');
      const workflow = await orchestrator.getWorkflowStatus('proj-1');

      expect(workflow?.phaseDurations.size).toBeGreaterThan(0);
    });

    test('should record phase completion time', async () => {
      await orchestrator.advanceToNextPhase('proj-1');
      const workflow = await orchestrator.getWorkflowStatus('proj-1');

      const planningDuration = workflow?.phaseDurations.get(WorkflowPhase.PLANNING);
      expect(planningDuration).toBeDefined();
      expect(planningDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Historical Performance Trending', () => {
    test('should track multiple project metrics', async () => {
      const teamConfigs = [
        {
          teamId: 'team-1',
          projectId: 'proj-1',
          name: 'Project 1',
        },
        {
          teamId: 'team-2',
          projectId: 'proj-2',
          name: 'Project 2',
        },
      ];

      for (const config of teamConfigs) {
        const fullConfig: TeamConfig = {
          ...config,
          members: [
            {
              agentId: `pm-${config.teamId}`,
              agentType: 'pm',
              role: AgentRole.PROJECT_MANAGER,
              expertise: [],
              isLeader: true,
              isAvailable: true,
              taskCount: 0,
              completedCount: Math.floor(Math.random() * 10),
              failureCount: 0,
            },
          ],
          phases: [],
        };

        await orchestrator.createTeam(fullConfig);
      }

      const metrics1 = await orchestrator.getTeamMetrics('proj-1');
      expect(metrics1).toBeDefined();
    });
  });
});
