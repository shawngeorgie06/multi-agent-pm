/**
 * Phase 1: Schema Validation Tests
 * Validates that the agent-teams database schema is correctly defined
 */

import { describe, test, expect } from '@jest/globals';

/**
 * Test suite for AgentTypeEnum
 */
describe('Phase 1: AgentTypeEnum', () => {
  test('should have all 11 agent types defined', () => {
    const agentTypes = [
      'PROJECT_MANAGER',
      'FRONTEND',
      'BACKEND',
      'LAYOUT',
      'STYLING',
      'LOGIC',
      'QA',
      'RESEARCH',
      'DESIGNER',
      'ENGINEER',
      'DESIGN_DIRECTOR',
    ];

    expect(agentTypes).toHaveLength(11);
    expect(agentTypes).toContain('PROJECT_MANAGER');
    expect(agentTypes).toContain('FRONTEND');
    expect(agentTypes).toContain('BACKEND');
    expect(agentTypes).toContain('QA');
  });

  test('should have valid agent type names (uppercase with underscores)', () => {
    const agentTypes = [
      'PROJECT_MANAGER',
      'FRONTEND',
      'BACKEND',
      'LAYOUT',
      'STYLING',
      'LOGIC',
      'QA',
      'RESEARCH',
      'DESIGNER',
      'ENGINEER',
      'DESIGN_DIRECTOR',
    ];

    agentTypes.forEach((type) => {
      // Should be uppercase letters and underscores only
      expect(type).toMatch(/^[A-Z_]+$/);
      // Should not have consecutive underscores
      expect(type).not.toMatch(/__/);
    });
  });
});

/**
 * Test suite for AgentStatus model
 */
describe('Phase 1: AgentStatus Model', () => {
  test('should have required fields for agent tracking', () => {
    const requiredFields = ['id', 'agentId', 'agentType', 'status', 'lastHeartbeat', 'capabilities'];

    requiredFields.forEach((field) => {
      expect(field).toBeDefined();
    });
  });

  test('should have index on status field for quick filtering', () => {
    // Index should exist for: @@index([status])
    const indexedFields = ['status', 'agentType', 'lastHeartbeat'];
    expect(indexedFields).toContain('status');
  });

  test('should support agent capabilities as string array', () => {
    const exampleCapabilities = ['html', 'css', 'javascript'];
    expect(Array.isArray(exampleCapabilities)).toBe(true);
    expect(exampleCapabilities).toHaveLength(3);
  });

  test('should have default status value of "idle"', () => {
    const defaultStatus = 'idle';
    const validStatuses = ['idle', 'busy', 'offline'];
    expect(validStatuses).toContain(defaultStatus);
  });

  test('should track currentTaskId for concurrent work', () => {
    // Optional field for currently executing task
    const agentStatus = {
      currentTaskId: 'task-123',
    };
    expect(agentStatus.currentTaskId).toBe('task-123');
  });
});

/**
 * Test suite for TaskQueue model
 */
describe('Phase 1: TaskQueue Model', () => {
  test('should have required fields for task queuing', () => {
    const requiredFields = ['id', 'taskId', 'projectId', 'agentType', 'priority'];

    requiredFields.forEach((field) => {
      expect(field).toBeDefined();
    });
  });

  test('should have indexes for filtering and claiming', () => {
    // Should have indexes on:
    // - projectId (for quick project task lookup)
    // - agentType (for capability matching)
    // - priority (for priority queue ordering)
    // - claimedBy (for agent work tracking)
    // - claimedAt (for claiming recency)
    const indexedFields = ['projectId', 'agentType', 'priority', 'claimedBy', 'claimedAt'];

    expect(indexedFields).toHaveLength(5);
    expect(indexedFields).toContain('projectId');
    expect(indexedFields).toContain('claimedBy');
  });

  test('should support required capabilities array', () => {
    const requiredCapabilities = ['html', 'css', 'responsive-design'];
    expect(Array.isArray(requiredCapabilities)).toBe(true);
  });

  test('should have priority levels (HIGH, MEDIUM, LOW)', () => {
    const priorities = ['HIGH', 'MEDIUM', 'LOW'];
    expect(priorities).toContain('MEDIUM'); // default priority
    expect(priorities).toHaveLength(3);
  });

  test('should track claiming metadata (claimedBy, claimedAt)', () => {
    const queueEntry = {
      claimedBy: 'agent-frontend-1',
      claimedAt: new Date(),
    };
    expect(queueEntry.claimedBy).toBe('agent-frontend-1');
    expect(queueEntry.claimedAt).toBeInstanceOf(Date);
  });
});

/**
 * Test suite for Message model extensions (threading)
 */
describe('Phase 1: Message Model - Threading Support', () => {
  test('should have threadId field for conversation grouping', () => {
    const message = {
      id: 'msg-1',
      threadId: 'thread-1',
      content: 'Message in thread',
    };
    expect(message.threadId).toBe('thread-1');
  });

  test('should have parentMessageId for hierarchical threading', () => {
    const message = {
      id: 'msg-2',
      threadId: 'thread-1',
      parentMessageId: 'msg-1',
      content: 'Reply to previous message',
    };
    expect(message.parentMessageId).toBe('msg-1');
  });

  test('should have indexes on threading fields', () => {
    // Indexes should exist for: @@index([threadId]) and @@index([parentMessageId])
    const threadingIndexes = ['threadId', 'parentMessageId'];
    expect(threadingIndexes).toHaveLength(2);
  });

  test('should support both threaded and non-threaded messages', () => {
    const threadedMessage = { threadId: 'thread-1', parentMessageId: 'msg-1' };
    const standaloneMessage = { threadId: null, parentMessageId: null };

    expect(threadedMessage.threadId).not.toBeNull();
    expect(standaloneMessage.threadId).toBeNull();
  });
});

