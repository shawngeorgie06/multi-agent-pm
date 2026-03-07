# Testing Phase A1 + A2 Implementation

## Quick Start

### Step 1: Start Backend Server
```bash
cd C:\Users\georg\multi-agent-pm\backend
npm run dev
```

Wait for message: `[Server] Multi-agent PM backend running on port 3000`

### Step 2: Start Frontend Server (new terminal)
```bash
cd C:\Users\georg\multi-agent-pm\frontend
npm run dev
```

Wait for message: `VITE v... dev server running at: http://localhost:5173`

### Step 3: Open Application
Open browser to: **http://localhost:5173**

---

## Test Scenario 1: New Project Creation

### Steps:
1. Click "Create New Project"
2. Enter project details:
   - **Name:** "Phase A1+A2 Test"
   - **Description:** "Build a simple React counter component with styling"
3. Click "Create Project"
4. Wait for orchestration to begin

### What to Observe:

#### Console Logs (Backend Terminal):
```
[TaskQueueManager] TaskQueueManager initialized
[TaskDistribution] Populating queue with N tasks
[TaskDistribution] Distributed N unclaimed tasks
[TaskDistribution] Emitted task:available for TASK-001 to AGENT_TYPE
[AgentClaimingHelper] Successfully claimed task TASK-001
```

#### Frontend Display:
- Project status shows "Planning" → "In Progress"
- Activity feed displays:
  - "Project planning started"
  - "Tasks extracted from plan"
  - "Tasks queued for agents" (NEW - Phase A1)
  - "Agent claimed task TASK-001" (NEW - Phase A2)

#### Task List:
- Each task should show:
  - Task ID (e.g., FE-001, BE-001)
  - Description
  - Status (TODO → IN_PROGRESS → COMPLETE)
  - Claimed by agent name (NEW - Phase A2)

---

## Test Scenario 2: Verify MessageBus Integration

### What Changed:
- Events now flow through both WebSocket (existing) and MessageBus (new)
- MessageBus enables async agent coordination

### Verification Points:

#### 1. Event Broadcasting
- Open DevTools Console (F12)
- Create a project
- Look for WebSocket messages containing:
  - `task:claimed` events
  - `queue:populated` notifications
  - `task:available` messages

#### 2. Task Distribution
- In backend console, verify output sequence:
  1. `tasks:extracted` event received
  2. `Populating queue with X tasks`
  3. `Distributing X unclaimed tasks`
  4. `Emitted task:available` for each task

---

## Test Scenario 3: Verify Task Queue System

### What Changed:
- New `TaskQueue` database table stores waiting tasks
- Agents claim tasks using atomic database updates
- Prevents race conditions if multiple agents try to claim same task

### Verification Points:

#### 1. Queue Population
- Create project and extract tasks
- Check backend console for: `Populated queue with X entries`

#### 2. Task Claiming
- Observe console messages like: `Successfully claimed task FE-001`
- Verify each task claimed by exactly one agent
- Frontend should show "Claimed by: [AgentName]"

#### 3. No Race Conditions
- Multiple "claim attempt" logs should exist
- Only ONE should succeed per task
- Others show: `Task already claimed by another agent`

---

## Test Scenario 4: Capability Validation

### What Changed:
- Agents only claim tasks they have capabilities for
- Case-insensitive matching (html = HTML = Html)
- Superset logic (agent with [html,css,js] can claim task needing [html,css])

### Verification Points:

#### Expected Task Assignments:
- **PM Agent:** Tasks with `planning` capability
- **Frontend Agent:** Tasks with `html, css, javascript` capabilities
- **Backend Agent:** Tasks with `nodejs, express` capabilities
- **QA Agent:** Tasks with `testing, qa` capabilities

#### In Console:
- Look for validation logs indicating capability checks
- Mismatched agents should skip claiming unmatched tasks

---

## Test Scenario 5: Backward Compatibility

### What Changed:
- Old way of creating projects/tasks still works
- New fields (claimedBy, claimedAt, etc.) are optional
- Existing workflows unchanged

### Verification Points:

