import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGeneratedCode() {
  const projectId = '5febaf71-3b95-4f79-884c-293cfde2b624';

  console.log(`\n=== Checking generated code for project ${projectId} ===\n`);

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      taskId: true,
      description: true,
      status: true,
      generatedCode: true
    },
    orderBy: { createdAt: 'asc' }
  });

  tasks.forEach((task, i) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Task ${task.taskId}: ${task.description.substring(0, 60)}...`);
    console.log(`Status: ${task.status}`);
    console.log(`${'='.repeat(80)}\n`);

    if (task.generatedCode) {
      console.log(task.generatedCode);
    } else {
      console.log('NO CODE GENERATED');
    }
    console.log('\n');
  });

  await prisma.$disconnect();
}

checkGeneratedCode().catch(console.error);
