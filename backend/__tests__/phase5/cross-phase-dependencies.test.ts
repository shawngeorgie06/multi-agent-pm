/**
 * Phase 5: Cross-Phase Dependencies Tests
 * Tests dependencies between phases, blocker management, and dependency resolution
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AgentTeamOrchestrator, {
  AgentRole,
  WorkflowPhase,
  TeamConfig,
  CrossPhaseDependency,
} from '../../src/services/AgentTeamOrchestrator';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

describe('Phase 5: Cross-Phase Dependencies', () => {
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

  describe('Dependency Definition', () => {
    test('should add cross-phase dependency', async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-1',
        sourcePhase: WorkflowPhase.PLANNING,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design-spec',
        blockerMessage: 'Design specification required before development',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dependency);
      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');

      expect(deps.length).toBe(1);
      expect(deps[0].sourcePhase).toBe(WorkflowPhase.PLANNING);
      expect(deps[0].targetPhase).toBe(WorkflowPhase.DEVELOPMENT);
    });

    test('should add multiple dependencies', async () => {
      const dep1: CrossPhaseDependency = {
        dependencyId: 'dep-1',
        sourcePhase: WorkflowPhase.PLANNING,
        targetPhase: WorkflowPhase.DESIGN,
        blockerTaskId: 'task-req',
        blockerMessage: 'Requirements before design',
        isResolved: false,
      };

      const dep2: CrossPhaseDependency = {
        dependencyId: 'dep-2',
        sourcePhase: WorkflowPhase.DESIGN,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design',
        blockerMessage: 'Design before development',
        isResolved: false,
      };

      const dep3: CrossPhaseDependency = {
        dependencyId: 'dep-3',
        sourcePhase: WorkflowPhase.DEVELOPMENT,
        targetPhase: WorkflowPhase.QA,
        blockerTaskId: 'task-impl',
        blockerMessage: 'Implementation before testing',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dep1);
      await orchestrator.addCrossPhaseDependency(dep2);
      await orchestrator.addCrossPhaseDependency(dep3);

      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps.length).toBe(3);
    });
  });

  describe('Dependency Resolution', () => {
    beforeEach(async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-1',
        sourcePhase: WorkflowPhase.PLANNING,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design-spec',
        blockerMessage: 'Design specification required',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dependency);
    });

    test('should resolve dependency', async () => {
      let deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps[0].isResolved).toBe(false);

      await orchestrator.resolveCrossPhaseDependency('dep-1');

      deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps[0].isResolved).toBe(true);
    });

    test('should handle non-existent dependency resolution', async () => {
      await orchestrator.resolveCrossPhaseDependency('non-existent');
      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');

      expect(deps.length).toBe(1);
      expect(deps[0].isResolved).toBe(false);
    });
  });

  describe('Blocker Escalation', () => {
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

    test('should escalate blocker to team lead', async () => {
      await orchestrator.escalateBlocker('proj-1', 'blocker-1');

      // Verify through event
      const handler = jest.fn();
      messageBus.on('blocker:escalated', handler);
      await orchestrator.escalateBlocker('proj-1', 'blocker-2');

      expect(handler).toHaveBeenCalled();
    });

    test('should emit blocker:escalated event', (done) => {
      const handler = jest.fn((data) => {
        expect(data.projectId).toBe('proj-1');
        expect(data.blockerId).toBe('blocker-1');
        expect(data.escalatedTo).toBe('pm-1'); // PM is team lead
        done();
      });

      messageBus.on('blocker:escalated', handler);
      orchestrator.escalateBlocker('proj-1', 'blocker-1');
    });

    test('should handle multiple blocker escalations', async () => {
      const handlers: jest.Mock[] = [];
      let eventCount = 0;

      for (let i = 0; i < 3; i++) {
        const handler = jest.fn(() => {
          eventCount++;
        });
        handlers.push(handler);
        messageBus.on('blocker:escalated', handler);
      }

      await orchestrator.escalateBlocker('proj-1', 'blocker-1');
      await orchestrator.escalateBlocker('proj-1', 'blocker-2');
      await orchestrator.escalateBlocker('proj-1', 'blocker-3');

      expect(eventCount).toBeGreaterThan(0);
    });
  });

  describe('Dependency Chain Blocking', () => {
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
        ],
      };

      await orchestrator.createTeam(teamConfig);
      await orchestrator.startWorkflow('proj-1', 'standard');
    });

    test('should track design blocks development', async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-design-dev',
        sourcePhase: WorkflowPhase.DESIGN,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design',
        blockerMessage: 'Design specification required before implementation',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dependency);
      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');

      expect(deps).toContainEqual(
        expect.objectContaining({
          sourcePhase: WorkflowPhase.DESIGN,
          targetPhase: WorkflowPhase.DEVELOPMENT,
        })
      );
    });

    test('should track planning blocks design', async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-plan-design',
        sourcePhase: WorkflowPhase.PLANNING,
        targetPhase: WorkflowPhase.DESIGN,
        blockerTaskId: 'task-requirements',
        blockerMessage: 'Requirements needed for design',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dependency);
      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');

      expect(deps).toContainEqual(
        expect.objectContaining({
          sourcePhase: WorkflowPhase.PLANNING,
          targetPhase: WorkflowPhase.DESIGN,
        })
      );
    });

    test('should handle dependency chain', async () => {
      const dep1: CrossPhaseDependency = {
        dependencyId: 'dep-1',
        sourcePhase: WorkflowPhase.PLANNING,
        targetPhase: WorkflowPhase.DESIGN,
        blockerTaskId: 'task-req',
        blockerMessage: 'Requirements for design',
        isResolved: false,
      };

      const dep2: CrossPhaseDependency = {
        dependencyId: 'dep-2',
        sourcePhase: WorkflowPhase.DESIGN,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design',
        blockerMessage: 'Design for implementation',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dep1);
      await orchestrator.addCrossPhaseDependency(dep2);

      let deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps.length).toBe(2);
      expect(deps.every((d) => !d.isResolved)).toBe(true);

      // Resolve first dependency
      await orchestrator.resolveCrossPhaseDependency('dep-1');
      deps = await orchestrator.getCrossPhaseDependencies('proj-1');

      expect(deps[0].isResolved).toBe(true);
      expect(deps[1].isResolved).toBe(false);
    });
  });

  describe('Workflow Blocking', () => {
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

    test('should return no blockers initially', async () => {
      const workflow = await orchestrator.getWorkflowStatus('proj-1');
      expect(workflow?.blockers.length).toBe(0);
    });

    test('should track workflow blockers', async () => {
      const workflow = await orchestrator.getWorkflowStatus('proj-1');
      if (workflow) {
        workflow.blockers.push('design-not-complete');
        expect(workflow.blockers.length).toBe(1);
      }
    });
  });

  describe('Unblocking and Resolution', () => {
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
            name: WorkflowPhase.DESIGN,
            order: 1,
            requiredRoles: [AgentRole.DESIGNER],
            leaderRole: AgentRole.DESIGNER,
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

    test('should unblock phase after dependency resolved', async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-1',
        sourcePhase: WorkflowPhase.DESIGN,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design-spec',
        blockerMessage: 'Design specification',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dependency);

      // Resolve dependency
      await orchestrator.resolveCrossPhaseDependency('dep-1');

      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps[0].isResolved).toBe(true);
    });

    test('should allow phase advancement after unblocking', async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-1',
        sourcePhase: WorkflowPhase.DESIGN,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-design',
        blockerMessage: 'Design spec required',
        isResolved: false,
      };

      await orchestrator.addCrossPhaseDependency(dependency);

      // Initially unresolved
      let deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps[0].isResolved).toBe(false);

      // Resolve it
      await orchestrator.resolveCrossPhaseDependency('dep-1');

      // Now should be resolved
      deps = await orchestrator.getCrossPhaseDependencies('proj-1');
      expect(deps[0].isResolved).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty dependency list', async () => {
      const deps = await orchestrator.getCrossPhaseDependencies('proj-empty');
      expect(deps.length).toBe(0);
    });

    test('should handle dependency with same source and target', async () => {
      const dependency: CrossPhaseDependency = {
        dependencyId: 'dep-self',
        sourcePhase: WorkflowPhase.DEVELOPMENT,
        targetPhase: WorkflowPhase.DEVELOPMENT,
        blockerTaskId: 'task-circular',
        blockerMessage: 'Circular dependency',
        isResolved: false,
      };

      // Should not throw
      await orchestrator.addCrossPhaseDependency(dependency);
      const deps = await orchestrator.getCrossPhaseDependencies('proj-1');

      expect(deps.length).toBe(1);
    });
  });
});
