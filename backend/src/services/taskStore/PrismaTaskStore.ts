import prisma from '../../database/db.js';
import {
  TaskStore, TaskRecord, QueueEntry, EnqueueInput, QueueCounts, UpsertTaskInput,
} from './TaskStore.js';

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Production TaskStore backed by the shared Prisma client. */
export class PrismaTaskStore implements TaskStore {
  async enqueueTask(input: EnqueueInput): Promise<void> {
    try {
      await prisma.taskQueue.create({
        data: {
          taskId: input.taskId,
          projectId: input.projectId,
          agentType: input.agentType as any,
          priority: input.priority,
          requiredCapabilities: input.requiredCapabilities,
        },
      });
    } catch (err: any) {
      if (!String(err?.message).includes('Unique constraint')) throw err; // ignore dup
    }
  }
  async removeFromQueueByTask(taskId: string): Promise<void> {
    await prisma.taskQueue.deleteMany({ where: { taskId } });
  }
  async clearQueueForProject(projectId: string): Promise<void> {
    await prisma.taskQueue.deleteMany({ where: { projectId } });
  }
  async getUnclaimedQueueEntries(projectId: string): Promise<QueueEntry[]> {
    return prisma.taskQueue.findMany({
      where: { projectId, claimedBy: null },
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    }) as unknown as Promise<QueueEntry[]>;
  }
  async getProjectsWithUnclaimedTasks(): Promise<string[]> {
    const rows = await prisma.taskQueue.findMany({ where: { claimedBy: null }, distinct: ['projectId'] });
    return rows.map((r: any) => r.projectId);
  }
  async getClaimedQueueEntriesByAgent(agentId: string): Promise<QueueEntry[]> {
    return prisma.taskQueue.findMany({ where: { claimedBy: agentId } }) as unknown as Promise<QueueEntry[]>;
  }
  async getStaleClaims(projectId: string, cutoff: Date): Promise<QueueEntry[]> {
    return prisma.taskQueue.findMany({
      where: { projectId, claimedBy: { not: null }, claimedAt: { lt: cutoff } },
    }) as unknown as Promise<QueueEntry[]>;
  }
  async countQueue(projectId: string): Promise<QueueCounts> {
    const [total, unclaimed, claimed] = await Promise.all([
      prisma.taskQueue.count({ where: { projectId } }),
      prisma.taskQueue.count({ where: { projectId, claimedBy: null } }),
      prisma.taskQueue.count({ where: { projectId, claimedBy: { not: null } } }),
    ]);
    return { total, unclaimed, claimed };
  }
  async claimQueueEntry(taskId: string, projectId: string, agentId: string): Promise<boolean> {
    const result = await prisma.taskQueue.updateMany({
      where: { taskId, projectId, claimedBy: null },
      data: { claimedBy: agentId, claimedAt: new Date() },
    });
    return result.count > 0;
  }
  async findClaimableTask(projectId: string, agentType: string): Promise<QueueEntry | null> {
    // Rank-sort in JS rather than `orderBy: { priority: 'desc' }`: priority is a
    // String column, so DB ordering is lexicographic ('MEDIUM' > 'LOW' > 'HIGH'),
    // which is wrong AND would diverge from InMemoryTaskStore. This keeps the two
    // implementations consistent and returns the genuinely highest priority first.
    const rows = await prisma.taskQueue.findMany({
      where: { projectId, claimedBy: null, agentType: agentType as any },
    }) as unknown as QueueEntry[];
    return rows.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99))[0] ?? null;
  }
  async releaseQueueClaimById(queueEntryId: string): Promise<void> {
    await prisma.taskQueue.update({ where: { id: queueEntryId }, data: { claimedBy: null, claimedAt: null } });
  }
  async releaseQueueClaimsByTask(taskId: string): Promise<void> {
    await prisma.taskQueue.updateMany({ where: { taskId }, data: { claimedBy: null, claimedAt: null } });
  }
  async getTaskById(id: string): Promise<TaskRecord | null> {
    return prisma.task.findUnique({ where: { id } }) as unknown as Promise<TaskRecord | null>;
  }
  async getTasksByProject(projectId: string): Promise<TaskRecord[]> {
    return prisma.task.findMany({ where: { projectId } }) as unknown as Promise<TaskRecord[]>;
  }
  async getCompletedTasks(projectId: string): Promise<TaskRecord[]> {
    return prisma.task.findMany({ where: { projectId, status: 'COMPLETE' } }) as unknown as Promise<TaskRecord[]>;
  }
  async findTaskByTaskIdContains(projectId: string, substring: string): Promise<TaskRecord | null> {
    return prisma.task.findFirst({ where: { projectId, taskId: { contains: substring } } }) as unknown as Promise<TaskRecord | null>;
  }
  async upsertTask(input: UpsertTaskInput): Promise<TaskRecord> {
    const data = {
      description: input.description, status: input.status, priority: input.priority,
      estimatedHours: input.estimatedHours, dependencies: input.dependencies ?? [],
      generatedCode: input.generatedCode ?? null,
    };
    return prisma.task.upsert({
      where: { projectId_taskId: { projectId: input.projectId, taskId: input.taskId } },
      update: data,
      create: { projectId: input.projectId, taskId: input.taskId, ...data },
    }) as unknown as Promise<TaskRecord>;
  }
  async markTaskComplete(id: string, data: { completedBy: string; generatedCode?: string }): Promise<TaskRecord> {
    return prisma.task.update({
      where: { id },
      data: { status: 'COMPLETE', completedBy: data.completedBy, completedAt: new Date(), generatedCode: data.generatedCode ?? undefined },
    }) as unknown as Promise<TaskRecord>;
  }
  async requeueFailedTask(id: string, data: { status: string; retryCount: number }): Promise<void> {
    await prisma.task.update({ where: { id }, data: { status: data.status, retryCount: data.retryCount } });
  }
  async deadLetterTask(id: string, data: { status: string; retryCount: number; blockerMessage: string }): Promise<void> {
    await prisma.task.update({ where: { id }, data });
  }
  async saveGeneratedCode(id: string, generatedCode: string): Promise<void> {
    await prisma.task.update({ where: { id }, data: { generatedCode } });
  }
  async claimTaskRecord(taskId: string, agentId: string): Promise<void> {
    await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'IN_PROGRESS', claimedBy: agentId, claimedAt: new Date() } });
  }
  async completeTaskRecord(taskId: string, agentId: string, generatedCode?: string): Promise<void> {
    await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'COMPLETE', completedBy: agentId, completedAt: new Date(), generatedCode: generatedCode || null } });
  }
  async resetTaskRecordToTodo(taskId: string): Promise<void> {
    await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'TODO' } });
  }
  async setProjectStatus(projectId: string, status: string): Promise<void> {
    await prisma.project.update({ where: { id: projectId }, data: { status } });
  }
  async setProjectQaReport(projectId: string, qaReportJson: string): Promise<void> {
    await prisma.project.update({ where: { id: projectId }, data: { qaReport: qaReportJson } });
  }
}
