/**
 * Integration test: TaskQueue must enforce a unique (taskId, projectId) so that
 * enqueueTask is idempotent at the database level.
 *
 * Background: TaskDistributionService/PhaseOrchestrator can enqueue the same task
 * more than once (e.g. a re-distribution pass after a transient failure).
 * PrismaTaskStore.enqueueTask relies on the database rejecting the duplicate with
 * a "Unique constraint" error, which it swallows. Without a @@unique on the
 * TaskQueue model that catch is dead code and duplicate queue rows pile up — the
 * same task gets handed to two agents.
 *
 * This is a real DB test: it skips (rather than fails) when no Postgres is
 * reachable, matching the other integration suites. Run `docker compose up -d
 * postgres` to enable it.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../src/database/db.js';
import { PrismaTaskStore } from '../../src/services/taskStore/PrismaTaskStore.js';
import { isDatabaseReachable } from '../fixtures/dbAvailable';

const dbAvailable = isDatabaseReachable();
const describeIntegration = dbAvailable ? describe : describe.skip;
if (!dbAvailable) {
  console.warn(
    '[integration] Skipping taskQueue-unique DB tests: DATABASE_URL is not reachable. Run `docker compose up -d postgres` to enable them.'
  );
}

describeIntegration('TaskQueue (taskId, projectId) uniqueness', () => {
  const store = new PrismaTaskStore();
  // Unique projectId per run so the test is isolated from any real data.
  const projectId = `unique-test-${Date.now()}`;
  const entry = {
    taskId: 'DUP-001',
    projectId,
    agentType: 'LAYOUT',
    priority: 'HIGH',
    requiredCapabilities: [] as string[],
  };

  beforeEach(async () => {
    await prisma.taskQueue.deleteMany({ where: { projectId } });
  });

  afterAll(async () => {
    await prisma.taskQueue.deleteMany({ where: { projectId } });
  });

  it('enqueueTask is idempotent — enqueuing the same task twice leaves one queue row', async () => {
    await store.enqueueTask(entry);
    await store.enqueueTask(entry); // duplicate: must be rejected + swallowed, not stored

    const counts = await store.countQueue(projectId);
    expect(counts.total).toBe(1);
  });
});
