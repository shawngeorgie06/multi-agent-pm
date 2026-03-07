/**
 * AgentTeamOrchestrator Service - Agent Team Coordination and Orchestration
 * Manages team composition, workflow orchestration, cross-phase dependencies,
 * team communication, and team-level performance optimization.
 *
 * Phase 5 Implementation: Team coordination, workflow management, and team metrics
 */

import { MessageBus, ITaskStore } from './MessageBus';

/**
 * Agent role enumeration
 */
export enum AgentRole {
  PROJECT_MANAGER = 'pm',
  FRONTEND_DEVELOPER = 'frontend',
  BACKEND_DEVELOPER = 'backend',
  FULLSTACK_DEVELOPER = 'fullstack',
  QA_ENGINEER = 'qa',
  RESEARCHER = 'researcher',
  ARCHITECT = 'architect',
  DESIGNER = 'designer',
}

/**
 * Workflow phase enumeration
 */
export enum WorkflowPhase {
  PLANNING = 'planning',
  DESIGN = 'design',
  DEVELOPMENT = 'development',
  QA = 'qa',
  DEPLOYMENT = 'deployment',
}

/**
 * Team member information
 */
export interface TeamMember {
  agentId: string;
  agentType: string;
  role: AgentRole;
  expertise: string[];
  isLeader: boolean;
  isAvailable: boolean;
  taskCount: number;
  completedCount: number;
  failureCount: number;
}

/**
 * Team configuration
 */
export interface TeamConfig {
  teamId: string;
  projectId: string;
  name: string;
  members: TeamMember[];
  phases: Phase[];
  maxConcurrentTasks?: number;
}

/**
 * Phase definition
 */
export interface Phase {
  name: WorkflowPhase | string;
  order: number;
  requiredRoles: AgentRole[];
  leaderRole: AgentRole;
  minCompletionPercentage: number;
  parallelizationLevel: 'sequential' | 'parallel' | 'mixed';
  description?: string;
}

/**
 * Team status information
 */
export interface TeamStatus {
  teamId: string;
  projectId: string;
  currentPhase: WorkflowPhase | string;
  phaseProgress: number; // 0-100
  totalMembers: number;
  availableMembers: number;
  activeTasks: number;
  blockedTasks: number;
  completedTasks: number;
  failedTasks: number;
  velocity: number;
  utilization: number;
  timestamp: Date;
}

/**
 * Workflow information
 */
export interface Workflow {
  workflowId: string;
  projectId: string;
  phases: Phase[];
  currentPhaseIndex: number;
  status: 'pending' | 'in-progress' | 'paused' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  phaseDurations: Map<string, number>;
  blockers: string[];
}

/**
 * Cross-phase dependency
 */
export interface CrossPhaseDependency {
  dependencyId: string;
  sourcePhase: string;
  targetPhase: string;
  blockerTaskId: string;
  blockerMessage: string;
  isResolved: boolean;
}

/**
 * Bottleneck information
 */
export interface Bottleneck {
  bottleneckId: string;
  type: 'phase' | 'agent' | 'task';
  phase?: string;
  agentId?: string;
  taskId?: string;
  cause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // milliseconds
  impact: 'velocity' | 'utilization' | 'quality';
  recommendation: string;
}

/**
 * Team metrics
 */
export interface TeamMetrics {
  projectId: string;
  velocity: number; // Tasks per hour
  utilization: number; // % agents busy (0-100)
  phaseCompletionTimes: Map<string, number>; // Phase -> milliseconds
  agentProductivity: Map<string, number>; // AgentId -> tasks/hour
  failureRate: number; // % tasks failing
  retryRate: number; // % tasks retried
  bottlenecks: Bottleneck[];
  averageTaskDuration: number; // milliseconds
  timestamp: Date;
}

/**
 * Rebalancing recommendation
 */
export interface Recommendation {
  type: 'move_task' | 'add_agent' | 'adjust_phase' | 'parallelize' | 'resequence';
  targetPhase?: string;
  targetAgent?: string;
  reason: string;
  expectedImprovement: number; // % velocity improvement
  confidence: number; // 0-100
}

