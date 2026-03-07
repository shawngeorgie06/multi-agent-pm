import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { SocketServer } from './websocket/SocketServer.js';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';
import { MessageBus } from './services/MessageBus.js';
import { PhaseOrchestrator } from './services/PhaseOrchestrator.js';
import { TaskQueueManager } from './services/TaskQueueManager.js';
import { TaskDistributionService } from './services/TaskDistributionService.js';
import type { OllamaOptions } from './services/OllamaService.js';
import { GeminiService } from './services/GeminiService.js';
import { detectTemplate } from './templates/utils.js';
import prisma from './database/db.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const socketServer = new SocketServer(httpServer);
const messageBus = new MessageBus();

const PORT = process.env.PORT || 5555;

// Initialize Gemini API service
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('[SERVER] GEMINI_API_KEY not found in environment variables');
  process.exit(1);
}

const generationService = new GeminiService(
  GEMINI_API_KEY,
  'gemini-2.5-flash',  // Gemini 2.5 Flash (current stable model, fast & free)
  {
    temperature: 0.7,
    maxOutputTokens: 20000,  // High limit for complete multi-task responses
    topP: 0.95,
    topK: 40
  }
);

console.log('[SERVER] Using Gemini API (gemini-2.5-flash) for code generation');

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Health check endpoint
// ============================================================================
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Quote API endpoint
app.get('/api/quote', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://zenquotes.io/api/random');
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    if (!data[0] || !data[0].q || !data[0].a) throw new Error('Invalid response');
    res.json({ q: data[0].q, a: data[0].a });
  } catch (error) {
    res.status(500).json({ error: 'Could not load quote' });
  }
});

