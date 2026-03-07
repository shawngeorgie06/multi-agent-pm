# Integration Implementation Plan: Phase A1 + A2
## MessageBus + Task Queue Manager

**Target Duration**: 12-16 hours
**Risk Level**: Medium
**Outcome**: Event-driven system with autonomous task claiming

---

## Phase A1: MessageBus Integration (6-8 hours)

### Goal
Replace WebSocket events with MessageBus events while maintaining existing synchronous execution.

### Key Changes

#### 1. Server Initialization (server.ts)
**Location**: `backend/src/server.ts` (around line 1-50)

**Changes**:
```typescript
// ADD these imports
import { MessageBus } from './services/MessageBus';

// ADD MessageBus instance
const messageBus = new MessageBus();

// MODIFY AgentOrchestrator initialization to pass messageBus
const orchestrator = new AgentOrchestrator({
  maxRounds: 1,
  ollamaUrl: OLLAMA_API_URL,
  ollamaModel: OLLAMA_MODEL_CODE,
  socketServer,
  messageBus,  // ← ADD THIS
  projectId,
  ollamaOptions
});
```

#### 2. AgentOrchestrator Modifications (agents/AgentOrchestrator.ts)
**Location**: `backend/src/agents/AgentOrchestrator.ts`

**Changes**:
- Accept MessageBus in constructor
- Replace all `this.socketServer.emit()` calls with `this.messageBus.emit()`
- Add bridge: subscribe to MessageBus events and forward to WebSocket
- Keep all existing logic (no behavior change, just routing)

**Events to emit**:
```typescript
// When project starts
messageBus.broadcast({
  event: 'project:started',
  projectId,
  timestamp: new Date()
});

// When message chunk arrives
messageBus.broadcast({
  event: 'message:chunk',
  projectId,
  agent: 'PROJECT_MANAGER',
  chunk: text,
  messageId
});

// When message completes
messageBus.broadcast({
  event: 'message:completed',
  projectId,
  messageId,
  agent: 'PROJECT_MANAGER'
});

// When tasks are extracted
messageBus.broadcast({
  event: 'tasks:extracted',
  projectId,
  tasks: parsedTasks,
  count: parsedTasks.length
});

// When project completes
messageBus.broadcast({
  event: 'project:completed',
  projectId,
  status: 'completed',
  timestamp: new Date()
});
```

**Bridge Implementation**:
```typescript
// In AgentOrchestrator constructor, after messageBus is set:
this.messageBus.on('message:chunk', (data) => {
  this.socketServer.emit(data.projectId, 'message_chunk', {
    agent: data.agent,
    chunk: data.chunk,
    messageId: data.messageId
  });
});

this.messageBus.on('tasks:extracted', (data) => {
  this.socketServer.emit(data.projectId, 'tasks_extracted', {
    count: data.count,
    tasks: data.tasks
  });
});

// ... similar for other events
```

#### 3. Test Compatibility Layer
- WebSocket events still work (bridge handles translation)
- Frontend sees no changes
- Both old and new systems operational simultaneously
- Allows gradual migration

### Phase A1 Success Criteria
- [ ] MessageBus initialized in server.ts
- [ ] AgentOrchestrator accepts and uses MessageBus
- [ ] All existing WebSocket events still reach frontend
- [ ] Project planning workflow still works end-to-end
- [ ] No regression in existing functionality
- [ ] Tests pass

### Phase A1 Testing
```bash
# Run existing tests
npm test

# Manual test:
# 1. Create new project
# 2. Verify project planning completes
# 3. Check WebSocket events in browser console
# 4. Verify tasks created correctly
```

---

## Phase A2: Task Queue Manager (6-8 hours)

### Goal
Add autonomous task claiming from TaskQueue. Agents claim tasks matching their capabilities.

### Key Changes

#### 1. Task Queue Population (AgentOrchestrator.ts)

When tasks are extracted from PM plan, populate TaskQueue:

```typescript
async function populateTaskQueue(projectId: string, tasks: Task[]) {
  const taskQueue = await prisma.taskQueue.createMany({
    data: tasks.map(task => ({
      taskId: task.taskId,
      projectId,
      agentType: inferAgentType(task),  // e.g., "FRONTEND", "BACKEND"
      priority: task.priority || 'MEDIUM',
      requiredCapabilities: task.requiredCapabilities || [],
      claimedBy: null,
      claimedAt: null
    }))
  });

  // Notify agents that tasks are available
  messageBus.broadcast({
    event: 'tasks:queued',
    projectId,
    count: taskQueue.count
  });
}
```

#### 2. Agent Task Listening (Each Agent)

Each agent (FrontendAgent, BackendAgent, etc.) needs to:
1. Listen for "tasks:available" events
2. Check if task matches their capabilities
3. Attempt to claim task
4. Execute if successful
5. Report completion

**Modify each agent**:
```typescript
class FrontendAgent {
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus, projectId: string) {
    this.messageBus = messageBus;

    // Listen for available tasks
    this.messageBus.on('tasks:available', async (data) => {
      if (data.projectId !== projectId) return;

      // Only process Frontend-type tasks
      if (data.agentType !== 'FRONTEND') return;

      // Try to claim task
      const claimed = await this.claimTask(data.taskId, data.projectId);
      if (claimed) {
        await this.executeTask(data);
      }
    });
  }

  async claimTask(taskId: string, projectId: string): Promise<boolean> {
    // Atomic claim via database transaction
    const result = await prisma.taskQueue.updateMany({
      where: {
        taskId,
        projectId,
        claimedBy: null  // Only claim if unclaimed
      },
      data: {
        claimedBy: 'agent-frontend-1',
        claimedAt: new Date()
      }
    });

    if (result.count === 0) {
      // Another agent claimed it first
      return false;
    }

    // Notify team
    this.messageBus.broadcast({
      event: 'task:claimed',
      projectId,
      taskId,
      agentId: 'agent-frontend-1'
    });

    return true;
  }

  async executeTask(taskData: any) {
    try {
      // Generate code
      const code = await this.generateCode(taskData.prompt);

      // Update Task
      await prisma.task.update({
        where: { id: taskData.taskId },
        data: {
          status: 'IN_PROGRESS',
          claimedBy: 'agent-frontend-1',
          claimedAt: new Date(),
          generatedCode: code
        }
      });

      // Notify completion
      this.messageBus.broadcast({
        event: 'task:completed',
        projectId: taskData.projectId,
        taskId: taskData.taskId,
        agentId: 'agent-frontend-1',
        generatedCode: code
      });

    } catch (error) {
      // Release task for retry
      this.messageBus.broadcast({
        event: 'task:failed',
        projectId: taskData.projectId,
        taskId: taskData.taskId,
        agentId: 'agent-frontend-1',
        error: error.message
      });
    }
  }
}
```

#### 3. Task Distribution Service

Create `TaskDistributionService` to:
- Watch for new tasks in TaskQueue
- Emit "tasks:available" to matching agents
- Handle task completion events
- Track queue health

```typescript
// In backend/src/services/TaskDistributionService.ts
export class TaskDistributionService {
  constructor(
    private messageBus: MessageBus,
    private taskQueueManager: TaskQueueManager
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // When tasks are queued, distribute them
    this.messageBus.on('tasks:queued', async (data) => {
      const queuedTasks = await this.taskQueueManager.getQueuedTasks(
        data.projectId
      );

      for (const task of queuedTasks) {
        // Emit to matching agent type
        this.messageBus.emit(`agent:${task.agentType}`, {
          event: 'tasks:available',
          projectId: data.projectId,
          taskId: task.taskId,
          agentType: task.agentType,
          requiredCapabilities: task.requiredCapabilities,
          priority: task.priority
        });
      }
    });

    // When task completes, update status
    this.messageBus.on('task:completed', async (data) => {
      await prisma.task.update({
        where: { id: data.taskId },
        data: {
          status: 'COMPLETE',
          completedBy: data.agentId,
          completedAt: new Date(),
          generatedCode: data.generatedCode
        }
      });

      // Forward to WebSocket for frontend
      this.socketServer.emit(data.projectId, 'task_completed', {
        taskId: data.taskId,
        agent: data.agentId
      });
    });

    // When task fails, release for retry
    this.messageBus.on('task:failed', async (data) => {
      await prisma.taskQueue.update({
        where: { taskId: data.taskId },
        data: {
          claimedBy: null,
          claimedAt: null
        }
      });
    });
  }
}
```