/**
 * Blocker escalation
 */
export interface BlockerEscalation {
  escalationId: string;
  projectId: string;
  blockerId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string; // Agent or phase that encountered blocker
  description: string;
  escalatedTo: string; // Team lead
  escalatedAt: Date;
  isResolved: boolean;
  resolution?: string;
}

/**
 * Team Communication & Coordination
 */
export interface TeamCommunication {
  type: 'milestone' | 'blocker' | 'standup' | 'decision' | 'incident';
  projectId: string;
  sender: string; // Team lead
  recipients: string[]; // Team members
  content: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * AgentTeamOrchestrator Interface
 */
export interface IAgentTeamOrchestrator {
  // Team Management
  createTeam(teamConfig: TeamConfig): Promise<void>;
  getTeamStatus(): Promise<TeamStatus>;
  assignAgentRole(agentId: string, role: AgentRole): Promise<void>;
  updateAgentExpertise(agentId: string, expertise: string[]): Promise<void>;
  getTeamMembers(projectId: string): Promise<TeamMember[]>;

  // Workflow Management
  startWorkflow(projectId: string, workflowType: string): Promise<void>;
  getCurrentPhase(projectId: string): Promise<Phase | null>;
  canAdvanceToNextPhase(projectId: string): Promise<boolean>;
  advanceToNextPhase(projectId: string): Promise<void>;
  getWorkflowStatus(projectId: string): Promise<Workflow | null>;

  // Coordination
  escalateBlocker(projectId: string, blockerId: string): Promise<void>;
  broadcastMilestone(projectId: string, milestone: string): Promise<void>;
  reportIncident(projectId: string, incident: string): Promise<void>;

  // Cross-Phase Dependencies
  addCrossPhaseDependency(dep: CrossPhaseDependency): Promise<void>;
  resolveCrossPhaseDependency(dependencyId: string): Promise<void>;
  getCrossPhaseDependencies(projectId: string): Promise<CrossPhaseDependency[]>;

  // Metrics & Optimization
  getTeamVelocity(projectId: string): Promise<number>;
  getTeamUtilization(projectId: string): Promise<number>;
  getTeamMetrics(projectId: string): Promise<TeamMetrics>;
  identifyBottlenecks(projectId: string): Promise<Bottleneck[]>;
  recommendRebalancing(projectId: string): Promise<Recommendation[]>;
}

/**
 * AgentTeamOrchestrator - Team Orchestration and Coordination Service
 */
export class AgentTeamOrchestrator implements IAgentTeamOrchestrator {
  // Team registry: projectId -> TeamConfig
  private teams: Map<string, TeamConfig> = new Map();

  // Team members: projectId -> Map<agentId, TeamMember>
  private teamMembers: Map<string, Map<string, TeamMember>> = new Map();

  // Workflows: projectId -> Workflow
  private workflows: Map<string, Workflow> = new Map();

  // Team metrics: projectId -> TeamMetrics
  private teamMetrics: Map<string, TeamMetrics> = new Map();

  // Cross-phase dependencies: projectId -> CrossPhaseDependency[]
  private crossPhaseDependencies: Map<string, CrossPhaseDependency[]> = new Map();

  // Blocker escalations: projectId -> BlockerEscalation[]
  private blockerEscalations: Map<string, BlockerEscalation[]> = new Map();

  // Phase task tracking: projectId -> Map<phaseName, taskIds[]>
  private phaseTaskMap: Map<string, Map<string, Set<string>>> = new Map();

  // Task completion tracking: projectId -> Map<taskId, completedAt>
  private taskCompletionTimes: Map<string, Map<string, Date>> = new Map();

  // Message bus for event distribution
  private messageBus: MessageBus;

  // Task store for persistence
  private taskStore: ITaskStore;

