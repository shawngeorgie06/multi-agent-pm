import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllHTML() {
  const projectId = '3ce3c745-cc42-4ef7-b04b-1f4ec887f497';

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      taskId: true,
      description: true,
      generatedCode: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n=== Checking all HTML tasks ===\n`);

  tasks.forEach(t => {
    if (t.generatedCode && t.generatedCode.includes('<!DOCTYPE') && t.generatedCode.includes('<html')) {
      console.log(`Found HTML task: ${t.taskId}`);
      console.log(`Description: ${t.description.substring(0, 100)}`);

      const bodyMatch = t.generatedCode.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        console.log(`Body content (first 600 chars):`);
        console.log(bodyMatch[1].substring(0, 600));
      }

      console.log(`\n${'='.repeat(80)}\n`);
    }
  });

  await prisma.$disconnect();
}

checkAllHTML().catch(console.error);
