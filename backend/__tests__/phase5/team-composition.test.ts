/**
 * Phase 5: Team Composition and Role Assignment Tests
 * Tests team creation, member management, and role assignment
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AgentTeamOrchestrator, {
  AgentRole,
  WorkflowPhase,
  TeamConfig,
  TeamMember,
} from '../../src/services/AgentTeamOrchestrator';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 5: Team Composition', () => {
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

  describe('Team Creation', () => {
    test('should create a team with PM and developers', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Frontend Team',
        members: [
          {
            agentId: 'pm-1',
            agentType: 'pm',
            role: AgentRole.PROJECT_MANAGER,
            expertise: ['planning', 'coordination'],
            isLeader: true,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'dev-1',
            agentType: 'frontend',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: ['react', 'typescript'],
            isLeader: false,
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
        ],
      };

      await orchestrator.createTeam(teamConfig);
      const status = await orchestrator.getTeamStatus();

      expect(status.totalMembers).toBe(2);
      expect(status.projectId).toBe('proj-1');
    });

    test('should create team with multiple developer types', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-2',
        projectId: 'proj-2',
        name: 'Full Stack Team',
        members: [
          {
            agentId: 'pm-1',
            agentType: 'pm',
            role: AgentRole.PROJECT_MANAGER,
            expertise: ['planning'],
            isLeader: true,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'fe-1',
            agentType: 'frontend',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: ['react', 'typescript'],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'be-1',
            agentType: 'backend',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: ['nodejs', 'postgres'],
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
            expertise: ['testing', 'automation'],
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
      const status = await orchestrator.getTeamStatus();

      expect(status.totalMembers).toBe(4);
      expect(status.availableMembers).toBe(4);
    });

    test('should emit team:created event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.teamId).toBe('team-1');
        expect(data.projectId).toBe('proj-1');
        expect(data.memberCount).toBe(1);
        done();
      });

      messageBus.on('team:created', handler);

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

      orchestrator.createTeam(teamConfig);
    });
  });

  describe('Role Assignment', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'agent-1',
            agentType: 'general',
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

    test('should assign frontend developer role', async () => {
      await orchestrator.assignAgentRole('agent-1', AgentRole.FRONTEND_DEVELOPER);
      const members = await orchestrator.getTeamMembers('proj-1');

      expect(members[0].role).toBe(AgentRole.FRONTEND_DEVELOPER);
    });

    test('should assign backend developer role', async () => {
      await orchestrator.assignAgentRole('agent-1', AgentRole.BACKEND_DEVELOPER);
      const members = await orchestrator.getTeamMembers('proj-1');

      expect(members[0].role).toBe(AgentRole.BACKEND_DEVELOPER);
    });

    test('should assign QA engineer role', async () => {
      await orchestrator.assignAgentRole('agent-1', AgentRole.QA_ENGINEER);
      const members = await orchestrator.getTeamMembers('proj-1');

      expect(members[0].role).toBe(AgentRole.QA_ENGINEER);
    });

    test('should emit agent:role_assigned event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('agent-1');
        expect(data.role).toBe(AgentRole.RESEARCHER);
        done();
      });

      messageBus.on('agent:role_assigned', handler);
      orchestrator.assignAgentRole('agent-1', AgentRole.RESEARCHER);
    });

    test('should fail for non-existent agent', async () => {
      try {
        await orchestrator.assignAgentRole('non-existent', AgentRole.FRONTEND_DEVELOPER);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe('Expertise Management', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'agent-1',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: ['html', 'css'],
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

    test('should update agent expertise', async () => {
      const newExpertise = ['react', 'typescript', 'tailwind'];
      await orchestrator.updateAgentExpertise('agent-1', newExpertise);
      const members = await orchestrator.getTeamMembers('proj-1');

      expect(members[0].expertise).toEqual(newExpertise);
    });

    test('should emit agent:expertise_updated event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.agentId).toBe('agent-1');
        expect(data.expertise).toContain('nodejs');
        done();
      });

      messageBus.on('agent:expertise_updated', handler);
      orchestrator.updateAgentExpertise('agent-1', ['nodejs', 'express']);
    });

    test('should handle multiple expertise updates', async () => {
      await orchestrator.updateAgentExpertise('agent-1', ['typescript', 'react']);
      let members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].expertise).toEqual(['typescript', 'react']);

      await orchestrator.updateAgentExpertise('agent-1', ['vue', 'javascript']);
      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].expertise).toEqual(['vue', 'javascript']);
    });
  });

  describe('Team Member Tracking', () => {
    beforeEach(async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'agent-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: ['nodejs'],
            isLeader: false,
            isAvailable: true,
            taskCount: 0,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'agent-2',
            agentType: 'qa',
            role: AgentRole.QA_ENGINEER,
            expertise: ['testing'],
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

    test('should retrieve all team members', async () => {
      const members = await orchestrator.getTeamMembers('proj-1');

      expect(members.length).toBe(2);
      expect(members[0].agentId).toBe('agent-1');
      expect(members[1].agentId).toBe('agent-2');
    });

    test('should track member task counts', async () => {
      let members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].taskCount).toBe(0);

      // Simulate task assignment
      members[0].taskCount = 3;

      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].taskCount).toBe(3);
    });

    test('should track member completion counts', async () => {
      let members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].completedCount).toBe(0);

      // Simulate task completion
      members[0].completedCount = 5;

      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].completedCount).toBe(5);
    });

    test('should track member failure counts', async () => {
      let members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].failureCount).toBe(0);

      // Simulate task failure
      members[0].failureCount = 1;

      members = await orchestrator.getTeamMembers('proj-1');
      expect(members[0].failureCount).toBe(1);
    });
  });

  describe('Team Capacity Planning', () => {
    test('should calculate team utilization', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'agent-1',
            agentType: 'developer',
            role: AgentRole.BACKEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: false, // Busy
            taskCount: 3,
            completedCount: 0,
            failureCount: 0,
          },
          {
            agentId: 'agent-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: true, // Available
            taskCount: 0,
            completedCount: 5,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      expect(utilization).toBe(50); // 1 out of 2 agents busy
    });

    test('should handle zero utilization', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'agent-1',
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
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      expect(utilization).toBe(0);
    });

    test('should handle full utilization', async () => {
      const teamConfig: TeamConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        name: 'Test Team',
        members: [
          {
            agentId: 'agent-1',
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
            agentId: 'agent-2',
            agentType: 'developer',
            role: AgentRole.FRONTEND_DEVELOPER,
            expertise: [],
            isLeader: false,
            isAvailable: false,
            taskCount: 5,
            completedCount: 0,
            failureCount: 0,
          },
        ],
        phases: [],
      };

      await orchestrator.createTeam(teamConfig);
      const utilization = await orchestrator.getTeamUtilization('proj-1');

      expect(utilization).toBe(100);
    });
  });
});
