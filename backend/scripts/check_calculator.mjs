import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCalculator() {
  const projectId = '3ce3c745-cc42-4ef7-b04b-1f4ec887f497';

  console.log(`\n=== Checking calculator project ${projectId} ===\n`);

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
    console.log(`   Description: ${task.description.substring(0, 100)}...`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Dependencies: ${JSON.stringify(task.dependencies)}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkCalculator().catch(console.error);
