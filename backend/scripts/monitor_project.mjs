import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function monitor() {
  const projectId = '72997266-d2ad-4af9-952b-b67b240798c7';

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      taskId: true,
      description: true,
      status: true,
      claimedBy: true,
      generatedCode: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n=== Project Status (${tasks.length} tasks) ===\n`);

  tasks.forEach((task, i) => {
    console.log(`${i + 1}. ${task.taskId} - ${task.status}`);
    console.log(`   ${task.description.substring(0, 80)}...`);
    if (task.claimedBy) console.log(`   Claimed by: ${task.claimedBy}`);
    if (task.generatedCode) console.log(`   Code: ${task.generatedCode.length} chars`);
    console.log('');
  });

  await prisma.$disconnect();
}

monitor().catch(console.error);
