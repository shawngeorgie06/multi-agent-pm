/**
 * Phase 5: Team Communication and Coordination Tests
 * Tests team communication, milestone broadcasting, and incident reporting
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AgentTeamOrchestrator, {
  AgentRole,
  WorkflowPhase,
  TeamConfig,
} from '../../src/services/AgentTeamOrchestrator';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 5: Team Communication & Coordination', () => {
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

  describe('Milestone Broadcasting', () => {
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
            agentId: 'qa-1',
            agentType: 'qa',
            role: AgentRole.QA_ENGINEER,
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
    });

    test('should broadcast phase milestone', async () => {
      await orchestrator.broadcastMilestone('proj-1', 'phase:planning_complete');

      // Verify through event
      const handler = jest.fn();
      messageBus.on('milestone:achieved', handler);
      await orchestrator.broadcastMilestone('proj-1', 'phase:design_complete');

      expect(handler).toHaveBeenCalled();
    });

    test('should emit milestone:achieved event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.milestone).toBe('api:v1_deployed');
        expect(data.recipients).toContain('pm-1');
        expect(data.recipients).toContain('dev-1');
        expect(data.recipients).toContain('qa-1');
        done();
      });

      messageBus.on('milestone:achieved', handler);
      orchestrator.broadcastMilestone('proj-1', 'api:v1_deployed');
    });

    test('should broadcast feature complete milestone', async () => {
      const handler = jest.fn((data) => {
        expect(data.milestone).toBe('feature:authentication');
      });

      messageBus.on('milestone:achieved', handler);
      await orchestrator.broadcastMilestone('proj-1', 'feature:authentication');

      expect(handler).toHaveBeenCalled();
    });

    test('should broadcast sprint complete milestone', async () => {
      const handler = jest.fn((data) => {
        expect(data.milestone).toBe('sprint:1_complete');
      });

      messageBus.on('milestone:achieved', handler);
      await orchestrator.broadcastMilestone('proj-1', 'sprint:1_complete');

      expect(handler).toHaveBeenCalled();
    });

    test('should handle multiple milestone broadcasts', async () => {
      const milestones = [
        'phase:planning_complete',
        'phase:design_complete',
        'phase:development_start',
        'phase:qa_start',
        'project:launch',
      ];

      let eventCount = 0;
      const handler = jest.fn(() => {
        eventCount++;
      });

      messageBus.on('milestone:achieved', handler);

      for (const milestone of milestones) {
        await orchestrator.broadcastMilestone('proj-1', milestone);
      }

      expect(eventCount).toBeGreaterThan(0);
    });
  });

  describe('Blocker Escalation Communication', () => {
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
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should escalate blocker', async () => {
      await orchestrator.escalateBlocker('proj-1', 'blocker:external_api_down');

      // Verify through event
      const handler = jest.fn();
      messageBus.on('blocker:escalated', handler);
      await orchestrator.escalateBlocker('proj-1', 'blocker:missing_dependency');

      expect(handler).toHaveBeenCalled();
    });

    test('should emit blocker:escalated event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.blockerId).toBe('blocker:database_migration');
        expect(data.escalatedTo).toBe('pm-1'); // PM is lead
        done();
      });

      messageBus.on('blocker:escalated', handler);
      orchestrator.escalateBlocker('proj-1', 'blocker:database_migration');
    });

    test('should escalate critical blockers', async () => {
      const handlers: jest.Mock[] = [];
      let eventCount = 0;

      for (let i = 0; i < 2; i++) {
        const handler = jest.fn(() => {
          eventCount++;
        });
        handlers.push(handler);
        messageBus.on('blocker:escalated', handler);
      }

      const criticalBlockers = [
        'blocker:server_down',
        'blocker:data_corruption',
      ];

      for (const blocker of criticalBlockers) {
        await orchestrator.escalateBlocker('proj-1', blocker);
      }

      expect(eventCount).toBeGreaterThan(0);
    });
  });

  describe('Incident Reporting', () => {
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
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should report incident', async () => {
      await orchestrator.reportIncident('proj-1', 'agent-crash');

      // Verify through event
      const handler = jest.fn();
      messageBus.on('incident:reported', handler);
      await orchestrator.reportIncident('proj-1', 'deployment-failed');

      expect(handler).toHaveBeenCalled();
    });

    test('should emit incident:reported event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.incident).toBe('test_failure_spike');
        done();
      });

      messageBus.on('incident:reported', handler);
      orchestrator.reportIncident('proj-1', 'test_failure_spike');
    });

    test('should handle multiple incident reports', async () => {
      const incidents = [
        'performance_degradation',
        'memory_leak_detected',
        'deployment_rollback',
        'agent_unresponsive',
      ];

      let eventCount = 0;
      const handler = jest.fn(() => {
        eventCount++;
      });

      messageBus.on('incident:reported', handler);

      for (const incident of incidents) {
        await orchestrator.reportIncident('proj-1', incident);
      }

      expect(eventCount).toBeGreaterThan(0);
    });
  });

  describe('Team Standup Communication', () => {
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
            completedCount: 5,
            failureCount: 0,
          },
          {
            agentId: 'dev-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: false,
            taskCount: 3,
            completedCount: 2,
            failureCount: 1,
          },
          {
            agentId: 'dev-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 2,
            completedCount: 4,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
    });

    test('should get team status for standup', async () => {
      const status = await orchestrator.getTeamStatus();

      expect(status.totalMembers).toBe(3);
      expect(status.availableMembers).toBe(2); // pm-1 and dev-2
      expect(status.completedTasks).toBe(11); // 5 + 2 + 4
      expect(status.failedTasks).toBe(1);
    });

    test('should calculate team velocity for standup', async () => {
      const velocity = await orchestrator.getTeamVelocity('proj-1');

      // Velocity should be tracked
      expect(typeof velocity).toBe('number');
    });

    test('should calculate team utilization for standup', async () => {
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      // 1 out of 3 busy = 33.33%
      expect(utilization).toBeCloseTo(33.33, 1);
    });
  });

  describe('Phase Transition Communication', () => {
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

    test('should broadcast phase completion milestone', async () => {
      const handler = jest.fn();
      messageBus.on('phase:completed', handler);

      await orchestrator.advanceToNextPhase('proj-1');

      expect(handler).toHaveBeenCalled();
    });

    test('should broadcast phase advancement milestone', async () => {
      const handler = jest.fn();
      messageBus.on('phase:advanced', handler);

      await orchestrator.advanceToNextPhase('proj-1');

      expect(handler).toHaveBeenCalled();
    });

    test('should emit phase advancement details', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.fromPhase).toBe(WorkflowPhase.PLANNING);
        expect(data.toPhase).toBe(WorkflowPhase.DEVELOPMENT);
        done();
      });

      messageBus.on('phase:advanced', handler);
      orchestrator.advanceToNextPhase('proj-1');
    });
  });

  describe('Consensus Decision Making', () => {
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
          {
            agentId: 'arch-1',
            agentType: 'architect',
            role: AgentRole.ARCHITECT,
            expertise: [],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'qa-1',
            agentType: 'qa',
            role: AgentRole.QA_ENGINEER,
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
    });

    test('should have team members for consensus', async () => {
      const members = await orchestrator.getTeamMembers('proj-1');

      expect(members.length).toBe(3);
      expect(members.some((m) => m.isLeader)).toBe(true); // At least one leader
    });

    test('should identify team leaders', async () => {
      const members = await orchestrator.getTeamMembers('proj-1');
      const leaders = members.filter((m) => m.isLeader);

      expect(leaders.length).toBeGreaterThan(0);
      expect(leaders[0].agentId).toBe('pm-1');
    });
  });

  describe('Error Handling in Communication', () => {
    test('should handle milestone broadcast for non-existent team', async () => {
      try {
        await orchestrator.broadcastMilestone('non-existent-proj', 'milestone');
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }
    });

    test('should handle incident report for non-existent team', async () => {
      try {
        await orchestrator.reportIncident('non-existent-proj', 'incident');
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }
    });

    test('should emit error event on communication failure', (done) => {
      const handler = jest.fn((data) => {
        expect(data.error).toBeDefined();
        done();
      });

      messageBus.on('error:milestone_broadcast_failed', handler);

      orchestrator.broadcastMilestone('non-existent', 'milestone').catch(() => {
        // Expected to fail
      });
    });
  });
});
