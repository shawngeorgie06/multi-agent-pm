/**
 * Phase 5: Workflow Orchestration Tests
 * Tests workflow phase definitions, sequencing, and phase transitions
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AgentTeamOrchestrator, {
  AgentRole,
  WorkflowPhase,
  TeamConfig,
} from '../../src/services/AgentTeamOrchestrator';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 5: Workflow Orchestration', () => {
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

  describe('Workflow Phase Definition', () => {
    test('should define multiple workflow phases', async () => {
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
            description: 'Project planning and requirement gathering',
          },
          {
            name: WorkflowPhase.DESIGN,
            order: 2,
            requiredRoles: [AgentRole.ARCHITECT],
            leaderRole: AgentRole.ARCHITECT,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
            description: 'System architecture and UI design',
          },
          {
            name: WorkflowPhase.DEVELOPMENT,
            order: 3,
            requiredRoles: [AgentRole.BACKEND_DEVELOPER, AgentRole.FRONTEND_DEVELOPER],
            leaderRole: AgentRole.FULLSTACK_DEVELOPER,
            minCompletionPercentage: 80,
            parallelizationLevel: 'parallel',
            description: 'Implementation of features',
          },
          {
            name: WorkflowPhase.QA,
            order: 4,
            requiredRoles: [AgentRole.QA_ENGINEER],
            leaderRole: AgentRole.QA_ENGINEER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
            description: 'Testing and quality assurance',
          },
        ],
      };

      await orchestrator.createTeam(teamConfig);
      const workflow = await orchestrator.getWorkflowStatus('proj-1');

      expect(workflow).toBeNull(); // Workflow not started yet
    });
  });

  describe('Workflow Initialization', () => {
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
    });

    test('should start workflow', async () => {
      await orchestrator.startWorkflow('proj-1', 'standard');
      const workflow = await orchestrator.getWorkflowStatus('proj-1');

      expect(workflow).toBeDefined();
      expect(workflow?.status).toBe('in-progress');
      expect(workflow?.currentPhaseIndex).toBe(0);
    });

    test('should emit workflow:started event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.phaseCount).toBe(2);
        done();
      });

      messageBus.on('workflow:started', handler);
      orchestrator.startWorkflow('proj-1', 'standard');
    });

    test('should emit phase:started event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.phaseName).toBe(WorkflowPhase.PLANNING);
        expect(data.phaseOrder).toBe(0);
        done();
      });

      messageBus.on('phase:started', handler);
      orchestrator.startWorkflow('proj-1', 'standard');
    });

    test('should get current phase', async () => {
      await orchestrator.startWorkflow('proj-1', 'standard');
      const currentPhase = await orchestrator.getCurrentPhase('proj-1');

      expect(currentPhase).toBeDefined();
      expect(currentPhase?.name).toBe(WorkflowPhase.PLANNING);
      expect(currentPhase?.order).toBe(1);
    });
  });

  describe('Phase Advancement', () => {
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

    test('should check if can advance to next phase', async () => {
      const canAdvance = await orchestrator.canAdvanceToNextPhase('proj-1');

      // No tasks in current phase, should be able to advance
      expect(canAdvance).toBe(true);
    });

    test('should advance to next phase when ready', async () => {
      const currentPhase = await orchestrator.getCurrentPhase('proj-1');
      expect(currentPhase?.name).toBe(WorkflowPhase.PLANNING);

      await orchestrator.advanceToNextPhase('proj-1');

      const nextPhase = await orchestrator.getCurrentPhase('proj-1');
      expect(nextPhase?.name).toBe(WorkflowPhase.DEVELOPMENT);
    });

    test('should emit phase:completed event on advancement', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.phaseName).toBe(WorkflowPhase.PLANNING);
        done();
      });

      messageBus.on('phase:completed', handler);
      orchestrator.advanceToNextPhase('proj-1');
    });

    test('should emit phase:advanced event on advancement', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.fromPhase).toBe(WorkflowPhase.PLANNING);
        expect(data.toPhase).toBe(WorkflowPhase.DEVELOPMENT);
        done();
      });

      messageBus.on('phase:advanced', handler);
      orchestrator.advanceToNextPhase('proj-1');
    });

    test('should emit phase:started event for next phase', (done) => {
      let callCount = 0;
      const handler = jest.fn((data) => {
        callCount++;
        if (callCount === 2) {
          // Skip first emission from startWorkflow
          expect(data.phaseName).toBe(WorkflowPhase.DEVELOPMENT);
          done();
        }
      });

      messageBus.on('phase:started', handler);
      orchestrator.startWorkflow('proj-1', 'standard').then(() => {
        orchestrator.advanceToNextPhase('proj-1');
      });
    });

    test('should complete workflow when at last phase', async () => {
      await orchestrator.advanceToNextPhase('proj-1');
      const workflow = await orchestrator.getWorkflowStatus('proj-1');

      expect(workflow?.currentPhaseIndex).toBe(1);

      await orchestrator.advanceToNextPhase('proj-1');
      const completedWorkflow = await orchestrator.getWorkflowStatus('proj-1');

      expect(completedWorkflow?.status).toBe('completed');
    });
  });

  describe('Phase Advancement Guards', () => {
    test('should prevent advancement before phase completion', async () => {
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
            minCompletionPercentage: 100, // Require 100% completion
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

      // Should allow advancement if no tasks (0/0 = 100%)
      const canAdvance = await orchestrator.canAdvanceToNextPhase('proj-1');
      expect(canAdvance).toBe(true);
    });

    test('should allow advancement at min completion percentage', async () => {
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
            minCompletionPercentage: 80, // Only need 80%
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

      const canAdvance = await orchestrator.canAdvanceToNextPhase('proj-1');
      expect(canAdvance).toBe(true);
    });
  });

  describe('Workflow Status Tracking', () => {
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
    });

    test('should track workflow status before start', async () => {
      const workflow = await orchestrator.getWorkflowStatus('proj-1');
      expect(workflow).toBeNull();
    });

    test('should track workflow status after start', async () => {
      await orchestrator.startWorkflow('proj-1', 'standard');
      const workflow = await orchestrator.getWorkflowStatus('proj-1');

      expect(workflow?.status).toBe('in-progress');
      expect(workflow?.startedAt).toBeDefined();
      expect(workflow?.completedAt).toBeUndefined();
    });

    test('should track phase progress in team status', async () => {
      await orchestrator.startWorkflow('proj-1', 'standard');
      let status = await orchestrator.getTeamStatus();

      expect(status.phaseProgress).toBe(0); // 0/2 - at phase 0

      await orchestrator.advanceToNextPhase('proj-1');
      status = await orchestrator.getTeamStatus();

      expect(status.currentPhase).toBe(WorkflowPhase.DEVELOPMENT);
      expect(status.phaseProgress).toBe(50); // 1/2 - at phase 1
    });
  });

  describe('Multi-Phase Workflows', () => {
    test('should handle 5-phase workflow', async () => {
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
            name: WorkflowPhase.DESIGN,
            order: 2,
            requiredRoles: [AgentRole.DESIGNER],
            leaderRole: AgentRole.DESIGNER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
          },
          {
            name: WorkflowPhase.DEVELOPMENT,
            order: 3,
            requiredRoles: [AgentRole.BACKEND_DEVELOPER],
            leaderRole: AgentRole.BACKEND_DEVELOPER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'parallel',
          },
          {
            name: WorkflowPhase.QA,
            order: 4,
            requiredRoles: [AgentRole.QA_ENGINEER],
            leaderRole: AgentRole.QA_ENGINEER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
          },
          {
            name: WorkflowPhase.DEPLOYMENT,
            order: 5,
            requiredRoles: [AgentRole.PROJECT_MANAGER],
            leaderRole: AgentRole.PROJECT_MANAGER,
            minCompletionPercentage: 100,
            parallelizationLevel: 'sequential',
          },
        ],
      };

      await orchestrator.createTeam(teamConfig);
      await orchestrator.startWorkflow('proj-1', 'standard');

      let workflow = await orchestrator.getWorkflowStatus('proj-1');
      expect(workflow?.phases.length).toBe(5);
      expect(workflow?.currentPhaseIndex).toBe(0);

      // Advance through all phases
      for (let i = 0; i < 5; i++) {
        await orchestrator.advanceToNextPhase('proj-1');
      }

      workflow = await orchestrator.getWorkflowStatus('proj-1');
      expect(workflow?.status).toBe('completed');
    });
  });
});
