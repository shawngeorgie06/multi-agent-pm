import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDependencies() {
  const projectId = '5febaf71-3b95-4f79-884c-293cfde2b624';

  console.log(`\n=== Checking tasks for project ${projectId} ===\n`);

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      taskId: true,
      description: true,
      status: true,
      dependencies: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${tasks.length} tasks:\n`);

  tasks.forEach((task, i) => {
    console.log(`${i + 1}. Task ${task.taskId}`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Description: ${task.description.substring(0, 60)}...`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Dependencies: ${JSON.stringify(task.dependencies)}`);
    console.log(`   CreatedAt: ${task.createdAt} (type: ${typeof task.createdAt})`);
    console.log(`   UpdatedAt: ${task.updatedAt} (type: ${typeof task.updatedAt})`);
    console.log('');
  });

  console.log('\n=== Checking TaskQueue ===\n');

  const queuedTasks = await prisma.taskQueue.findMany({
    where: { projectId },
    select: {
      id: true,
      taskId: true,
      status: true,
      claimedBy: true
    }
  });

  console.log(`Found ${queuedTasks.length} queued tasks:\n`);

  queuedTasks.forEach((qt, i) => {
    console.log(`${i + 1}. Queue entry for task ${qt.taskId}`);
    console.log(`   Status: ${qt.status}`);
    console.log(`   Claimed by: ${qt.claimedBy || 'UNCLAIMED'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkDependencies().catch(console.error);
