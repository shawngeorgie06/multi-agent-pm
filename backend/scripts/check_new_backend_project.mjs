import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNewProject() {
  const projectId = 'c20da290-8cb0-45b7-be27-2cae4dff1cc9';

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

checkNewProject().catch(console.error);
