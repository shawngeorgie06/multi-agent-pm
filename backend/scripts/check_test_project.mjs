import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestProject() {
  const projectId = '6f76d38a-dbd6-4fb7-a24a-00f9f749620e';

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
    console.log(`   Description: ${task.description.substring(0, 120)}...`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Dependencies: ${JSON.stringify(task.dependencies)}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkTestProject().catch(console.error);
