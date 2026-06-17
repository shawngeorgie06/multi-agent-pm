import {
  TaskStore, TaskRecord, QueueEntry, EnqueueInput, QueueCounts, UpsertTaskInput,
} from './TaskStore.js';

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Test double for TaskStore. Backs the contract with plain arrays. */
export class InMemoryTaskStore implements TaskStore {
  private tasks: TaskRecord[] = [];
  private queue: QueueEntry[] = [];
  private projects: Map<string, { status?: string; qaReport?: string }> = new Map();
  private idSeq = 0;

  // --- test seam helpers (not part of TaskStore) ---
  seedTask(partial: Partial<TaskRecord> & { id: string; taskId: string; projectId: string }): TaskRecord {
    const rec: TaskRecord = {
      status: 'TODO', retryCount: 0, priority: 'MEDIUM', dependencies: [],
      blockerMessage: null, generatedCode: null, claimedBy: null, claimedAt: null,
      completedBy: null, completedAt: null, ...partial,
    };
    this.tasks.push(rec);
    return rec;
  }
  setClaimedAt(taskId: string, when: Date): void {
    const e = this.queue.find(q => q.taskId === taskId);
    if (e) e.claimedAt = when;
  }

  // --- Queue lifecycle ---
  /**
   * Enqueue a task idempotently. The real TaskQueue table has a
   * `@@unique([taskId, projectId])`, so a duplicate enqueue is rejected by the DB
   * and swallowed by PrismaTaskStore.enqueueTask. This fake mirrors that: a task
   * may sit in the queue at most once per project.
   */
  async enqueueTask(input: EnqueueInput): Promise<void> {
    if (this.queue.some(q => q.taskId === input.taskId && q.projectId === input.projectId)) return;
    this.queue.push({ id: `q-${this.idSeq++}`, claimedBy: null, claimedAt: null, ...input });
  }
  async removeFromQueueByTask(taskId: string): Promise<void> {
    this.queue = this.queue.filter(q => q.taskId !== taskId);
  }
  async clearQueueForProject(projectId: string): Promise<void> {
    this.queue = this.queue.filter(q => q.projectId !== projectId);
  }
  async getUnclaimedQueueEntries(projectId: string): Promise<QueueEntry[]> {
    return this.queue
      .filter(q => q.projectId === projectId && q.claimedBy === null)
      .sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || a.id.localeCompare(b.id));
  }
  async getProjectsWithUnclaimedTasks(): Promise<string[]> {
    return [...new Set(this.queue.filter(q => q.claimedBy === null).map(q => q.projectId))];
  }
  async getClaimedQueueEntriesByAgent(agentId: string): Promise<QueueEntry[]> {
    return this.queue.filter(q => q.claimedBy === agentId);
  }
  async getStaleClaims(projectId: string, cutoff: Date): Promise<QueueEntry[]> {
    return this.queue.filter(q =>
      q.projectId === projectId && q.claimedBy !== null && q.claimedAt !== null && q.claimedAt < cutoff);
  }
  async countQueue(projectId: string): Promise<QueueCounts> {
    const inProj = this.queue.filter(q => q.projectId === projectId);
    const claimed = inProj.filter(q => q.claimedBy !== null).length;
    return { total: inProj.length, unclaimed: inProj.length - claimed, claimed };
  }

  // --- Claiming ---
  async claimQueueEntry(taskId: string, projectId: string, agentId: string): Promise<boolean> {
    const e = this.queue.find(q => q.taskId === taskId && q.projectId === projectId && q.claimedBy === null);
    if (!e) return false;
    e.claimedBy = agentId;
    e.claimedAt = new Date();
    return true;
  }
  async findClaimableTask(projectId: string, agentType: string): Promise<QueueEntry | null> {
    return this.queue
      .filter(q => q.projectId === projectId && q.claimedBy === null && q.agentType === agentType)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0] ?? null;
  }
  async releaseQueueClaimById(queueEntryId: string): Promise<void> {
    const e = this.queue.find(q => q.id === queueEntryId);
    if (e) { e.claimedBy = null; e.claimedAt = null; }
  }
  async releaseQueueClaimsByTask(taskId: string): Promise<void> {
    for (const e of this.queue.filter(q => q.taskId === taskId)) { e.claimedBy = null; e.claimedAt = null; }
  }

  // --- Task records ---
  async getTaskById(id: string): Promise<TaskRecord | null> {
    return this.tasks.find(t => t.id === id) ?? null;
  }
  async getTasksByProject(projectId: string): Promise<TaskRecord[]> {
    return this.tasks.filter(t => t.projectId === projectId);
  }
  async getCompletedTasks(projectId: string): Promise<TaskRecord[]> {
    return this.tasks.filter(t => t.projectId === projectId && t.status === 'COMPLETE');
  }
  async findTaskByTaskIdContains(projectId: string, substring: string): Promise<TaskRecord | null> {
    return this.tasks.find(t => t.projectId === projectId && t.taskId.includes(substring)) ?? null;
  }
  async upsertTask(input: UpsertTaskInput): Promise<TaskRecord> {
    const existing = this.tasks.find(t => t.projectId === input.projectId && t.taskId === input.taskId);
    if (existing) {
      Object.assign(existing, {
        description: input.description, status: input.status, priority: input.priority,
        estimatedHours: input.estimatedHours ?? null, dependencies: input.dependencies ?? [],
        generatedCode: input.generatedCode ?? null,
      });
      return existing;
    }
    return this.seedTask({
      id: `task-${this.idSeq++}`, taskId: input.taskId, projectId: input.projectId,
      status: input.status, priority: input.priority, estimatedHours: input.estimatedHours ?? null,
      dependencies: input.dependencies ?? [], generatedCode: input.generatedCode ?? null,
    });
  }
  async markTaskComplete(id: string, data: { completedBy: string; generatedCode?: string }): Promise<TaskRecord> {
    const t = this.tasks.find(x => x.id === id);
    if (!t) throw new Error(`task ${id} not found`);
    t.status = 'COMPLETE'; t.completedBy = data.completedBy; t.completedAt = new Date();
    if (data.generatedCode !== undefined) t.generatedCode = data.generatedCode;
    return t;
  }
  async requeueFailedTask(id: string, data: { status: string; retryCount: number }): Promise<void> {
    const t = this.tasks.find(x => x.id === id);
    if (t) { t.status = data.status; t.retryCount = data.retryCount; }
  }
  async deadLetterTask(id: string, data: { status: string; retryCount: number; blockerMessage: string }): Promise<void> {
    const t = this.tasks.find(x => x.id === id);
    if (t) { t.status = data.status; t.retryCount = data.retryCount; t.blockerMessage = data.blockerMessage; }
  }
  async saveGeneratedCode(id: string, generatedCode: string): Promise<void> {
    const t = this.tasks.find(x => x.id === id);
    if (t) t.generatedCode = generatedCode;
  }
  async claimTaskRecord(taskId: string, agentId: string): Promise<void> {
    for (const t of this.tasks.filter(x => x.id === taskId)) {
      t.status = 'IN_PROGRESS'; t.claimedBy = agentId; t.claimedAt = new Date();
    }
  }
  async completeTaskRecord(taskId: string, agentId: string, generatedCode?: string): Promise<void> {
    for (const t of this.tasks.filter(x => x.id === taskId)) {
      t.status = 'COMPLETE'; t.completedBy = agentId; t.completedAt = new Date();
      t.generatedCode = generatedCode ?? null;
    }
  }
  async resetTaskRecordToTodo(taskId: string): Promise<void> {
    for (const t of this.tasks.filter(x => x.id === taskId)) t.status = 'TODO';
  }

  // --- Project ---
  async setProjectStatus(projectId: string, status: string): Promise<void> {
    this.projects.set(projectId, { ...this.projects.get(projectId), status });
  }
  async setProjectQaReport(projectId: string, qaReportJson: string): Promise<void> {
    this.projects.set(projectId, { ...this.projects.get(projectId), qaReport: qaReportJson });
  }
}