#### 4. Capability Matching

Use existing `TaskQueueManager.validateCapabilityMatch()`:

```typescript
// In each agent
async claimTask(taskId: string, projectId: string): Promise<boolean> {
  // Get task requirements
  const queueEntry = await prisma.taskQueue.findUnique({
    where: { taskId }
  });

  // Check if agent capabilities match
  const matches = this.taskQueueManager.validateCapabilityMatch(
    this.capabilities,  // Agent capabilities
    queueEntry.requiredCapabilities  // Task requirements
  );

  if (!matches) {
    return false;  // Skip this task, not qualified
  }

  // Proceed with claiming
  // ...
}
```

#### 5. Server Changes to Initialize Services

**In server.ts**:
```typescript
const messageBus = new MessageBus();
const taskQueueManager = new TaskQueueManager(db, messageBus);
const taskDistributionService = new TaskDistributionService(
  messageBus,
  taskQueueManager,
  socketServer
);

// Pass these to AgentOrchestrator
const orchestrator = new AgentOrchestrator({
  messageBus,
  taskQueueManager,
  taskDistributionService,
  // ... other options
});
```

### Phase A2 Database Changes

No schema changes needed - TaskQueue already exists in schema!

Just need to ensure:
```prisma
// Already in schema.prisma from Phase 1
model TaskQueue {
  id                  String    @id @default(cuid())
  taskId              String
  projectId           String
  agentType           String
  priority            String    @default("MEDIUM")
  requiredCapabilities String[]
  claimedBy           String?
  claimedAt           DateTime?

  @@unique([taskId, projectId])
}
```

### Phase A2 Success Criteria
- [ ] TaskQueue populated when PM creates tasks
- [ ] Agents listen for task:available events
- [ ] Task claiming works with capability matching
- [ ] First agent to claim wins (concurrent safety)
- [ ] Task completion updates database
- [ ] Failed tasks released back to queue
- [ ] WebSocket events still work (no regression)
- [ ] Project planning still completes end-to-end
- [ ] Tests pass for task claiming scenarios

### Phase A2 Testing
```bash
# Run new tests for task queuing
npm test -- __tests__/phase3/task-claiming.test.ts

# Manual test:
# 1. Create new project
# 2. Verify TaskQueue populated with 3 tasks
# 3. Watch agents claim tasks
# 4. Verify tasks marked as IN_PROGRESS
# 5. Verify code generation happens
# 6. Check final task status is COMPLETE
```

---

## Implementation Order

### Step 1: Phase A1 - MessageBus Integration (Days 1-2)
1. Initialize MessageBus in server.ts
2. Modify AgentOrchestrator to emit MessageBus events
3. Add WebSocket bridge for backward compatibility
4. Test existing workflows
5. Commit: "feat: Phase A1 - MessageBus integration"

### Step 2: Phase A2 - Task Queue Manager (Days 3-4)
1. Add task queue population logic
2. Create TaskDistributionService
3. Modify each agent to listen and claim tasks
4. Implement capability matching
5. Test task claiming and execution
6. Commit: "feat: Phase A2 - Autonomous task claiming"

### Step 3: Validation (Day 5)
1. Run full test suite
2. Manual end-to-end testing
3. Verify no regressions
4. Performance checks

---

## Files to Modify

