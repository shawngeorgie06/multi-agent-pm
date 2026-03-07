import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCurrentProject() {
  const projectId = 'b4eaa88b-9900-4a03-bc8f-83e7a2b07e76';

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

checkCurrentProject().catch(console.error);