  /**
   * Constructor
   * @param messageBus MessageBus for event distribution
   * @param taskStore ITaskStore for persistence
   */
  constructor(messageBus: MessageBus, taskStore: ITaskStore) {
    this.messageBus = messageBus;
    this.taskStore = taskStore;
    this.subscribeToEvents();
  }

  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    // Listen on broadcast channel for all events
    this.messageBus.on('broadcast', (envelope: any) => {
      const message = envelope.content || envelope;
      const eventType = message.event;

      if (eventType === 'task:completed') {
        this.handleTaskCompleted(message);
      } else if (eventType === 'task:failed') {
        this.handleTaskFailed(message);
      } else if (eventType === 'agent:offline') {
        this.handleAgentOffline(message);
      } else if (eventType === 'execution:paused') {
        this.handleExecutionPaused(message);
      }
    });
  }

  /**
   * Create a team
   */
  async createTeam(teamConfig: TeamConfig): Promise<void> {
    try {
      const projectId = teamConfig.projectId;

      // Store team configuration
      this.teams.set(projectId, teamConfig);

      // Initialize team members
      const membersMap = new Map<string, TeamMember>();
      for (const member of teamConfig.members) {
        membersMap.set(member.agentId, member);
      }
      this.teamMembers.set(projectId, membersMap);

      // Initialize phase task tracking
      const phaseMap = new Map<string, Set<string>>();
      for (const phase of teamConfig.phases) {
        phaseMap.set(phase.name as string, new Set());
      }
      this.phaseTaskMap.set(projectId, phaseMap);

      // Initialize task completion tracking
      this.taskCompletionTimes.set(projectId, new Map());

      // Initialize metrics
      this.teamMetrics.set(projectId, {
        projectId,
        velocity: 0,
        utilization: 0,
        phaseCompletionTimes: new Map(),
        agentProductivity: new Map(),
        failureRate: 0,
        retryRate: 0,
        bottlenecks: [],
        averageTaskDuration: 0,
        timestamp: new Date(),
      });

      // Emit team created event
      this.messageBus.emit('team:created', {
        teamId: teamConfig.teamId,
        projectId,
        memberCount: teamConfig.members.length,
        phases: teamConfig.phases.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.messageBus.emit('error:team_creation_failed', {
        projectId: teamConfig.projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get team status
   */
  async getTeamStatus(): Promise<TeamStatus> {
    // Return the most recently active team
    if (this.teams.size === 0) {
      throw new Error('No teams created');
    }

    const lastTeam = Array.from(this.teams.values()).pop();
    if (!lastTeam) {
      throw new Error('No teams available');
    }

    const projectId = lastTeam.projectId;
    const workflow = this.workflows.get(projectId);
    const members = this.teamMembers.get(projectId) || new Map();

    let activeMembers = 0;
    let activeTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const member of members.values()) {
      if (member.isAvailable) {
        activeMembers++;
      }
      activeTasks += member.taskCount;
      completedTasks += member.completedCount;
      failedTasks += member.failureCount;
    }

    const phaseProgress = workflow
      ? ((workflow.currentPhaseIndex) / workflow.phases.length) * 100
      : 0;

    const currentPhase = workflow?.phases[workflow.currentPhaseIndex]?.name || WorkflowPhase.PLANNING;
    const metrics = this.teamMetrics.get(projectId);

    return {
      teamId: lastTeam.teamId,
      projectId,
      currentPhase,
      phaseProgress,
      totalMembers: members.size,
      availableMembers: activeMembers,
      activeTasks,
      blockedTasks: workflow?.blockers.length || 0,
      completedTasks,
      failedTasks,
      velocity: metrics?.velocity || 0,
      utilization: metrics?.utilization || 0,
      timestamp: new Date(),
    };
  }

  /**
   * Assign agent role
   */
  async assignAgentRole(agentId: string, role: AgentRole): Promise<void> {
    try {
      for (const members of this.teamMembers.values()) {
        const member = members.get(agentId);
        if (member) {
          member.role = role;
          this.messageBus.emit('agent:role_assigned', {
            agentId,
            role,
            timestamp: new Date(),
          });
          return;
        }
      }

      throw new Error(`Agent ${agentId} not found in any team`);
    } catch (error) {
      this.messageBus.emit('error:role_assignment_failed', {
        agentId,
        role,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update agent expertise
   */
  async updateAgentExpertise(agentId: string, expertise: string[]): Promise<void> {
    try {
      for (const members of this.teamMembers.values()) {
        const member = members.get(agentId);
        if (member) {
          member.expertise = expertise;
          this.messageBus.emit('agent:expertise_updated', {
            agentId,
            expertise,
            timestamp: new Date(),
          });
          return;
        }
      }

      throw new Error(`Agent ${agentId} not found in any team`);
    } catch (error) {
      this.messageBus.emit('error:expertise_update_failed', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(projectId: string): Promise<TeamMember[]> {
    const members = this.teamMembers.get(projectId);
    if (!members) {
      return [];
    }
    return Array.from(members.values());
  }

  /**
   * Start workflow
   */
  async startWorkflow(projectId: string, workflowType: string): Promise<void> {
    try {
      const team = this.teams.get(projectId);
      if (!team) {
        throw new Error(`Team not found for project ${projectId}`);
      }

      // Create workflow
      const workflow: Workflow = {
        workflowId: `workflow-${Date.now()}`,
        projectId,
        phases: team.phases,
        currentPhaseIndex: 0,
        status: 'in-progress',
        startedAt: new Date(),
        phaseDurations: new Map(),
        blockers: [],
      };

      this.workflows.set(projectId, workflow);

      // Emit workflow started event
      this.messageBus.emit('workflow:started', {
        workflowId: workflow.workflowId,
        projectId,
        phaseCount: workflow.phases.length,
        currentPhase: workflow.phases[0].name,
        timestamp: new Date(),
      });

      // Emit phase started event
      this.messageBus.emit('phase:started', {
        projectId,
        phaseName: workflow.phases[0].name,
        phaseOrder: 0,
        timestamp: new Date(),
      });
    } catch (error) {
      this.messageBus.emit('error:workflow_start_failed', {
        projectId,
        workflowType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get current phase
   */
  async getCurrentPhase(projectId: string): Promise<Phase | null> {
    const workflow = this.workflows.get(projectId);
    if (!workflow) {
      return null;
    }

    return workflow.phases[workflow.currentPhaseIndex] || null;
  }

  /**
   * Check if can advance to next phase
   */
  async canAdvanceToNextPhase(projectId: string): Promise<boolean> {
    const workflow = this.workflows.get(projectId);
    if (!workflow) {
      return false;
    }

    // Can advance from any phase to the next, including last phase
    // (last phase advancement will complete the workflow)
    if (workflow.currentPhaseIndex >= workflow.phases.length) {
      return false;
    }

    const currentPhase = workflow.phases[workflow.currentPhaseIndex];
    const phaseTasks = this.phaseTaskMap.get(projectId)?.get(currentPhase.name as string) || new Set();

    if (phaseTasks.size === 0) {
      return true; // No tasks means phase is complete, can advance
    }

    // Count completed tasks in current phase
    let completedCount = 0;
    const completionMap = this.taskCompletionTimes.get(projectId) || new Map();

    for (const taskId of phaseTasks) {
      if (completionMap.has(taskId)) {
        completedCount++;
      }
    }

    const completionPercentage = (completedCount / phaseTasks.size) * 100;
    return completionPercentage >= currentPhase.minCompletionPercentage;
  }

  /**
   * Advance to next phase
   */
  async advanceToNextPhase(projectId: string): Promise<void> {
    try {
      const workflow = this.workflows.get(projectId);
      if (!workflow) {
        throw new Error(`Workflow not found for project ${projectId}`);
      }

      // Check if can advance
      const canAdvance = await this.canAdvanceToNextPhase(projectId);
      if (!canAdvance) {
        throw new Error('Cannot advance: phase not complete');
      }

      // Record phase duration
      const currentPhase = workflow.phases[workflow.currentPhaseIndex];
      if (workflow.startedAt) {
        const duration = Date.now() - workflow.startedAt.getTime();
        workflow.phaseDurations.set(currentPhase.name as string, duration);
      }

      // Advance to next phase
      workflow.currentPhaseIndex++;

      if (workflow.currentPhaseIndex >= workflow.phases.length) {
        // Workflow complete
        workflow.status = 'completed';
        workflow.completedAt = new Date();

        this.messageBus.emit('workflow:completed', {
          projectId,
          workflowId: workflow.workflowId,
          duration: workflow.completedAt.getTime() - (workflow.startedAt?.getTime() || 0),
          timestamp: new Date(),
        });
      } else {
        // Start next phase
        const nextPhase = workflow.phases[workflow.currentPhaseIndex];

        this.messageBus.emit('phase:completed', {
          projectId,
          phaseName: currentPhase.name,
          duration: workflow.phaseDurations.get(currentPhase.name as string),
          timestamp: new Date(),
        });

        this.messageBus.emit('phase:advanced', {
          projectId,
          fromPhase: currentPhase.name,
          toPhase: nextPhase.name,
          timestamp: new Date(),
        });

        this.messageBus.emit('phase:started', {
          projectId,
          phaseName: nextPhase.name,
          phaseOrder: workflow.currentPhaseIndex,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.messageBus.emit('error:phase_advance_failed', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(projectId: string): Promise<Workflow | null> {
    return this.workflows.get(projectId) || null;
  }

  /**
   * Escalate blocker
   */
  async escalateBlocker(projectId: string, blockerId: string): Promise<void> {
    try {
      const team = this.teams.get(projectId);
      if (!team) {
        throw new Error(`Team not found for project ${projectId}`);
      }

      // Find team lead (PM or most senior role)
      let teamLead = team.members.find((m) => m.role === AgentRole.PROJECT_MANAGER);
      if (!teamLead) {
        teamLead = team.members[0];
      }

      const escalation: BlockerEscalation = {
        escalationId: `escalation-${Date.now()}`,
        projectId,
        blockerId,
        severity: 'medium',
        source: 'unknown',
        description: `Blocker: ${blockerId}`,
        escalatedTo: teamLead?.agentId || 'unknown',
        escalatedAt: new Date(),
        isResolved: false,
      };

      if (!this.blockerEscalations.has(projectId)) {
        this.blockerEscalations.set(projectId, []);
      }
      this.blockerEscalations.get(projectId)!.push(escalation);

      // Emit escalation event
      this.messageBus.emit('blocker:escalated', {
        escalationId: escalation.escalationId,
        projectId,
        blockerId,
        escalatedTo: teamLead?.agentId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.messageBus.emit('error:blocker_escalation_failed', {
        projectId,
        blockerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Broadcast milestone
   */
  async broadcastMilestone(projectId: string, milestone: string): Promise<void> {
    try {
      const team = this.teams.get(projectId);
      if (!team) {
        throw new Error(`Team not found for project ${projectId}`);
      }

      const recipientIds = team.members.map((m) => m.agentId);

      // Emit milestone event
      this.messageBus.emit('milestone:achieved', {
        projectId,
        milestone,
        recipients: recipientIds,
        timestamp: new Date(),
      });
    } catch (error) {
      this.messageBus.emit('error:milestone_broadcast_failed', {
        projectId,
        milestone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Report incident
   */
  async reportIncident(projectId: string, incident: string): Promise<void> {
    try {
      const team = this.teams.get(projectId);
      if (!team) {
        throw new Error(`Team not found for project ${projectId}`);
      }

      // Emit incident event
      this.messageBus.emit('incident:reported', {
        projectId,
        incident,
        timestamp: new Date(),
      });
    } catch (error) {
      this.messageBus.emit('error:incident_report_failed', {
        projectId,
        incident,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add cross-phase dependency
   */
  async addCrossPhaseDependency(dep: CrossPhaseDependency): Promise<void> {
    // Store by dependency ID for tracking
    if (!this.crossPhaseDependencies.has('_all')) {
      this.crossPhaseDependencies.set('_all', []);
    }
    this.crossPhaseDependencies.get('_all')!.push(dep);
  }

  /**
   * Resolve cross-phase dependency
   */
  async resolveCrossPhaseDependency(dependencyId: string): Promise<void> {
    const allDeps = this.crossPhaseDependencies.get('_all') || [];
    for (const dep of allDeps) {
      if (dep.dependencyId === dependencyId) {
        dep.isResolved = true;
        return;
      }
    }
  }

  /**
   * Get cross-phase dependencies
   */
  async getCrossPhaseDependencies(projectId: string): Promise<CrossPhaseDependency[]> {
    // Return all dependencies (not filtered by project for now)
    return this.crossPhaseDependencies.get('_all') || [];
  }

  /**
   * Get team velocity
   */
  async getTeamVelocity(projectId: string): Promise<number> {
    const metrics = this.teamMetrics.get(projectId);
    return metrics?.velocity || 0;
  }

  /**
   * Get team utilization
   */
  async getTeamUtilization(projectId: string): Promise<number> {
    const team = this.teams.get(projectId);
    if (!team) {
      return 0;
    }

    const members = this.teamMembers.get(projectId);
    if (!members || members.size === 0) {
      return 0;
    }

    const busyCount = Array.from(members.values()).filter((m) => !m.isAvailable).length;
    return (busyCount / members.size) * 100;
  }

  /**
   * Get team metrics
   */
  async getTeamMetrics(projectId: string): Promise<TeamMetrics> {
    const metrics = this.teamMetrics.get(projectId);
    if (!metrics) {
      throw new Error(`Metrics not found for project ${projectId}`);
    }

    // Update metrics based on current state
    metrics.timestamp = new Date();
    metrics.utilization = await this.getTeamUtilization(projectId);

    return metrics;
  }

  /**
   * Identify bottlenecks
   */
  async identifyBottlenecks(projectId: string): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];
    const workflow = this.workflows.get(projectId);
    const metrics = this.teamMetrics.get(projectId);

    if (!workflow || !metrics) {
      return bottlenecks;
    }

    // Check phase durations for bottlenecks
    let maxDuration = 0;
    let slowestPhase = '';

    for (const [phaseName, duration] of metrics.phaseCompletionTimes) {
      if (duration > maxDuration) {
        maxDuration = duration;
        slowestPhase = phaseName;
      }
    }

    if (slowestPhase) {
      bottlenecks.push({
        bottleneckId: `bn-${Date.now()}`,
        type: 'phase',
        phase: slowestPhase,
        cause: `Phase ${slowestPhase} taking longer than others`,
        severity: maxDuration > 3600000 ? 'high' : 'medium',
        duration: maxDuration,
        impact: 'velocity',
        recommendation: `Review tasks in ${slowestPhase} phase for optimization`,
      });
    }

    // Check agent utilization for bottlenecks
    const members = this.teamMembers.get(projectId);
    if (members) {
      for (const member of members.values()) {
        const productivity = metrics.agentProductivity.get(member.agentId) || 0;
        if (productivity < 0.5) {
          bottlenecks.push({
            bottleneckId: `bn-${Date.now()}-${member.agentId}`,
            type: 'agent',
            agentId: member.agentId,
            cause: `Agent ${member.agentId} has low productivity`,
            severity: 'medium',
            duration: 0,
            impact: 'utilization',
            recommendation: `Consider reassigning tasks or providing additional support`,
          });
        }
      }
    }

    return bottlenecks;
  }

  /**
   * Recommend rebalancing
   */
  async recommendRebalancing(projectId: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const bottlenecks = await this.identifyBottlenecks(projectId);
    const members = this.teamMembers.get(projectId);

    if (!members || members.size === 0) {
      return recommendations;
    }

    // Recommend parallelization for slow phases
    for (const bottleneck of bottlenecks) {
      if (bottleneck.type === 'phase' && bottleneck.severity === 'high') {
        recommendations.push({
          type: 'parallelize',
          targetPhase: bottleneck.phase,
          reason: `${bottleneck.phase} phase is a bottleneck`,
          expectedImprovement: 20,
          confidence: 75,
        });
      }
    }

    // Recommend load balancing for underutilized agents
    const totalTasks = Array.from(members.values()).reduce((sum, m) => sum + m.taskCount, 0);
    const avgTasks = totalTasks / members.size;

    for (const member of members.values()) {
      if (member.taskCount < avgTasks * 0.5 && member.isAvailable) {
        recommendations.push({
          type: 'move_task',
          targetAgent: member.agentId,
          reason: `Agent ${member.agentId} is underutilized`,
          expectedImprovement: 10,
          confidence: 60,
        });
      }
    }

    return recommendations;
  }

  /**
   * Handle task completed event
   */
  private handleTaskCompleted(data: any): void {
    const projectId = data.projectId;
    const taskId = data.taskId;
    const agentId = data.agentId;

    // Update member stats
    const members = this.teamMembers.get(projectId);
    if (members) {
      const member = members.get(agentId);
      if (member) {
        member.completedCount++;
        member.taskCount = Math.max(0, member.taskCount - 1);
      }
    }

    // Update task completion times
    const completionMap = this.taskCompletionTimes.get(projectId);
    if (completionMap) {
      completionMap.set(taskId, new Date());
    }

    // Calculate metrics
    this.updateMetrics(projectId);
  }

  /**
   * Handle task failed event
   */
  private handleTaskFailed(data: any): void {
    const projectId = data.projectId;
    const agentId = data.agentId;

    // Update member stats
    const members = this.teamMembers.get(projectId);
    if (members) {
      const member = members.get(agentId);
      if (member) {
        member.failureCount++;
      }
    }

    // Calculate metrics
    this.updateMetrics(projectId);
  }

  /**
   * Handle agent offline event
   */
  private handleAgentOffline(data: any): void {
    const agentId = data.agentId;
    const projectId = data.projectId;

    // Mark agent as unavailable
    const members = this.teamMembers.get(projectId);
    if (members) {
      const member = members.get(agentId);
      if (member) {
        member.isAvailable = false;
      }
    }

    // Calculate metrics
    this.updateMetrics(projectId);
  }

  /**
   * Handle execution paused event
   */
  private handleExecutionPaused(data: any): void {
    const projectId = data.projectId;
    const workflow = this.workflows.get(projectId);
    if (workflow) {
      workflow.status = 'paused';
    }
  }

  /**
   * Update team metrics
   */
  private updateMetrics(projectId: string): void {
    const metrics = this.teamMetrics.get(projectId);
    if (!metrics) {
      return;
    }

    const members = this.teamMembers.get(projectId);
    const completionMap = this.taskCompletionTimes.get(projectId);

    if (!members) {
      return;
    }

    // Calculate velocity (tasks per hour)
    let totalCompleted = 0;
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    if (completionMap) {
      for (const [taskId, completedAt] of completionMap) {
        if (completedAt.getTime() > oneHourAgo) {
          totalCompleted++;
        }
      }
    }

    metrics.velocity = totalCompleted;

    // Calculate utilization
    const busyCount = Array.from(members.values()).filter((m) => !m.isAvailable).length;
    metrics.utilization = (busyCount / members.size) * 100;

    // Calculate failure rate
    const totalTasks = Array.from(members.values()).reduce((sum, m) => sum + m.completedCount + m.failureCount, 0);
    const totalFailed = Array.from(members.values()).reduce((sum, m) => sum + m.failureCount, 0);
    metrics.failureRate = totalTasks > 0 ? (totalFailed / totalTasks) * 100 : 0;

    // Calculate agent productivity - ensure all agents are in the map
    for (const member of members.values()) {
      const total = member.completedCount + member.failureCount;
      const productivity = total > 0 ? member.completedCount / total : 0;
      metrics.agentProductivity.set(member.agentId, productivity);
    }

    this.messageBus.emit('velocity:updated', {
      projectId,
      velocity: metrics.velocity,
      utilization: metrics.utilization,
      timestamp: new Date(),
    });
  }

  /**
   * Reset orchestrator state (for testing)
   */
  reset(): void {
    this.teams.clear();
    this.teamMembers.clear();
    this.workflows.clear();
    this.teamMetrics.clear();
    this.crossPhaseDependencies.clear();
    this.blockerEscalations.clear();
    this.phaseTaskMap.clear();
    this.taskCompletionTimes.clear();
  }
}

export default AgentTeamOrchestrator;