### Phase A1
- ✏️ `backend/src/server.ts` - Initialize MessageBus
- ✏️ `backend/src/agents/AgentOrchestrator.ts` - Use MessageBus
- ✏️ `backend/package.json` - Add MessageBus to imports (already there)

### Phase A2
- ✏️ `backend/src/agents/AgentOrchestrator.ts` - Populate TaskQueue
- ✏️ `backend/src/agents/ProjectManagerAgent.ts` - Return structured tasks
- ✏️ `backend/src/agents/FrontendAgent.ts` - Listen and claim tasks
- ✏️ `backend/src/agents/BackendAgent.ts` - Listen and claim tasks
- ✏️ `backend/src/agents/QAAgent.ts` - Listen and claim tasks
- ✏️ `backend/src/agents/ResearchAgent.ts` - Listen and claim tasks
- ✏️ `backend/src/agents/DesignDirectorAgent.ts` - Listen and claim tasks
- ✏️ `backend/src/server.ts` - Initialize TaskDistributionService

### New Files
- ➕ `backend/src/services/TaskDistributionService.ts`

---

## Risk Mitigation

### Phase A1 Risks (Low)
- **Risk**: MessageBus events not reaching WebSocket
- **Mitigation**: Bridge pattern keeps both working simultaneously
- **Fallback**: Can disable MessageBus, use WebSocket only

### Phase A2 Risks (Medium)
- **Risk**: Race condition in task claiming
- **Mitigation**: Use database unique constraint + WHERE clause for atomicity
- **Fallback**: TaskQueue is optional, can revert to PM-assigned tasks

### Testing Strategy
1. Unit tests for each service (already exist in Phase 3-4)
2. Integration tests for agent-task workflow
3. End-to-end tests with real Ollama
4. Concurrent claim stress tests (5+ agents competing for 10+ tasks)

---

## Expected Outcomes

### After Phase A1
- ✅ Event-driven message bus in place
- ✅ WebSocket still works (backward compatible)
- ✅ Foundation for A2 and future phases
- ✅ No behavior change from user perspective

### After Phase A2
- ✅ Agents autonomously claim tasks
- ✅ Capability-based task assignment
- ✅ TaskQueue tracks all work
- ✅ Some parallelization possible (agents can work on different tasks)
- ✅ Foundation for future Phase A3 (parallel execution)

### System State After A1 + A2
```
Project Planning:
  PM creates structured tasks → Saved to Task + TaskQueue

Task Distribution:
  MessageBus broadcasts "tasks:available"
  ↓
  Agents listen and claim matching tasks
  ↓
  Task status updated as agents work

Execution:
  Agents execute claimed tasks in parallel (if multiple tasks)
  Each reports completion via MessageBus

Monitoring:
  WebSocket sees real-time task updates
  Frontend shows autonomous agent work
  Dashboard shows task queue health
```

---

## Success Metrics

- ✅ 100% of existing tests pass
- ✅ New task claiming tests pass
- ✅ Zero regressions in project planning
- ✅ Agents successfully claim 100% of tasks
- ✅ Task capability matching works accurately
- ✅ WebSocket events reach frontend in real-time
- ✅ System handles concurrent agent claims safely
- ✅ Performance: Project completes in similar time (no slowdown)

---

## Timeline Estimate

- **Phase A1**: 6-8 hours
  - 2-3 hours: MessageBus initialization and integration
  - 2-3 hours: AgentOrchestrator modifications
  - 1-2 hours: Testing and bug fixes

- **Phase A2**: 6-8 hours
  - 2-3 hours: TaskQueue population and distribution service
  - 2-3 hours: Agent modifications (5 agents × 30-40 min each)
  - 1-2 hours: Integration testing and refinement

- **Total**: 12-16 hours spread over 3-4 days

---

## Ready to Start?

Once you confirm, I'll begin with:
1. Phase A1 implementation
2. Step-by-step code changes
3. Testing as we go
4. Commit each phase separately

**Confirm and we'll launch! 🚀**
