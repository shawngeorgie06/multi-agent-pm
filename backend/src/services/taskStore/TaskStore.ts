/**
 * TaskStore — the single database boundary for the reliability handlers
 * (TaskDistributionService, AgentClaimingHelper, PhaseOrchestrator).
 *
 * Methods are named for INTENT, not CRUD, so that:
 *  - handlers read as domain logic, not DB plumbing, and
 *  - the in-memory test double can back them with plain arrays instead of
 *    re-implementing Prisma's query engine.
 */

/** A row of the Task table, narrowed to the fields these handlers actually use. */
export interface TaskRecord {
  id: string;
  projectId: string;
  taskId: string;
  status: string;
  retryCount: number;
  priority: string;
  estimatedHours?: number | null;
  dependencies: string[];
  blockerMessage: string | null;
  generatedCode: string | null;
  claimedBy: string | null;
  claimedAt: Date | null;
  completedBy: string | null;
  completedAt: Date | null;
}

/** A row of the TaskQueue table. */
export interface QueueEntry {
  id: string;
  taskId: string;
  projectId: string;
  agentType: string;
  priority: string;
  requiredCapabilities: string[];
  claimedBy: string | null;
  claimedAt: Date | null;
}

export interface EnqueueInput {
  taskId: string;
  projectId: string;
  agentType: string;
  priority: string;
  requiredCapabilities: string[];
}

export interface QueueCounts {
  total: number;
  unclaimed: number;
  claimed: number;
}

export interface UpsertTaskInput {
  projectId: string;
  taskId: string;
  description: string;
  status: string;
  priority: string;
  estimatedHours?: number;
  dependencies: string[];
  generatedCode?: string | null;
}

export interface TaskStore {
  // --- Queue lifecycle ---
  enqueueTask(input: EnqueueInput): Promise<void>;
  removeFromQueueByTask(taskId: string): Promise<void>;
  clearQueueForProject(projectId: string): Promise<void>;
  /** Unclaimed entries for a project, ordered priority asc then id asc. */
  getUnclaimedQueueEntries(projectId: string): Promise<QueueEntry[]>;
  /** Distinct projectIds that still have unclaimed queue entries. */
  getProjectsWithUnclaimedTasks(): Promise<string[]>;
  getClaimedQueueEntriesByAgent(agentId: string): Promise<QueueEntry[]>;
  /** Claimed entries whose claimedAt is older than `cutoff`. */
  getStaleClaims(projectId: string, cutoff: Date): Promise<QueueEntry[]>;
  countQueue(projectId: string): Promise<QueueCounts>;

  // --- Claiming ---
  /** Atomically claim only if still unclaimed; returns true if this caller won. */
  claimQueueEntry(taskId: string, projectId: string, agentId: string): Promise<boolean>;
  findClaimableTask(projectId: string, agentType: string): Promise<QueueEntry | null>;
  releaseQueueClaimById(queueEntryId: string): Promise<void>;
  releaseQueueClaimsByTask(taskId: string): Promise<void>;

  // --- Task records ---
  getTaskById(id: string): Promise<TaskRecord | null>;
  getTasksByProject(projectId: string): Promise<TaskRecord[]>;
  getCompletedTasks(projectId: string): Promise<TaskRecord[]>;
  findTaskByTaskIdContains(projectId: string, substring: string): Promise<TaskRecord | null>;
  upsertTask(input: UpsertTaskInput): Promise<TaskRecord>;
  markTaskComplete(id: string, data: { completedBy: string; generatedCode?: string }): Promise<TaskRecord>;
  requeueFailedTask(id: string, data: { status: string; retryCount: number }): Promise<void>;
  deadLetterTask(id: string, data: { status: string; retryCount: number; blockerMessage: string }): Promise<void>;
  saveGeneratedCode(id: string, generatedCode: string): Promise<void>;
  /** updateMany-by-taskId variants used by AgentClaimingHelper. */
  claimTaskRecord(taskId: string, agentId: string): Promise<void>;
  completeTaskRecord(taskId: string, agentId: string, generatedCode?: string): Promise<void>;
  resetTaskRecordToTodo(taskId: string): Promise<void>;

  // --- Project ---
  setProjectStatus(projectId: string, status: string): Promise<void>;
  setProjectQaReport(projectId: string, qaReportJson: string): Promise<void>;
}
