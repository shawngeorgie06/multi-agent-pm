/**
 * Mock Test Data for Agent-Teams Testing
 * Provides fixtures for projects, tasks, agents, and messages
 */

export const mockProjectData = {
  id: 'proj-test-1',
  name: 'Test Calculator App',
  description: 'Build a simple calculator with React',
  status: 'in_progress',
  designBrief: null,
  researchOutput: null,
  qaReport: null,
};

export const mockProjectDataAlternate = {
  id: 'proj-test-2',
  name: 'Test Todo App',
  description: 'Build a todo list app with persistence',
  status: 'in_progress',
};

export const mockTaskData = {
  taskId: 'PM-001',
  projectId: 'proj-test-1',
  description: 'Plan project structure and architecture',
  status: 'TODO',
  priority: 'HIGH',
  estimatedHours: 2,
  dependencies: [],
  requiredCapabilities: ['planning', 'architecture'],
  assignedAgent: null,
  claimedBy: null,
  claimedAt: null,
};

export const mockTaskDataAlternate = {
  taskId: 'FE-001',
  projectId: 'proj-test-1',
  description: 'Build frontend UI components',
  status: 'TODO',
  priority: 'HIGH',
  estimatedHours: 4,
  dependencies: ['PM-001'],
  requiredCapabilities: ['html', 'css', 'javascript'],
  assignedAgent: null,
  claimedBy: null,
  claimedAt: null,
};

export const mockTaskDataClaimed = {
  taskId: 'PM-002',
  projectId: 'proj-test-1',
  description: 'Code generation',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  estimatedHours: 3,
  dependencies: ['PM-001'],
  requiredCapabilities: ['coding'],
  assignedAgent: 'FrontendAgent',
  claimedBy: 'agent-frontend-1',
  claimedAt: new Date(),
  completedBy: null,
  completedAt: null,
};

export const mockAgentData = {
  id: 'agent-pm-1',
  agentId: 'agent-pm-1',
  agentType: 'PROJECT_MANAGER',
  status: 'idle',
  capabilities: ['planning', 'orchestration'],
  lastHeartbeat: new Date(),
};

export const mockAgentDataFrontend = {
  id: 'agent-frontend-1',
  agentId: 'agent-frontend-1',
  agentType: 'FRONTEND',
  status: 'busy',
  capabilities: ['html', 'css', 'javascript', 'responsive-design'],
  lastHeartbeat: new Date(),
  currentTaskId: 'PM-002',
};

export const mockMessageData = {
  id: 'msg-1',
  projectId: 'proj-test-1',
  fromAgent: 'PROJECT_MANAGER',
  toAgent: 'FRONTEND',
  messageType: 'TASK_ASSIGNMENT',
  content: 'Please build the frontend layout',
  taskId: 'FE-001',
  threadId: null,
  parentMessageId: null,
};

export const mockMessageDataThreaded = {
  id: 'msg-2',
  projectId: 'proj-test-1',
  fromAgent: 'FRONTEND',
  toAgent: 'PROJECT_MANAGER',
  messageType: 'BLOCKER',
  content: 'Need clarification on design requirements',
  taskId: 'FE-001',
  threadId: 'thread-1',
  parentMessageId: 'msg-1',
};

export const mockMessageDataBroadcast = {
  id: 'msg-3',
  projectId: 'proj-test-1',
  fromAgent: 'PROJECT_MANAGER',
  toAgent: 'ALL',
  messageType: 'PROJECT_STATUS',
  content: 'Project kickoff complete, all agents can begin work',
  threadId: null,
  parentMessageId: null,
};

export const mockTaskQueueEntry = {
  id: 'queue-1',
  taskId: 'FE-001',
  projectId: 'proj-test-1',
  agentType: 'FRONTEND',
  priority: 'HIGH',
  requiredCapabilities: ['html', 'css', 'javascript'],
  claimedBy: null,
  claimedAt: null,
};

export const mockTaskQueueEntryClaimed = {
  id: 'queue-2',
  taskId: 'PM-002',
  projectId: 'proj-test-1',
  agentType: 'PROJECT_MANAGER',
  priority: 'MEDIUM',
  requiredCapabilities: ['planning'],
  claimedBy: 'agent-pm-1',
  claimedAt: new Date(),
};

/**
 * Factory functions for creating test data with custom properties
 */

export function createMockProject(overrides?: Partial<typeof mockProjectData>) {
  return { ...mockProjectData, ...overrides };
}

export function createMockTask(overrides?: Partial<typeof mockTaskData>) {
  return { ...mockTaskData, ...overrides };
}

export function createMockAgent(overrides?: Partial<typeof mockAgentData>) {
  return { ...mockAgentData, ...overrides };
}

export function createMockMessage(overrides?: Partial<typeof mockMessageData>) {
  return { ...mockMessageData, ...overrides };
}

export function createMockTaskQueueEntry(overrides?: Partial<typeof mockTaskQueueEntry>) {
  return { ...mockTaskQueueEntry, ...overrides };
}

/**
 * Collection factories for common test scenarios
 */

export function createProjectWithTasks(projectCount: number = 1, tasksPerProject: number = 3) {
  const projects = [];
  for (let i = 0; i < projectCount; i++) {
    const project = createMockProject({ id: `proj-${i}`, name: `Project ${i}` });
    const tasks = [];
    for (let j = 0; j < tasksPerProject; j++) {
      tasks.push(
        createMockTask({
          projectId: project.id,
          taskId: `TASK-${j}`,
          description: `Task ${j} for project ${i}`,
        })
      );
    }
    projects.push({ project, tasks });
  }
  return projects;
}

export function createTaskClaimingScenario() {
  return {
    project: createMockProject(),
    unclaimed: [
      createMockTask({ taskId: 'T1', status: 'TODO' }),
      createMockTask({ taskId: 'T2', status: 'TODO' }),
      createMockTask({ taskId: 'T3', status: 'TODO' }),
    ],
    claimed: [
      createMockTask({
        taskId: 'T4',
        status: 'IN_PROGRESS',
        claimedBy: 'agent-1',
        claimedAt: new Date(),
      }),
      createMockTask({
        taskId: 'T5',
        status: 'IN_PROGRESS',
        claimedBy: 'agent-2',
        claimedAt: new Date(),
      }),
    ],
    completed: [
      createMockTask({
        taskId: 'T6',
        status: 'COMPLETE',
        claimedBy: 'agent-3',
        completedBy: 'agent-3',
        completedAt: new Date(),
      }),
    ],
  };
}

export function createMessageThreadingScenario() {
  const threadId = `thread-${Date.now()}`;
  return {
    root: createMockMessage({ id: 'msg-root', threadId, parentMessageId: null }),
    reply1: createMockMessage({
      id: 'msg-reply-1',
      threadId,
      parentMessageId: 'msg-root',
      fromAgent: 'FRONTEND',
    }),
    reply2: createMockMessage({
      id: 'msg-reply-2',
      threadId,
      parentMessageId: 'msg-reply-1',
      fromAgent: 'PROJECT_MANAGER',
    }),
  };
}
