import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectId = '8c5e1905-e546-4f71-80e0-9103f535e89c';

const project = await prisma.project.findUnique({
  where: { id: projectId },
  include: {
    tasks: {
      select: {
        taskId: true,
        description: true,
        status: true,
        generatedCode: true,
      },
      orderBy: { createdAt: 'asc' }
    }
  }
});

if (!project) {
  console.log('Project not found');
  process.exit(1);
}

console.log('\n=== PROJECT ===');
console.log('Name:', project.name);
console.log('Description:', project.description);
console.log('Status:', project.status);

console.log('\n=== TASKS ===');
for (const task of project.tasks) {
  console.log(`\n${task.taskId}: ${task.description}`);
  console.log('Status:', task.status);
  if (task.generatedCode) {
    console.log('Code length:', task.generatedCode.length, 'chars');
    console.log('Preview:', task.generatedCode.substring(0, 200).replace(/\n/g, ' '));
  } else {
    console.log('No code generated');
  }
}

await prisma.$disconnect();
