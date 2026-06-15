import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      tasks: {
        select: {
          id: true,
          taskId: true,
          description: true,
          status: true,
          generatedCode: true,
          assignedAgent: true
        }
      }
    }
  });

  console.log(JSON.stringify(projects, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
