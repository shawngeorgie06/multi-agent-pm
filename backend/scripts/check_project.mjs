import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProject() {
  const projectId = '321ae67d-c2b5-4fa1-a00b-f61498fd49d9';

  const tasks = await prisma.task.findMany({
    where: { projectId, taskId: { startsWith: 'PM-00' } },
    select: {
      taskId: true,
      description: true,
      status: true,
      generatedCode: true
    },
    orderBy: { taskId: 'asc' }
  });

  console.log(`\n=== Project ${projectId} ===\n`);

  for (const task of tasks) {
    console.log(`${task.taskId}: ${task.description.substring(0, 60)}...`);
    console.log(`Status: ${task.status}`);

    if (task.generatedCode) {
      if (task.taskId.includes('001')) {
        // HTML - show IDs
        const ids = (task.generatedCode.match(/id="[^"]+"/g) || []).slice(0, 10);
        console.log(`HTML IDs: ${ids.join(', ')}`);
      } else if (task.taskId.includes('003')) {
        // JS - show what it's trying to do
        const getEls = (task.generatedCode.match(/getElementById\(['"][^'"]+['"]\)/g) || []).slice(0, 10);
        console.log(`JS Elements: ${getEls.join(', ')}`);
      }
      console.log(`Code length: ${task.generatedCode.length} chars`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

checkProject().catch(console.error);