1. Create project and manually inspect database:
```bash
# In PostgreSQL terminal
SELECT id, name, status FROM "Project" LIMIT 1;
SELECT id, taskId, status, "claimedBy", "claimedAt" FROM "Task" LIMIT 3;
```

2. New fields should be NULL for legacy tasks, populated for new ones

3. Project operations unchanged:
   - Create project ✓
   - List projects ✓
   - Update project status ✓
   - Delete project ✓

---

## Expected vs Actual Behavior

### Phase A1 (MessageBus)
**Expected:** Events route through both WebSocket and MessageBus
**How to Verify:** Backend console shows MessageBus broadcast logs

### Phase A2 (Task Queue & Claiming)
**Expected:**
- Tasks appear in TaskQueue after extraction
- Agents claim tasks atomically
- Only one agent per task

**How to Verify:**
```sql
-- Check TaskQueue entries
SELECT taskId, "claimedBy", "agentType", priority FROM "TaskQueue" WHERE "projectId" = 'PROJECT_ID';

-- Should show:
-- FE-001 | agent-fe-1  | FRONTEND  | HIGH
-- BE-001 | agent-be-1  | BACKEND   | MEDIUM
-- PM-001 | agent-pm-1  | PROJECT_MANAGER | HIGH
```

---

## Performance Metrics to Check

### Startup Time
- Backend starts within 3 seconds
- Frontend loads within 5 seconds

### Task Distribution Speed
- Project created → Tasks in queue: < 1 second
- Tasks distributed to agents: < 2 seconds
- First task claimed: < 3 seconds

### No Race Conditions
- Check logs for "already claimed by another agent" messages
- Should be minimal/zero (only if agents claim simultaneously)

---

## Common Issues & Solutions

### Issue: No task claiming messages in console
**Solution:**
- Ensure backend is running in dev mode (shows logs)
- Check that agents are enabled
- Verify MessageBus initialized: look for `[MessageBus]` logs

### Issue: Tasks show but not "Claimed by" agent
**Solution:**
- Refresh page to see updated status
- Check database directly (see SQL above)
- Look for errors in backend console

### Issue: All tasks claimed by single agent
**Solution:**
- This is OK if that agent has all required capabilities
- Check task requirements vs agent capabilities
- Backend console should show why other agents skipped claiming

### Issue: Application crashes after creating project
**Solution:**
- Check backend console for errors
- Verify database connection is active
- Check Ollama is running: `curl http://localhost:11434/api/tags`

---

## Success Criteria

✅ **Phase A1 + A2 Implementation is Working When:**

1. ✅ Project creates without errors
2. ✅ Tasks appear in task list
3. ✅ Backend console shows MessageBus events
4. ✅ Backend shows "Populating queue with X tasks"
5. ✅ Backend shows "Successfully claimed task X"
6. ✅ Frontend shows "Claimed by: [Agent]" for each task
7. ✅ Each task claimed by exactly one agent
8. ✅ Capability matching is respected
9. ✅ No race condition messages in logs
10. ✅ Database TaskQueue table has entries

---

## Next Steps After Testing

If all tests pass:
- ✅ Phase A1 + A2 is VALIDATED and WORKING
- Ready for Phase A3 (Parallel Execution)
- Ready for Phase A4 (Team Orchestration)

If issues found:
- 1. Check backend console for error messages
- 2. Verify database connections
- 3. Run: `npm test -- __tests__/integration/phase-a1-a2-simple.test.ts`
- 4. Review error logs and debug

---

## Debugging

### Enable Verbose Logging
In backend `src/server.ts`, add:
```typescript
process.env.DEBUG = 'taskqueue:*,messagebus:*,distribution:*';
```

### Check Database State
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# List all projects
SELECT id, name, status FROM "Project";

# List all tasks for a project
SELECT id, taskId, status, "claimedBy", "claimedAt" FROM "Task" WHERE "projectId" = 'PROJECT_ID';

# List all queued tasks
SELECT id, taskId, "projectId", "agentType", "claimedBy", "claimedAt" FROM "TaskQueue";
```

### Monitor Real-Time Events
In browser console, add listener:
```javascript
// Monitor WebSocket events
const originalWS = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
  console.log('[WS OUT]', data);
  return originalWS.call(this, data);
};
```
