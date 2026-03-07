import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const taskIds = [
  '756e133e-1985-4add-b1a7-3addd07e8a60',
  '370d0948-c6fb-484e-9c61-535e0d4adbb2',
  'f7faff2c-c398-4904-b214-130407eb8537'
];

for (const id of taskIds) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { taskId: true, description: true, projectId: true, generatedCode: true }
  });
  
  if (task) {
    console.log('\n--- TASK', id.substring(0, 8), '---');
    console.log('TaskID:', task.taskId);
    console.log('Project:', task.projectId.substring(0, 8));
    console.log('Description:', task.description.substring(0, 80));
    console.log('Code:', task.generatedCode ? task.generatedCode.length + ' chars' : 'None');
  }
}

await prisma.$disconnect();