// ============================================================================
// GET PROJECTS ENDPOINT - List all projects
// ============================================================================
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(projects);
  } catch (error) {
    console.error('[SERVER] Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ============================================================================
// GET PROJECT BY ID ENDPOINT
// ============================================================================
app.get('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        messages: {
          select: {
            id: true,
            projectId: true,
            fromAgent: true,
            toAgent: true,
            messageType: true,
            content: true,
            codeOutput: true,
            createdAt: true,
          },
        },
        tasks: {
          select: {
            id: true,
            projectId: true,
            taskId: true,
            description: true,
            status: true,
            priority: true,
            estimatedHours: true,
            actualHours: true,
            dependencies: true,
            blockerMessage: true,
            generatedCode: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('[SERVER] Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ============================================================================
// PREVIEW GENERATED CODE ENDPOINT
// ============================================================================
app.get('/api/projects/:projectId/tasks/:taskId/preview', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Get all tasks for the project
    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    // Combine separate HTML/CSS/JS tasks - ONLY use PM-001, PM-002, PM-003
    // Ignore other tasks that may have generated code (like meta-discussion tasks)
    let htmlCode = '';
    let cssCode = '';
    let jsCode = '';

    for (const task of tasks) {
      if (task.generatedCode) {
        const code = task.generatedCode;
        const lower = code.toLowerCase();

        // Only use standard implementation tasks (PM-001, PM-002, PM-003)
        const isStandardTask = task.taskId.startsWith('PM-001') ||
                              task.taskId.startsWith('PM-002') ||
                              task.taskId.startsWith('PM-003');

        if (!isStandardTask) {
          continue; // Skip non-standard tasks
        }

        // HTML task (PM-001) - must NOT contain CSS or JS markers
        if ((lower.includes('<!doctype') || lower.includes('<html') || lower.includes('<body')) &&
            !lower.includes('body {') && !lower.includes('function ') && !code.match(/^[\s]*[.#a-z]/m)) {
          if (!htmlCode) { // Only use the first HTML found
            htmlCode = code;
          }
        }
        // CSS task (PM-002) - must have CSS selectors or rules
        else if ((code.match(/^[\s]*[.#a-z][\w-]*[\s]*\{/m) || // Starts with selector {
                  code.match(/[\s]*[.#a-z][\w-]*[\s]*\{[\s\S]*?}/m) || // Contains selector { ... }
                  (code.includes(':') && code.includes('{') && code.includes(';'))) &&
                 !lower.includes('<!doctype') && !lower.includes('<html') && !lower.includes('<div')) {
          if (!cssCode) { // Only use the first CSS found
            cssCode = code;
          }
        }
        // JS task (PM-003) - must have JS code markers
        else if ((code.includes('const ') || code.includes('function ') || code.includes('let ') || code.includes('document.')) &&
                 !lower.includes('<!doctype') && !lower.includes('<html')) {
          if (!jsCode) { // Only use the first JS found
            jsCode = code;
          }
        }
      }
    }

    // If no HTML found, return error
    if (!htmlCode) {
      res.status(404).json({ error: 'No HTML code generated yet' });
      return;
    }

    // Extract body content from HTML (remove DOCTYPE, html, head, and body tags)
    let bodyContent = htmlCode
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .trim();

    // Build complete page with embedded CSS and JS
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated App</title>
    <style>
${cssCode}
    </style>
</head>
<body>
${bodyContent}
    <script>
${jsCode}
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[SERVER] Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// ============================================================================
// START PROJECT ENDPOINT - Three-Phase Orchestration
// ============================================================================
app.post('/api/projects', async (req: Request, res: Response) => {
  const { name, description } = req.body;

  // Validate input
  if (!name || !description) {
    res.status(400).json({ error: 'Missing required fields: name, description' });
    return;
  }

  // Create project
  const project = await prisma.project.create({
    data: {
      name,
      description,
      status: 'in_progress',
    },
  });

  const projectId = project.id;
  const userRequest = description;

  // Send project ID back immediately
  res.json({ projectId });

  // Start orchestration asynchronously
  console.log(`\n[SERVER] Starting orchestration for project ${projectId}`);
  console.log(`[SERVER] User Request: ${userRequest}\n`);

  // ========================================================================
  // THREE-PHASE ORCHESTRATION
  // ========================================================================
  try {
    // Create orchestrator and dependencies
    const agentOrchestrator = new AgentOrchestrator(
      1,
      generationService,
      socketServer,
      projectId,
      messageBus
    );

    const taskQueueManager = new TaskQueueManager(undefined, messageBus);
    const taskDistributionService = new TaskDistributionService(messageBus, taskQueueManager, socketServer);

    const phaseOrchestrator = new PhaseOrchestrator(
      agentOrchestrator,
      messageBus,
      taskDistributionService,
      socketServer
    );

    // ====================================================================
    // PHASE 1: ORCHESTRATION (PM/Engineer planning)
    // ====================================================================
    console.log('\n[SERVER] Starting Phase 1: Orchestration');
    const phase1Output = await phaseOrchestrator.phase1Orchestration(userRequest, projectId);

    // Save design brief
    const designBrief = agentOrchestrator.getDesignBrief();
    if (designBrief) {
      await prisma.project.update({
        where: { id: projectId },
        data: { designBrief: designBrief.raw },
      });
    }

    // Save all messages from orchestration
    const messages = agentOrchestrator.getAllMessages();
    for (const msg of messages) {
      const savedMessage = await prisma.message.create({
        data: {
          projectId,
          fromAgent: msg.fromAgent,
          toAgent: msg.toAgent,
          messageType: msg.messageType,
          content: msg.content,
          codeOutput: msg.codeOutput,
          metadata: msg.metadata as any,
        },
      });

      const streamingMessageId = (msg.metadata as Record<string, unknown>)?.streamingMessageId as string | undefined;
      socketServer.emitAgentMessage(projectId, savedMessage, streamingMessageId);
    }

    // ====================================================================
    // PHASE 2: PREPARATION (TaskQueue population & agent startup)
    // ====================================================================
    console.log('\n[SERVER] Starting Phase 2: Preparation');
    const phase2Output = await phaseOrchestrator.phase2Preparation(phase1Output);

    socketServer.emitTasksReady(projectId, phase2Output.queuedTaskCount);

    // ====================================================================
    // PHASE 3: EXECUTION (Parallel agent execution)
    // ====================================================================
    console.log('\n[SERVER] Starting Phase 3: Execution');
    await phaseOrchestrator.phase3Execution(phase2Output);

    console.log('\n[SERVER] ✅ All phases complete - agents executing autonomously\n');
  } catch (error) {
    console.error('[SERVER] ❌ Orchestration workflow failed:', error);
    socketServer.emitProjectStatus(
      projectId,
      'failed',
      `Workflow failed: ${error instanceof Error ? error.message : String(error)}`
    );

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'failed' },
    });
  }
});

// ============================================================================
// Start server
// ============================================================================
httpServer.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 MULTI-AGENT PM BACKEND`);
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`AI Service: Gemini API (gemini-1.5-flash)`);
  console.log(`Connected clients: ${socketServer.getConnectedClientCount()}`);
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

export { app, httpServer };
