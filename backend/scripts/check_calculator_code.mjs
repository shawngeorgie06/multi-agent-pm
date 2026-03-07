import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCalculatorCode() {
  const projectId = '3ce3c745-cc42-4ef7-b04b-1f4ec887f497';

  console.log(`\n=== Checking calculator generated code ===\n`);

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      taskId: {
        in: ['PM-001-3ce3c745', 'PM-002-3ce3c745', 'PM-003-3ce3c745']
      }
    },
    select: {
      taskId: true,
      description: true,
      generatedCode: true
    },
    orderBy: { taskId: 'asc' }
  });

  for (const task of tasks) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Task: ${task.taskId}`);
    console.log(`Description: ${task.description.substring(0, 80)}...`);
    console.log(`${'='.repeat(80)}\n`);

    if (task.generatedCode) {
      // For HTML, extract just the IDs
      if (task.taskId.includes('PM-001')) {
        const idMatches = task.generatedCode.match(/id="([^"]+)"/g) || [];
        console.log(`HTML Element IDs Found:`);
        idMatches.forEach(match => console.log(`  - ${match}`));
        console.log(`\nFirst 500 chars of HTML:`);
        console.log(task.generatedCode.substring(0, 500));
      }

      // For JavaScript, show which IDs it's trying to use
      if (task.taskId.includes('PM-003')) {
        const getElementByIdMatches = task.generatedCode.match(/getElementById\(['"]([^'"]+)['"]\)/g) || [];
        console.log(`JavaScript getElementById calls:`);
        getElementByIdMatches.forEach(match => console.log(`  - ${match}`));
        console.log(`\nFirst 800 chars of JavaScript:`);
        console.log(task.generatedCode.substring(0, 800));
      }

      // For CSS, show first part
      if (task.taskId.includes('PM-002')) {
        console.log(`First 400 chars of CSS:`);
        console.log(task.generatedCode.substring(0, 400));
      }
    } else {
      console.log('No generated code found.');
    }
  }

  await prisma.$disconnect();
}

checkCalculatorCode().catch(console.error);
