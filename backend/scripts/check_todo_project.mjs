import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTodoProject() {
  const projectId = '78e93315-70bd-44f9-abe6-1d6961d50541';

  console.log(`\n=== Checking todo list project ${projectId} ===\n`);

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
    console.log(`   Created: ${task.createdAt}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkTodoProject().catch(console.error);
