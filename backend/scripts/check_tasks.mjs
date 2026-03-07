import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectId = '6ccfea2c-e76c-4d7d-bec0-e8beb0eddf43';

const tasks = await prisma.task.findMany({
  where: { projectId },
  select: {
    taskId: true,
    description: true,
    status: true,
    generatedCode: true,
  },
  orderBy: { createdAt: 'asc' }
});

console.log('\n=== TASKS FOR POMODORO TIMER PROJECT ===\n');

for (const task of tasks) {
  console.log(`\n--- TASK ${task.taskId} ---`);
  console.log(`Description: ${task.description}`);
  console.log(`Status: ${task.status}`);
  
  if (task.generatedCode) {
    const code = task.generatedCode;
    const preview = code.substring(0, 500);
    console.log(`\nGenerated Code (first 500 chars):\n${preview}\n...`);
    
    // Check what type of code this is
    if (code.includes('<!DOCTYPE') || code.includes('<html')) {
      console.log('✓ Contains HTML tags');
    }
    if (code.match(/^[\s]*[.#a-z][\w-]*[\s]*\{/m)) {
      console.log('✓ Contains CSS selectors');
    }
    if (code.includes('function ') || code.includes('const ') || code.includes('document.')) {
      console.log('✓ Contains JavaScript');
    }
  } else {
    console.log('No code generated');
  }
}

await prisma.$disconnect();
