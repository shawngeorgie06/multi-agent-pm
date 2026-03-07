import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestProject() {
  const projectId = 'ae2dd374-8a7a-4bfb-92ff-e336e0cdb88a';

  console.log(`\n=== Checking project ${projectId} ===\n`);

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
    console.log(`   Description: ${task.description.substring(0, 80)}...`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Dependencies: ${JSON.stringify(task.dependencies)}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkLatestProject().catch(console.error);
