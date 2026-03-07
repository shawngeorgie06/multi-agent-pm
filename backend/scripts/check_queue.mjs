import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQueue() {
  const projectId = '78e93315-70bd-44f9-abe6-1d6961d50541';

  console.log(`\n=== Checking TaskQueue for project ${projectId} ===\n`);

  const queuedTasks = await prisma.taskQueue.findMany({
    where: { projectId },
    select: {
      id: true,
      taskId: true,
      agentType: true,
      claimedBy: true,
      priority: true
    }
  });

  console.log(`Found ${queuedTasks.length} queued tasks:\n`);

  queuedTasks.forEach((qt, i) => {
    console.log(`${i + 1}. TaskQueue entry`);
    console.log(`   Task ID (UUID): ${qt.taskId}`);
    console.log(`   Agent Type: ${qt.agentType}`);
    console.log(`   Priority: ${qt.priority}`);
    console.log(`   Claimed by: ${qt.claimedBy || 'UNCLAIMED'}`);
    console.log('');
  });

  // Also show tasks
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, taskId: true, status: true, dependencies: true }
  });

  console.log(`\n=== Tasks ===\n`);
  tasks.forEach(t => {
    console.log(`${t.taskId}: Status=${t.status}, Deps=${JSON.stringify(t.dependencies)}, UUID=${t.id}`);
  });

  await prisma.$disconnect();
}

checkQueue().catch(console.error);
