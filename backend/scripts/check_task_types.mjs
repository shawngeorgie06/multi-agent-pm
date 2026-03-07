import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTaskTypes() {
  const tasks = await prisma.task.findMany({
    where: {
      projectId: '3ce3c745-cc42-4ef7-b04b-1f4ec887f497',
      taskId: {
        in: ['PM-004-3ce3c745', 'PM-005-3ce3c745', 'PM-006-3ce3c745']
      }
    },
    select: {
      taskId: true,
      assignedAgent: true,
      completedBy: true,
      description: true,
      status: true,
      requiredCapabilities: true
    }
  });

  console.log(JSON.stringify(tasks, null, 2));
  await prisma.$disconnect();
}

checkTaskTypes().catch(console.error);