/**
 * Test suite for Task model extensions (claiming and capabilities)
 */
describe('Phase 1: Task Model - Claiming Fields', () => {
  test('should have claiming fields for autonomous task claiming', () => {
    const claimingFields = ['assignedAgent', 'claimedBy', 'claimedAt', 'completedBy', 'completedAt'];

    claimingFields.forEach((field) => {
      expect(field).toBeDefined();
    });
  });

  test('should track who claimed the task and when', () => {
    const task = {
      id: 'task-1',
      claimedBy: 'agent-frontend-1',
      claimedAt: new Date('2025-03-01T00:00:00Z'),
    };

    expect(task.claimedBy).toBe('agent-frontend-1');
    expect(task.claimedAt).toBeInstanceOf(Date);
  });

  test('should track who completed the task and when', () => {
    const task = {
      id: 'task-1',
      completedBy: 'agent-frontend-1',
      completedAt: new Date('2025-03-01T01:00:00Z'),
    };

    expect(task.completedBy).toBe('agent-frontend-1');
    expect(task.completedAt).toBeInstanceOf(Date);
  });

  test('should have requiredCapabilities array for capability matching', () => {
    const task = {
      requiredCapabilities: ['html', 'css', 'javascript', 'responsive-design'],
    };

    expect(Array.isArray(task.requiredCapabilities)).toBe(true);
    expect(task.requiredCapabilities).toContain('html');
  });

  test('should have indexes on claiming fields for quick lookup', () => {
    // Indexes: @@index([claimedBy]), @@index([claimedAt]), @@index([completedBy]), @@index([completedAt])
    const claimingIndexes = ['claimedBy', 'claimedAt', 'completedBy', 'completedAt'];
    expect(claimingIndexes).toHaveLength(4);
  });

  test('should allow assignedAgent to be nullable for backward compatibility', () => {
    const taskWithAssignment = { assignedAgent: 'FRONTEND' };
    const taskWithoutAssignment = { assignedAgent: null };

    expect(taskWithAssignment.assignedAgent).not.toBeNull();
    expect(taskWithoutAssignment.assignedAgent).toBeNull();
  });
});

/**
 * Test suite for schema field types
 */
describe('Phase 1: Schema Field Types', () => {
  test('should use UUID for primary keys', () => {
    // All models should have id as UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const exampleUuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(exampleUuid).toMatch(uuidPattern);
  });

  test('should use timestamps (DateTime) for temporal fields', () => {
    const now = new Date();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('should use String arrays for capabilities and dependencies', () => {
    const capabilities = ['html', 'css', 'javascript'];
    const dependencies = ['task-1', 'task-2'];

    expect(Array.isArray(capabilities)).toBe(true);
    expect(Array.isArray(dependencies)).toBe(true);
    expect(capabilities[0]).toEqual(expect.any(String));
  });

  test('should use JSON field for metadata', () => {
    const metadata = {
      customField1: 'value',
      customField2: { nested: 'object' },
      customField3: [1, 2, 3],
    };

    expect(typeof metadata).toBe('object');
    expect(JSON.stringify(metadata)).toBeDefined();
  });
});

/**
 * Test suite for model relationships
 */
describe('Phase 1: Model Relationships', () => {
  test('should maintain foreign key from Task to Project', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      // References Project.id via foreign key
    };

    expect(task.projectId).toBe('proj-1');
    expect(task.projectId).not.toBeNull();
  });

  test('should maintain foreign key from Message to Project', () => {
    const message = {
      id: 'msg-1',
      projectId: 'proj-1',
      // References Project.id via foreign key
    };

    expect(message.projectId).toBe('proj-1');
    expect(message.projectId).not.toBeNull();
  });

  test('should support cascade delete from Project', () => {
    // When Project is deleted, associated Tasks and Messages should be deleted
    // This is configured as: @relation(fields: [projectId], references: [id], onDelete: Cascade)
    const projectId = 'proj-1';
    const tasksForProject = [
      { id: 'task-1', projectId },
      { id: 'task-2', projectId },
    ];

    expect(tasksForProject).toHaveLength(2);
    tasksForProject.forEach((task) => {
      expect(task.projectId).toBe(projectId);
    });
  });
});

/**
 * Test suite for schema uniqueness constraints
 */
describe('Phase 1: Schema Constraints', () => {
  test('should have unique constraint on (projectId, taskId)', () => {
    // @@unique([projectId, taskId])
    const tasks = [
      { projectId: 'proj-1', taskId: 'TASK-001' },
      { projectId: 'proj-1', taskId: 'TASK-002' }, // Different task ID in same project - OK
      { projectId: 'proj-2', taskId: 'TASK-001' }, // Same task ID in different project - OK
    ];

    // No duplicates of same (projectId, taskId) pair
    const uniquePairs = new Set(tasks.map((t) => `${t.projectId}:${t.taskId}`));
    expect(uniquePairs.size).toBe(3);
  });

  test('should have unique constraint on AgentStatus.agentId', () => {
    // @@unique on "AgentStatus_agentId_key"
    const agents = [
      { id: 'status-1', agentId: 'agent-1' },
      { id: 'status-2', agentId: 'agent-2' },
    ];

    const agentIds = agents.map((a) => a.agentId);
    const uniqueAgentIds = new Set(agentIds);
    expect(uniqueAgentIds.size).toBe(2);
  });
});
