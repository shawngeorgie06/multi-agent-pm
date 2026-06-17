// Required for external APIs on networks with custom CA chains
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { ProjectBuilderService, APPS_DIR } from './services/ProjectBuilderService.js';
import { SocketServer } from './websocket/SocketServer.js';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';
import { MessageBus } from './services/MessageBus.js';
import { PhaseOrchestrator } from './services/PhaseOrchestrator.js';
import { TaskQueueManager } from './services/TaskQueueManager.js';
import { TaskDistributionService } from './services/TaskDistributionService.js';
import { stripCodeFences } from './utils/codeExtraction.js';
import type { AIService, RateLimitConfig } from './services/AIService.js';
import { GeminiService } from './services/GeminiService.js';
import { GitHubModelsService } from './services/GitHubModelsService.js';
import { GroqService } from './services/GroqService.js';
import { NvidiaService } from './services/NvidiaService.js';
import prisma from './database/db.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const socketServer = new SocketServer(httpServer);
const messageBus = new MessageBus();

const PORT = process.env.PORT || 5555;

// Initialize AI Service (Gemini, GitHub Models, or Ollama)
let currentAiService = process.env.AI_SERVICE?.toLowerCase() || 'gemini';
let generationService: AIService;

function createGenerationService(serviceType: string): AIService {
  if (serviceType === 'github') {
    const GITHUB_API_KEY = process.env.GITHUB_MODELS_API_KEY;
    if (!GITHUB_API_KEY) throw new Error('GITHUB_MODELS_API_KEY not set');
    const GITHUB_ENDPOINT = process.env.GITHUB_MODELS_ENDPOINT || 'https://models.inference.ai.azure.com';
    const GITHUB_MODEL = process.env.GITHUB_MODELS_MODEL || 'gpt-4o';
    const rl: Partial<RateLimitConfig> = {
      minIntervalMs: parseInt(process.env.GITHUB_INTERVAL_MS ?? '500'),
      maxRetries:    parseInt(process.env.GITHUB_MAX_RETRIES ?? '3'),
    };
    const svc = new GitHubModelsService(GITHUB_API_KEY, GITHUB_MODEL, GITHUB_ENDPOINT, { temperature: 0.7, maxTokens: 16384 }, rl);
    console.log(`[SERVER] Using GitHub Models API (${GITHUB_MODEL}) for code generation`);
    return svc;
  } else if (serviceType === 'gemini') {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
    const rl: Partial<RateLimitConfig> = {
      maxRequestsPerMinute: parseInt(process.env.GEMINI_RPM ?? '4'),
      maxRequestsPerDay:    parseInt(process.env.GEMINI_RPD ?? '18'),
      minIntervalMs:        parseInt(process.env.GEMINI_INTERVAL_MS ?? '15000'),
      maxRetries:           parseInt(process.env.GEMINI_MAX_RETRIES ?? '5'),
    };
    const svc = new GeminiService(GEMINI_API_KEY, 'gemini-2.5-flash', { temperature: 0.7, maxOutputTokens: 20000, topP: 0.95, topK: 40 }, rl);
    console.log('[SERVER] Using Gemini API (gemini-2.5-flash) for code generation');
    return svc;
  } else if (serviceType === 'groq') {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
    const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    // Groq counts max_tokens against the per-minute token budget (TPM) at request
    // time, not just the tokens actually generated. On the free tier (12k TPM) an
    // 8k reservation nearly maxes the budget per call → constant 429s. Our largest
    // single-file outputs are ~5k chars (~1.5k tokens), so 4096 is generous headroom
    // while leaving room for 2 requests/min. Override with GROQ_MAX_TOKENS if needed.
    const GROQ_MAX_TOKENS = parseInt(process.env.GROQ_MAX_TOKENS ?? '4096');
    const rl: Partial<RateLimitConfig> = {
      minIntervalMs: parseInt(process.env.GROQ_INTERVAL_MS ?? '500'),
      maxRetries:    parseInt(process.env.GROQ_MAX_RETRIES ?? '5'),
    };
    const svc = new GroqService(GROQ_API_KEY, GROQ_MODEL, { temperature: 0.7, maxTokens: GROQ_MAX_TOKENS }, rl);
    console.log(`[SERVER] Using Groq Cloud (${GROQ_MODEL}, max_tokens=${GROQ_MAX_TOKENS}) for code generation`);
    return svc;
  } else if (serviceType === 'nvidia') {
    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
    if (!NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY not set');
    const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b';
    const rl: Partial<RateLimitConfig> = {
      minIntervalMs: parseInt(process.env.NVIDIA_INTERVAL_MS ?? '500'),
      maxRetries:    parseInt(process.env.NVIDIA_MAX_RETRIES ?? '5'),
    };
    const svc = new NvidiaService(NVIDIA_API_KEY, NVIDIA_MODEL, { temperature: 1, maxTokens: 16384, topP: 0.95 }, rl);
    console.log(`[SERVER] Using NVIDIA API (${NVIDIA_MODEL}) for code generation`);
    return svc;
  } else {
    throw new Error(`Unknown AI_SERVICE: ${serviceType}. Must be 'gemini', 'github', 'groq', or 'nvidia'`);
  }
}

try {
  generationService = createGenerationService(currentAiService);
} catch (err) {
  console.error('[SERVER] Failed to initialize AI service:', err);
  process.exit(1);
}

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve generated apps as static files
app.use('/apps', express.static(APPS_DIR));

// ============================================================================
// Health check endpoint
// ============================================================================
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// SETTINGS ENDPOINTS - AI provider switcher
// ============================================================================
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({
    aiService: currentAiService,
    available: ['github', 'gemini', 'groq', 'nvidia'],
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const { aiService } = req.body;
  if (!aiService || !['github', 'gemini', 'groq', 'nvidia'].includes(aiService)) {
    res.status(400).json({ error: "aiService must be 'github', 'gemini', 'groq', or 'nvidia'" });
    return;
  }
  try {
    const newService = createGenerationService(aiService);
    generationService = newService;
    currentAiService = aiService;
    console.log(`[SERVER] Switched AI service to: ${aiService}`);
    res.json({ aiService: currentAiService });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

    // Combine separate HTML/CSS/JS tasks
    // Support both old PM-001/002/003 and new LAYOUT/STYLING/LOGIC task IDs
    let htmlCode = '';
    let cssCode = '';
    let jsCode = '';

    for (const task of tasks) {
      if (task.generatedCode) {
        const code = task.generatedCode;
        const lower = code.toLowerCase();
        const taskId = task.taskId.toUpperCase();

        // Skip meta-discussion or non-code tasks
        if (code.length < 20) {
          continue;
        }

        // Check if this is a code generation task
        const isCodeTask = taskId.startsWith('PM-001') || taskId.startsWith('PM-002') || taskId.startsWith('PM-003') ||
                          taskId.startsWith('LAYOUT') || taskId.startsWith('STYLING') || taskId.startsWith('LOGIC');

        if (!isCodeTask) {
          continue; // Skip non-code tasks
        }

        // Explicitly check task type first
        if (taskId.startsWith('LAYOUT') || taskId.startsWith('PM-001')) {
          // HTML task - must have HTML markers
          if ((lower.includes('<!doctype') || lower.includes('<html') || lower.includes('<body')) &&
              code.length > 50) {
            if (!htmlCode) {
              htmlCode = code;
            }
          }
        }

        if (taskId.startsWith('STYLING') || taskId.startsWith('PM-002')) {
          // CSS task - must have CSS markers
          if ((code.includes('{') && code.includes('}') && code.includes(':')) ||
              code.match(/^[\s]*[.#a-z]/m)) {
            if (!cssCode) {
              cssCode = code;
            }
          }
        }

        if (taskId.startsWith('LOGIC') || taskId.startsWith('PM-003')) {
          // JS task - must have JS markers
          if ((code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('document.')) &&
              !lower.includes('<!doctype') && !lower.includes('<html')) {
            if (!jsCode) {
              jsCode = code;
            }
          }
        }

        // Fallback content-based detection if no type match
        if (!htmlCode && (lower.includes('<!doctype') || lower.includes('<html'))) {
          htmlCode = code;
        }
        if (!cssCode && (code.match(/^[\s]*[.#a-z][\w-]*[\s]*\{/m) || (code.includes('{') && code.includes('}') && code.includes(':') && !code.includes('function')))) {
          cssCode = code;
        }
        if (!jsCode && (code.includes('function ') || code.includes('document.'))) {
          jsCode = code;
        }
      }
    }

    // If no HTML found, return error
    if (!htmlCode) {
      res.status(404).json({ error: 'No HTML code generated yet' });
      return;
    }

    // Strip any markdown fences before assembling so a literal ```css / ```html
    // can never end up inside the generated preview page.
    htmlCode = stripCodeFences(htmlCode);
    cssCode = stripCodeFences(cssCode);
    jsCode = stripCodeFences(jsCode);

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
// GET APP URL ENDPOINT
// ============================================================================
app.get('/api/projects/:id/app-url', async (req: Request, res: Response) => {
  const { id } = req.params;
  const appUrl = `http://localhost:${PORT}/apps/${id}/index.html`;
  res.json({ appUrl });
});

// ============================================================================
// DELETE PROJECT ENDPOINT
// ============================================================================
app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.project.delete({ where: { id } });
    const appDir = path.join(APPS_DIR, id);
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Project not found' }); return; }
    console.error('[SERVER] Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
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

    // Build and serve the generated app immediately from Phase 1 output
    const builder = ProjectBuilderService.getInstance();
    const p1Tasks = phase1Output.tasks;
    const htmlCode = p1Tasks.find((t: any) => t.taskId.startsWith('LAYOUT'))?.generatedCode || '';
    const cssCode = p1Tasks.find((t: any) => t.taskId.startsWith('STYLING'))?.generatedCode || '';
    const jsCode = p1Tasks.find((t: any) => t.taskId.startsWith('LOGIC'))?.generatedCode || '';
    const backendTask = p1Tasks.find((t: any) => t.taskId.startsWith('BACKEND'));
    const backendCode = backendTask?.generatedCode;
    const backendPort = backendTask?.backendPort;

    const { appUrl, backendUrl } = await builder.buildAndServe(
      projectId, htmlCode, cssCode, jsCode, backendCode, backendPort
    );

    const fullAppUrl = `http://localhost:${PORT}${appUrl}`;
    console.log(`\n[SERVER] ✅ App built and ready: ${fullAppUrl}`);
    if (backendUrl) console.log(`[SERVER] ✅ Backend running: ${backendUrl}`);

    socketServer.emitProjectStatus(
      projectId,
      'completed',
      `App ready! Open: ${fullAppUrl}`
    );
    socketServer.emitToAll('app_ready', { projectId, appUrl: fullAppUrl, backendUrl });

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
    // PHASE 3: REFINEMENT (Design Director → Logic → QA)
    // ====================================================================
    console.log('\n[SERVER] Starting Phase 3: Refinement');
    await phaseOrchestrator.phase3Execution(phase2Output, userRequest, phase1Output.tasks);

    console.log('\n[SERVER] ✅ All phases complete - agents executing autonomously\n');
  } catch (error) {
    console.error('[SERVER] ❌ Orchestration workflow failed:', error);
    socketServer.emitProjectStatus(
      projectId,
      'failed',
      `Workflow failed: ${error instanceof Error ? error.message : String(error)}`
    );

    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'failed',
        errorMessage
      },
    });
  }
});

// ============================================================================
// Startup cleanup — reset orphaned in_progress projects from prior server runs
// ============================================================================
prisma.project.updateMany({
  where: { status: 'in_progress' },
  data: { status: 'failed' },
}).then(({ count }) => {
  if (count > 0) console.log(`[STARTUP] Reset ${count} orphaned in_progress project(s) → failed`);
}).catch((e) => console.error('[STARTUP] Failed to reset orphaned projects:', e));

// ============================================================================
// Start server
// ============================================================================
httpServer.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 MULTI-AGENT PM BACKEND`);
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`AI Service: ${generationService.providerName} (${generationService.modelName})`);
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
